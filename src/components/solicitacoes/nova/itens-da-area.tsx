"use client";

import type { Dispatch, SetStateAction } from "react";
import { AvisoEstoque, type EstoqueDoEvento } from "./aviso-estoque";
import { cn } from "@/lib/cn";
import { Numero } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { listasDaArea } from "@/domain/itens-por-area";
import { ACOMPANHANTES } from "@/domain/regras-kit";
import { Passo } from "./passo";
import { ehAcompanhante, kitDe, novaChave } from "./utilidades";
import type { ItemNovo, Referencia } from "./tipos";

/** Peças que só vêm junto de outra (não se digitam): cavalete do cocho, pé da grade. */
const SO_AUTOMATICOS = new Set(["CAV-COCHO", "PE-GRADE-2X1"]);

/**
 * Cada peça que vem junto de outra (cavalete do cocho, cavalete reto da mesa ou pranchão, pé da grade)
 * logo abaixo da peça de origem, quando as duas estão na mesma lista; senão, onde já estava.
 */
function juntarAcompanhantes(pecas: Referencia[]): Referencia[] {
  const saida = pecas.filter((p) => {
    const a = ACOMPANHANTES.find((x) => x.acompanhante === p.codigo);
    return !a || !pecas.some((b) => a.bases.includes(b.codigo));
  });
  for (const p of pecas) {
    if (saida.includes(p)) continue;
    const a = ACOMPANHANTES.find((x) => x.acompanhante === p.codigo)!;
    // Depois da última base da lista (a mesa e o pranchão ficam juntos, e o cavalete reto logo abaixo).
    const ultima = Math.max(...saida.map((b, i) => (a.bases.includes(b.codigo) ? i : -1)));
    saida.splice(ultima + 1, 0, p);
  }
  return saida;
}

/**
 * Passo "Itens da sua área": a lista de materiais da ata, já zerada. A área só põe a quantidade do que vai;
 * mudar o número inclui o item na solicitação, voltar a 0 tira (0 não é enviado). Outros itens: no passo seguinte.
 * O que está em 0 fica discreto; o que foi pedido ganha destaque, para a lista ser lida de relance.
 */
