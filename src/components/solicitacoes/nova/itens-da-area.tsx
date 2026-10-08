"use client";

import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/cn";
import { Numero } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { listasDaArea } from "@/domain/itens-por-area";
import { ACOMPANHANTES } from "@/domain/regras-kit";
import { Passo } from "./passo";
import { ehAcompanhante, novaChave } from "./utilidades";
import type { ItemNovo, Referencia } from "./tipos";

/** Peças que só vêm junto de outra (não se digitam): cavalete do cocho, pé da grade. */
const SO_AUTOMATICOS = new Set(["CAV-COCHO", "PE-GRADE-2X1"]);

/**
 * Passo "Itens da sua área": a lista de materiais da ata, já zerada. A área só põe a quantidade do que vai;
 * mudar o número inclui o item na solicitação, voltar a 0 tira (0 não é enviado). Outros itens: no passo seguinte.
 * O que está em 0 fica discreto; o que foi pedido ganha destaque, para a lista ser lida de relance.
 */
export function ItensDaArea({ n, areaNome, pecas, itens, setItens }: { n: number; areaNome: string | null; pecas: Referencia[]; itens: ItemNovo[]; setItens: Dispatch<SetStateAction<ItemNovo[]>> }) {
  const listas = listasDaArea(areaNome)
    .map((l) => ({ ...l, pecas: l.codigos.map((c) => pecas.find((p) => p.codigo === c)).filter((p): p is Referencia => Boolean(p)) }))
    .filter((l) => l.pecas.length > 0);
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

  const unicas = [...new Map(listas.flatMap((l) => l.pecas).map((p) => [p.id, p])).values()];
  const pedidos = unicas.filter((p) => !SO_AUTOMATICOS.has(p.codigo) && qtdDe(p.id) > 0);
  const unidades = pedidos.reduce((a, p) => a + qtdDe(p.id), 0);

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
                const k = l.pecas.filter((p) => qtdDe(p.id) > 0).length;
                return k ? <span className="numero font-normal normal-case tracking-normal text-meta">{k} no pedido</span> : null;
              })()}
            </h3>
            <ul className="m-0 list-none p-0">
              {l.pecas.map((p) => {
                const q = qtdDe(p.id);
                const acomp = ACOMPANHANTES.find((a) => a.acompanhante === p.codigo);
                const automatico = SO_AUTOMATICOS.has(p.codigo);
                const auto = autoDe(p.id);
                const ativo = automatico ? auto > 0 : q > 0;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      // Faixa à esquerda e fundo leve marcam o que já vai; o 0 fica quieto até o mouse/foco chegar.
                      "group -mx-2 flex min-h-11 items-center gap-3 rounded-controle border-l-2 px-2 py-1 transition-colors duration-150",
                      ativo ? "border-accent bg-accent-bg/40" : "border-transparent hover:bg-subtle",
                    )}
                  >
                    <span className={cn("min-w-0 flex-1 text-pequeno leading-snug", ativo ? "font-medium text-ink" : "text-ink-2")}>
                      {p.nome}
                      {automatico && <span className="mt-0.5 block text-rotulo font-normal text-muted">{acomp?.texto}, automático</span>}
                      {!automatico && auto > 0 && <span className="mt-0.5 block text-rotulo font-normal text-muted">+{auto} automáticos ({acomp?.texto})</span>}
                    </span>
                    {automatico ? (
                      <span className={cn("numero w-[104px] shrink-0 pr-3 text-right text-corpo", ativo ? "font-semibold text-ink" : "text-meta")} aria-label={`${auto} ${p.nome}, automático`}>
                        {auto}
                      </span>
                    ) : (
                      <Stepper
                        tamanho="sm"
                        valor={q}
                        min={0}
                        onChange={(v) => definir(p, v)}
                        label={`Quantidade de ${p.nome}`}
                        className={cn("shrink-0 transition-opacity duration-150", !ativo && "opacity-55 group-hover:opacity-100 focus-within:opacity-100")}
                      />
                    )}
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
