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
import type { ItemNovo, Referencia } from "./tipos";

/** Passo 3: cada item adicionado com quantidade, local e descrição de cada unidade e ajuste de peças do projeto. */
export function ListaItens({
  itens,
  projetos,
  semDescricao,
  tentouEnviar,
  mudar,
  removerItem,
}: {
  itens: ItemNovo[];
  projetos: Referencia[];
  semDescricao: ItemNovo[];
  tentouEnviar: boolean;
  mudar: (chave: string, patch: Partial<ItemNovo>) => void;
  removerItem: (item: ItemNovo) => void;
}) {
  // Painel "Ajustar peças" aberto (um por vez).
  const [ajustando, setAjustando] = useState<string | null>(null);
  // Padrão do projeto + peças extras aceitas (tenda: fechamento e calha, padrão 0).
  const bomDe = (i: ItemNovo) => {
    const p = i.projetoId ? projetos.find((x) => x.id === i.projetoId) : undefined;
    return p ? [...(p.bom ?? []), ...(p.extras ?? [])] : [];
  };
  const capaDe = (i: ItemNovo) => (i.projetoId ? (projetos.find((p) => p.id === i.projetoId)?.capaId ?? null) : null);
  const resumoAjustes = (i: ItemNovo) => {
    const bom = bomDe(i);
    const partes = Object.entries(i.ajustes)
      .filter(([, d]) => d !== 0)
      .map(([pecaId, d]) => `${d > 0 ? "+" : "−"}${Math.abs(d)} ${bom.find((b) => b.pecaId === pecaId)?.nome ?? "peça"}`);
    return partes.length ? partes.join(" · ") : null;
  };

  return (
    <Passo
      n={3}
      titulo="Detalhe cada item"
      feito={itens.length > 0 && semDescricao.length === 0}
      sub="Quantidade e, para cada unidade, onde vai ficar e a descrição (texto, arte, medida)."
      acoes={itens.length > 0 ? <ChipMono tom="control">{itens.length}</ChipMono> : undefined}
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
          {itens.map((i) => {
            const capa = capaDe(i);
            const bom = bomDe(i);
            const descricaoProjeto = i.projetoId ? (projetos.find((p) => p.id === i.projetoId)?.descricao ?? null) : null;
            const ajustes = resumoAjustes(i);
            const abertoAjuste = ajustando === i.chave;
            return (
              <li key={i.chave} id={`item-${i.chave}`} tabIndex={-1} className="scroll-mt-24 border-b border-line-row px-cartao py-3.5 last:border-b-0 focus:outline-none">
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
                      {ajustes && <span className="text-ink-2">{ajustes}</span>}
                    </p>
                    {descricaoProjeto && (
                      <p className="mb-0 mt-1 text-pequeno text-muted">
                        {descricaoProjeto}
                      </p>
                    )}
                  </div>
                  <IconButton label={`Remover ${i.rotulo} da solicitação`} onClick={() => removerItem(i)}>
                    <Icone nome="lixeira" />
                  </IconButton>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3 sm:pl-[76px]">
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
                </div>

                <DescricoesItem item={i} destacarVazias={tentouEnviar} onChange={(patch) => mudar(i.chave, patch)} />

                {abertoAjuste && (
                  <div id={`ajuste-${i.chave}`} className="mt-3 animate-fade-up-rapido rounded-controle border border-line-soft bg-subtle px-3 pb-3 pt-2.5 sm:ml-[76px]">
                    <p className="mb-2 mt-0 text-pequeno text-muted">
                      Peças de <span className="text-ink">{i.rotulo}</span> por unidade do projeto. Mude só o que precisa a mais ou a menos; o resto segue o padrão.
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
              </li>
            );
          })}
        </ul>
      )}
    </Passo>
  );
}