export function ItensDaArea({
  n,
  areaNome,
  pecas,
  projetos = [],
  itens,
  setItens,
  abrirTenda,
  estoque = null,
}: {
  n: number;
  areaNome: string | null;
  pecas: Referencia[];
  /** Projetos padrão da lista: tenda é pedida por local (quadro de tendas); os outros (ex.: stand), pela quantidade. */
  projetos?: Referencia[];
  itens: ItemNovo[];
  setItens: Dispatch<SetStateAction<ItemNovo[]>>;
  abrirTenda?: (projetoId: string) => void;
  estoque?: EstoqueDoEvento | null;
}) {
  const listas = listasDaArea(areaNome)
    .map((l) => ({
      ...l,
      pecas: juntarAcompanhantes(l.codigos.map((c) => pecas.find((p) => p.codigo === c)).filter((p): p is Referencia => Boolean(p))),
      projetosDaLista: (l.projetos ?? [])
        .map((c) => projetos.find((p) => p.codigo === c))
        .filter((p): p is Referencia => Boolean(p) && (!l.nomeProjeto || l.nomeProjeto.test(p!.nome)) && (!kitDe(p!) || Boolean(abrirTenda))),
    }))
    .filter((l) => l.pecas.length > 0 || l.projetosDaLista.length > 0);
  if (!listas.length) return null;
  // Só o que a área pediu; a linha automática (vem junto) aparece à parte.
  const qtdDe = (pecaId: string) => itens.filter((i) => i.operacao === "ADICIONAR" && i.pecaId === pecaId && !ehAcompanhante(i)).reduce((a, i) => a + i.quantidade, 0);
  const autoDe = (pecaId: string) => itens.filter((i) => i.pecaId === pecaId && ehAcompanhante(i)).reduce((a, i) => a + i.quantidade, 0);
  const definir = (p: Referencia, v: number) =>
    setItens((l) => {
      const existentes = l.filter((i) => i.operacao === "ADICIONAR" && i.pecaId === p.id && !ehAcompanhante(i));
      if (v <= 0) return l.filter((i) => !existentes.includes(i));
      if (existentes.length) return l.flatMap((i) => (i === existentes[0] ? [{ ...i, quantidade: v }] : existentes.includes(i) ? [] : [i]));
      return [
        ...l,
        { chave: novaChave(), operacao: "ADICIONAR", projetoId: null, pecaId: p.id, eventoItemId: null, descricaoLivre: null, quantidade: v, quantidadeAtual: null, destino: "", justificativa: "", descricoes: [], locais: [], semDescricao: true, ajustes: {}, rotulo: `${p.codigo} · ${p.nome}`, meta: "lista da área" },
      ];
    });

  // Projeto: pode ter várias linhas no pedido (tenda: uma por local); aqui só o total.
  const linhasDoProjeto = (projetoId: string) => itens.filter((i) => i.operacao === "ADICIONAR" && i.projetoId === projetoId);
  const qtdProjeto = (projetoId: string) => linhasDoProjeto(projetoId).reduce((a, i) => a + i.quantidade, 0);
  // Stand e outros projetos: como na busca do catálogo (pede a descrição de cada unidade em "Itens do pedido").
  // Com o pedido já dividido em linhas, a diferença vai para a última; 0 tira todas.
  const definirProjeto = (p: Referencia, v: number) =>
    setItens((l) => {
      const existentes = l.filter((i) => i.operacao === "ADICIONAR" && i.projetoId === p.id);
      if (v <= 0) return l.filter((i) => !existentes.includes(i));
      if (!existentes.length)
        return [...l, { chave: novaChave(), operacao: "ADICIONAR", projetoId: p.id, pecaId: null, eventoItemId: null, descricaoLivre: null, quantidade: v, quantidadeAtual: null, destino: "", justificativa: "", descricoes: [], locais: [], ajustes: {}, rotulo: p.nome, meta: `${p.codigo} · projeto padrão` }];
      const ultima = existentes[existentes.length - 1];
      const total = existentes.reduce((a, i) => a + i.quantidade, 0);
      return l.map((i) => (i === ultima ? { ...i, quantidade: Math.max(1, i.quantidade + v - total) } : i));
    });

  const unicas = [...new Map(listas.flatMap((l) => [...l.pecas, ...l.projetosDaLista]).map((p) => [p.id, p])).values()];
  const ehProjeto = (p: Referencia) => listas.some((l) => l.projetosDaLista.includes(p));
  const qtd = (p: Referencia) => (ehProjeto(p) ? qtdProjeto(p.id) : qtdDe(p.id));
  const pedidos = unicas.filter((p) => !SO_AUTOMATICOS.has(p.codigo) && qtd(p) > 0);
  const unidades = pedidos.reduce((a, p) => a + qtd(p), 0);

  return (
    <Passo
      n={n}
      titulo={`Itens da ${areaNome}`}
      feito={pedidos.length > 0}
      sub="A lista da ata já vem aqui, zerada. Ponha só a quantidade do que vai; o que fica em 0 não é enviado."
      acoes={
        pedidos.length > 0 ? (
          <span className="whitespace-nowrap text-pequeno text-muted">
            <Numero valor={pedidos.length} className="font-medium text-ink" /> {pedidos.length === 1 ? "item" : "itens"} · <Numero valor={unidades} /> un.
          </span>
        ) : undefined
      }
    >
      <div className="grid gap-x-8 px-cartao pb-3 pt-1 md:grid-cols-2">
        {listas.map((l) => (
          <div key={l.titulo} className="pt-2.5">
            <h3 className="m-0 mb-1 flex items-baseline justify-between text-micro font-semibold uppercase tracking-[0.08em] text-ink-3">
              {l.titulo}
              {(() => {
                const k = l.pecas.filter((p) => qtdDe(p.id) > 0).length + l.projetosDaLista.filter((p) => qtdProjeto(p.id) > 0).length;
                return k ? <span className="numero font-normal normal-case tracking-normal text-meta">{k} no pedido</span> : null;
              })()}
            </h3>
            <ul className="m-0 list-none p-0">
              {l.pecas.map((p) => {
                const q = qtdDe(p.id);
                const acomp = ACOMPANHANTES.find((a) => a.acompanhante === p.codigo);
                const automatico = SO_AUTOMATICOS.has(p.codigo);
                const auto = autoDe(p.id);
                const ativo = automatico ? auto > 0 : q > 0 || auto > 0;
                // Vem junto de uma peça desta mesma lista: recuado, com o "↳" ligando à de cima.
                const junto = Boolean(acomp && l.pecas.some((b) => acomp.bases.includes(b.codigo)));
                return (
                  <li
                    key={p.id}
                    className={cn(
                      // Faixa à esquerda e fundo leve marcam o que já vai; o 0 fica quieto até o mouse/foco chegar.
                      "group -mx-2 flex min-h-11 items-center gap-3 rounded-controle border-l-2 px-2 py-1 transition-colors duration-150",
                      ativo ? "border-accent bg-accent-bg/40" : "border-transparent hover:bg-subtle",
                    )}
                  >
                    <span className={cn("min-w-0 flex-1 text-pequeno leading-snug", ativo ? "font-medium text-ink" : "text-ink-2", junto && "relative pl-4")}>
                      {junto && (
                        <span aria-hidden className="absolute left-0 top-0 text-accent">
                          ↳
                        </span>
                      )}
                      {p.nome}
                      {/* Mesmo formato nas três: "Automático · regra"; "aqui, só os extras" só quando a base está nesta lista
                          (na Ativação não há mesa de medalha; o cavalete reto do pranchão vem automático). */}
                      {automatico && <span className="mt-0.5 block text-rotulo font-normal text-muted">Automático · {acomp?.texto}</span>}
                      {/* O número já inclui os automáticos (antes era só "extras" e a pessoa digitava os mesmos de novo). */}
                      {!automatico && auto > 0 && (
                        <span className="mt-0.5 block text-rotulo font-normal text-muted">
                          {auto} automáticos ({acomp?.texto}){q > 0 ? ` + ${q} a mais` : ""} · aumente só se precisar de mais
                        </span>
                      )}
                      {!automatico && auto === 0 && acomp && junto && <span className="mt-0.5 block text-rotulo font-normal text-muted">Automático · {acomp.texto}</span>}
                      {/* Ativação: quanto ainda tem no estoque no período do evento (só informa). */}
                      <AvisoEstoque info={estoque?.[p.id]} pedido={q} />
                    </span>
                    {automatico ? (
                      <span className={cn("numero w-[104px] shrink-0 pr-3 text-right text-corpo", ativo ? "font-semibold text-ink" : "text-meta")} aria-label={`${auto} ${p.nome}, automático`}>
                        {auto}
                      </span>
                    ) : (
                      <Stepper
                        tamanho="sm"
                        valor={q + auto}
                        min={auto}
                        onChange={(v) => definir(p, Math.max(0, v - auto))}
                        label={`Quantidade de ${p.nome}`}
                        className={cn("shrink-0 transition-opacity duration-150", !ativo && "opacity-75 group-hover:opacity-100 focus-within:opacity-100")}
                      />
                    )}
                  </li>
                );
              })}
              {l.projetosDaLista.map((t) => {
                const q = qtdProjeto(t.id);
                const locais = linhasDoProjeto(t.id).length;
                if (!kitDe(t))
                  return (
                    <li key={t.id} className={cn("group -mx-2 flex min-h-11 items-center gap-3 rounded-controle border-l-2 px-2 py-1 transition-colors duration-150", q > 0 ? "border-accent bg-accent-bg/40" : "border-transparent hover:bg-subtle")}>
                      <span className={cn("min-w-0 flex-1 text-pequeno leading-snug", q > 0 ? "font-medium text-ink" : "text-ink-2")}>
                        {t.nome}
                        {q > 0 && <span className="mt-0.5 block text-rotulo font-normal text-muted">Descreva cada unidade (arte, marca) em “Itens do pedido”</span>}
                      </span>
                      <Stepper
                        tamanho="sm"
                        valor={q}
                        min={0}
                        onChange={(v) => definirProjeto(t, v)}
                        label={`Quantidade de ${t.nome}`}
                        className={cn("shrink-0 transition-opacity duration-150", q === 0 && "opacity-75 group-hover:opacity-100 focus-within:opacity-100")}
                      />
                    </li>
                  );
                return (
                  <li key={t.id} className={cn("group -mx-2 flex min-h-11 items-center gap-3 rounded-controle border-l-2 px-2 py-1 transition-colors duration-150", q > 0 ? "border-accent bg-accent-bg/40" : "border-transparent hover:bg-subtle")}>
                    <span className={cn("min-w-0 flex-1 text-pequeno leading-snug", q > 0 ? "font-medium text-ink" : "text-ink-2")}>
                      {t.nome}
                      <span className="mt-0.5 block text-rotulo font-normal text-muted">
                        {q > 0 ? (
                          <>
                            <Numero valor={q} /> {q === 1 ? "tenda" : "tendas"} · <Numero valor={locais} /> {locais === 1 ? "local" : "locais"}
                          </>
                        ) : (
                          "Por local: tendas, fechamentos e calhas"
                        )}
                      </span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => abrirTenda?.(t.id)}
                      aria-label={`${q > 0 ? "Editar" : "Pedir"} ${t.nome} por local`}
                      className={cn("w-[104px] shrink-0 transition-opacity duration-150", q === 0 && "opacity-75 group-hover:opacity-100 focus-visible:opacity-100")}
                    >
                      {q > 0 ? "Editar" : "Pedir"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Passo>
  );
}
