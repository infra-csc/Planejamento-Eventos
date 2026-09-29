"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";
import { ChipMono, Tag } from "@/components/ui/badge";
import { Stepper } from "@/components/ui/stepper";
import { Input, Label } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { DescricoesItem } from "./descricoes-item";
import { ErroCampo, Passo } from "./passo";
import type { PedidoAnterior } from "@/domain/ja-pedido";
import { AcoesReferencia } from "./aviso-ja-pedido";
import { agruparItensNovos, kitDe } from "./utilidades";
import { locaisDosItens, PAPEIS_POR_LOCAL, papeisDoKit, totalDoLocal } from "@/domain/tendas";
import type { ItemNovo, Referencia } from "./tipos";

/**
 * Passo 3: cada item adicionado com quantidade, local e descrição de cada unidade e ajuste de peças do projeto.
 * Itens do mesmo projeto (ex.: tenda em vários locais) ficam num cartão só, com um bloco por local.
 */
export function ListaItens({
  itens,
  projetos,
  jaPedidos = {},
  semDescricao,
  tentouEnviar,
  mudar,
  removerItem,
  removerItens,
  editarTendas,
}: {
  itens: ItemNovo[];
  projetos: Referencia[];
  /** Já pedido neste evento, por id de projeto/peça (aviso informativo na linha do item). */
  jaPedidos?: Record<string, PedidoAnterior[]>;
  semDescricao: ItemNovo[];
  tentouEnviar: boolean;
  mudar: (chave: string, patch: Partial<ItemNovo>) => void;
  removerItem: (item: ItemNovo) => void;
  /** Tira todas as linhas de um cartão (ex.: a tenda em todos os locais). */
  removerItens: (itens: ItemNovo[], rotulo: string) => void;
  /** Reabre o quadro de tendas do projeto, já preenchido. */
  editarTendas: (projetoId: string) => void;
}) {
  // Painel "Ajustar peças" aberto (um por vez).
  const [ajustando, setAjustando] = useState<string | null>(null);
  const projetoDe = (i: ItemNovo) => (i.projetoId ? projetos.find((x) => x.id === i.projetoId) : undefined);
  // Padrão do projeto + peças extras aceitas (tenda: fechamento e calha, padrão 0).
  const bomDe = (i: ItemNovo) => {
    const p = projetoDe(i);
    return p ? [...(p.bom ?? []), ...(p.extras ?? [])] : [];
  };
  const resumoAjustes = (i: ItemNovo) => {
    const bom = bomDe(i);
    const partes = Object.entries(i.ajustes)
      .filter(([, d]) => d !== 0)
      .map(([pecaId, d]) => `${d > 0 ? "+" : "−"}${Math.abs(d)} ${bom.find((b) => b.pecaId === pecaId)?.nome ?? "peça"}`);
    return partes.length ? partes.join(" · ") : null;
  };
  const grupos = agruparItensNovos(itens);

  /** Tenda: um item só, mostrado como o quadro (Local | Tendas | Fechamentos | Calhas); edita no próprio quadro. */
  const quadroTenda = (p: Referencia, doGrupo: ItemNovo[]) => {
    const kit = kitDe(p);
    if (!kit) return null;
    const bomP = p.bom ?? [];
    const codigoDe = new Map([...bomP, ...(p.extras ?? [])].map((b) => [b.pecaId, b.codigo]));
    const locais = locaisDosItens(
      kit,
      bomP,
      doGrupo.map((i) => ({ destino: i.destino, quantidade: i.quantidade, ajustes: Object.fromEntries(Object.entries(i.ajustes).flatMap(([id, d]) => (codigoDe.has(id) ? [[codigoDe.get(id)!, d]] : []))) })),
    );
    const colunas = papeisDoKit(kit).filter((c) => PAPEIS_POR_LOCAL.includes(c.papel) && codigoDe.size > 0 && [...codigoDe.values()].includes(c.codigo));
    const th = "px-2 py-1.5 text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted";
    return (
      <div className="mt-3 sm:ml-[76px]">
        <div className="overflow-x-auto rounded-controle border border-line-soft">
          <table className="w-full border-collapse text-pequeno">
            <caption className="sr-only">{p.nome} por local</caption>
            <thead className="bg-subtle">
              <tr>
                <th scope="col" className={th}>Local</th>
                <th scope="col" className={cn(th, "text-right")}>Tendas</th>
                {colunas.map((c) => (
                  <th key={c.papel} scope="col" className={cn(th, "text-right")}>{c.rotulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locais.map((l) => (
                <tr key={l.local} className="border-t border-line-row">
                  <td className="px-2 py-1.5 text-ink">{l.local || <span className="text-meta">sem local</span>}</td>
                  <td className="numero px-2 py-1.5 text-right font-medium text-ink">{l.quantidade}</td>
                  {colunas.map((c) => (
                    <td key={c.papel} className={cn("numero px-2 py-1.5 text-right", l.totais[c.papel] !== undefined ? "font-medium text-accent" : "text-ink-2")}>
                      {totalDoLocal(kit, bomP, l, c.papel)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => editarTendas(p.id)}>
          <Icone nome="lapis" />
          Editar tendas
        </Button>
      </div>
    );
  };

  /** Foto, nome, tipo, descrição do projeto e "Ver peças / Já pedido" (uma vez por cartão). */
  const cabecalho = (i: ItemNovo, quantidade: number, extra: React.ReactNode, acao: React.ReactNode) => {
    const p = projetoDe(i);
    const capa = p?.capaId ?? null;
    return (
      <div className="flex items-start gap-3">
        {capa ? (
          <ImagemZoom src={`/api/anexos/${capa}`} alt={i.rotulo} className="h-12 w-16 shrink-0 overflow-hidden rounded-controle border border-line" />
        ) : (
          <span aria-hidden className="grid h-12 w-16 shrink-0 place-items-center rounded-controle border border-dashed border-line-strong text-meta max-sm:hidden">
            <Icone nome={i.projetoId ? "camadas" : "caixa"} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 line-clamp-2 break-words text-corpo font-medium text-ink" title={i.rotulo}>
            {i.rotulo}
          </p>
          <p className="mb-0 mt-1 flex flex-wrap items-center gap-1.5 text-pequeno text-muted">
            <Tag tom={i.operacao === "REMOVER" ? "danger" : i.meta === "fora do catálogo" ? "warning" : "muted"}>{i.meta}</Tag>
            {extra}
          </p>
          {p?.descricao && <p className="mb-0 mt-1 text-pequeno text-muted">{p.descricao}</p>}
          {i.operacao === "ADICIONAR" && (
            <AcoesReferencia
              referencia={{ nome: i.rotulo, codigo: p?.codigo, meta: p?.meta, descricao: p?.descricao, capaId: p?.capaId, bom: p?.bom }}
              pedidos={jaPedidos[i.projetoId ?? i.pecaId ?? ""]}
              quantidade={quantidade}
              className="mt-1.5"
            />
          )}
        </div>
        {acao}
      </div>
    );
  };

  /** Quantidade, local, descrições e ajuste de peças de uma linha (sozinha ou um local dentro do cartão). */
  const corpo = (i: ItemNovo, noGrupo: boolean) => {
    const bom = bomDe(i);
    const ajustes = resumoAjustes(i);
    const abertoAjuste = ajustando === i.chave;
    return (
      <>
        <div className={cn("flex flex-wrap items-end gap-x-4 gap-y-3", !noGrupo && "mt-3 sm:pl-[76px]")}>
          {i.operacao === "REMOVER" ? (
            <p className="m-0 flex items-center gap-1.5 text-pequeno font-medium text-danger">
              <Icone nome="lixeira" className="size-3.5" />
              Sai da ata (hoje <Numero valor={i.quantidadeAtual} />)
            </p>
          ) : (
            <div>
              <Label htmlFor={`qtd-${i.chave}`}>{i.operacao === "ALTERAR_QUANTIDADE" ? "Nova quantidade" : "Quantidade"}</Label>
              <Stepper id={`qtd-${i.chave}`} tamanho="sm" valor={i.quantidade} min={i.operacao === "ALTERAR_QUANTIDADE" ? 0 : 1} onChange={(v) => mudar(i.chave, { quantidade: v })} />
            </div>
          )}
          {i.operacao !== "ADICIONAR" && (
            <div className="min-w-[160px] max-w-[280px] flex-1">
              <Label htmlFor={`destino-${i.chave}`} optional>
                Onde vai ficar
              </Label>
              <Input id={`destino-${i.chave}`} value={i.destino} onChange={(e) => mudar(i.chave, { destino: e.target.value })} placeholder="Ex.: Palco, Dispersão" maxLength={60} />
            </div>
          )}
          {i.projetoId && bom.length > 0 && (
            <Button variant={abertoAjuste ? "secondary" : "ghost"} size="sm" onClick={() => setAjustando((a) => (a === i.chave ? null : i.chave))} aria-expanded={abertoAjuste} aria-controls={`ajuste-${i.chave}`}>
              <Icone nome={abertoAjuste ? "chevron-cima" : "chevron-baixo"} />
              {abertoAjuste ? "Fechar peças" : "Ajustar peças"}
            </Button>
          )}
          {noGrupo && ajustes && <span className="self-center text-pequeno text-ink-2">{ajustes}</span>}
        </div>

        <DescricoesItem item={i} destacarVazias={tentouEnviar} onChange={(patch) => mudar(i.chave, patch)} />

        {abertoAjuste && (
          <div id={`ajuste-${i.chave}`} className={cn("mt-3 animate-fade-up-rapido rounded-controle border border-line-soft bg-subtle px-3 pb-3 pt-2.5", !noGrupo && "sm:ml-[76px]")}>
            <p className="mb-2 mt-0 text-pequeno text-muted">
              Peças de <span className="text-ink">{i.rotulo}</span> por unidade do projeto{noGrupo && i.destino ? <> em {i.destino}</> : null}. Mude só o que precisa a mais ou a menos; o resto segue o padrão.
            </p>
            <ul className="m-0 grid list-none grid-cols-1 gap-x-6 p-0 md:grid-cols-2">
              {bom.map((b) => {
                const delta = i.ajustes[b.pecaId] ?? 0;
                const pedir = b.quantidade + delta;
                const definir = (v: number) => mudar(i.chave, { ajustes: { ...i.ajustes, [b.pecaId]: Math.max(0, v) - b.quantidade } });
                return (
                  <li key={b.pecaId} className="flex items-center gap-2 border-b border-line-faint py-2 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words text-pequeno text-ink" title={b.nome}>
                        {b.nome}
                      </span>
                      <span className="block text-rotulo text-meta">
                        <Codigo>{b.codigo}</Codigo> · padrão <Numero valor={b.quantidade} unidade={b.unidade} />
                      </span>
                    </span>
                    <Stepper tamanho="sm" valor={pedir} min={0} onChange={definir} label={`Quantidade de ${b.nome}`} className={cn(delta !== 0 && "border-accent")} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  };

  return (
    <Passo
      n={3}
      titulo="Detalhe cada item"
      feito={itens.length > 0 && semDescricao.length === 0}
      sub="Quantidade e, para cada unidade, onde vai ficar e a descrição (texto, arte, medida)."
      acoes={itens.length > 0 ? <ChipMono tom="control">{grupos.length}</ChipMono> : undefined}
    >
      {itens.length === 0 ? (
        <div className="px-cartao py-3.5">
          <div className={cn("rounded-cartao border border-dashed", tentouEnviar ? "border-danger-input" : "border-line-strong")}>
            <EmptyState compact title="Nenhum item ainda" description="Busque no passo 2 e use “Adicionar”. Cada item recebe resposta separada da logística." />
          </div>
          {tentouEnviar && <ErroCampo className="mt-2">Adicione ao menos um item para enviar.</ErroCampo>}
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {grupos.map(({ chave, itens: doGrupo }) => {
            const i = doGrupo[0];
            const proj = projetoDe(i);
            const ehTenda = i.operacao === "ADICIONAR" && Boolean(proj && kitDe(proj));
            if (doGrupo.length === 1 && !ehTenda) {
              const ajustes = resumoAjustes(i);
              return (
                <li key={chave} id={`item-${i.chave}`} tabIndex={-1} className="scroll-mt-24 border-b border-line-row px-cartao py-3.5 last:border-b-0 focus:outline-none">
                  {cabecalho(
                    i,
                    i.quantidade,
                    ajustes && <span className="text-ink-2">{ajustes}</span>,
                    <IconButton label={`Remover ${i.rotulo} da solicitação`} onClick={() => removerItem(i)}>
                      <Icone nome="lixeira" />
                    </IconButton>,
                  )}
                  {corpo(i, false)}
                </li>
              );
            }
            const total = doGrupo.reduce((a, x) => a + x.quantidade, 0);
            const tenda = ehTenda && proj ? quadroTenda(proj, doGrupo) : null;
            const nLocais = new Set(doGrupo.map((x) => x.destino.trim().toLocaleLowerCase("pt-BR"))).size;
            return (
              <li key={chave} id={tenda ? `item-${i.chave}` : undefined} tabIndex={tenda ? -1 : undefined} className="scroll-mt-24 border-b border-line-row px-cartao py-3.5 last:border-b-0 focus:outline-none">
                {cabecalho(
                  i,
                  total,
                  <span className="text-ink-2">
                    <Numero valor={total} className="font-medium text-ink" /> no total · {nLocais} {nLocais === 1 ? "local" : "locais"}
                  </span>,
                  <IconButton label={`Remover ${i.rotulo} da solicitação (todos os locais)`} onClick={() => removerItens(doGrupo, i.rotulo)}>
                    <Icone nome="lixeira" />
                  </IconButton>,
                )}
                {tenda ?? (
                <ol className="m-0 mt-3 list-none divide-y divide-line-faint rounded-controle border border-line-soft p-0 sm:ml-[76px]">
                  {doGrupo.map((x, n) => (
                    <li key={x.chave} id={`item-${x.chave}`} tabIndex={-1} className="scroll-mt-24 px-3 py-3 focus:outline-none">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                          Local {n + 1}
                          {x.destino.trim() ? <span className="normal-case tracking-normal text-ink-2"> · {x.destino}</span> : null}
                        </span>
                        <IconButton label={`Remover ${x.rotulo}${x.destino ? ` em ${x.destino}` : ""} da solicitação`} onClick={() => removerItem(x)}>
                          <Icone nome="lixeira" />
                        </IconButton>
                      </div>
                      {corpo(x, true)}
                    </li>
                  ))}
                </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Passo>
  );
}
