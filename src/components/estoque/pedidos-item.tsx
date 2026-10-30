"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { diaMes, periodoCurto } from "@/lib/format";
import { pedidosDoItemAction } from "@/app/(app)/ativacao/actions";
import type { EventoComPedidos } from "@/server/services/ativacao";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { Carregando, Skeleton } from "@/components/ui/layout";

const SITUACAO: Record<EventoComPedidos["situacao"], { rotulo: string; tom: "neutral" | "info" | "warning" | "success" }> = {
  fora: { rotulo: "Fora · ainda não voltou", tom: "warning" },
  "na OS": { rotulo: "Na OS · sai na montagem", tom: "info" },
  pedido: { rotulo: "Pedido · ata aberta", tom: "neutral" },
  devolvido: { rotulo: "Voltou", tom: "success" },
};

/**
 * Histórico de pedidos de um item do estoque, numa janela: em cima, destacado, o que ainda não voltou (fora, na OS,
 * pedido); embaixo, o que já foi pedido e voltou, com o retorno (bons, reforma, perdidos). Em cada evento, de onde vem
 * a quantidade: a solicitação (área, quem pediu, quando) ou a logística, solta ou dentro de projeto, e o local.
 * Os dados vêm quando a janela abre.
 */
export function BotaoPedidosItem({ itemId, nome, emUso, unidades }: { itemId: string; nome: string; emUso: number; unidades: number }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<EventoComPedidos[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrir = async () => {
    setAberto(true);
    setErro(null);
    const r = await pedidosDoItemAction(itemId).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    if (r.ok) setDados(r.dados ?? []);
    else setErro(r.erro);
  };

  const emAndamento = (dados ?? []).filter((e) => e.situacao !== "devolvido");
  const historico = (dados ?? []).filter((e) => e.situacao === "devolvido");

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={abrir}
        aria-label={emUso ? `Pedidos de ${nome}: ${emUso} ${emUso === 1 ? "evento" : "eventos"} em andamento, ${unidades} unidades` : `Histórico de pedidos de ${nome}`}
        className={cn("-ml-1.5 mt-0.5 h-auto whitespace-normal px-1.5 py-0.5 text-left text-rotulo", emUso > 0 && "font-medium text-ink")}
      >
        <Icone nome="relogio" className="size-3.5" />
        {emUso > 0 ? (
          <>
            Pedidos · <Numero valor={emUso} /> em andamento · <Numero valor={unidades} /> un.
          </>
        ) : (
          "Histórico de pedidos"
        )}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && (
          <DialogContent title={`Pedidos · ${nome}`} description="O que ainda não voltou fica em destaque; embaixo, o histórico do que já foi pedido e voltou." width={760}>
            {erro ? (
              <FormError message={erro} />
            ) : !dados ? (
              <Carregando texto="Carregando pedidos…" className="flex flex-col gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </Carregando>
            ) : dados.length === 0 ? (
              <p className="m-0 text-corpo text-ink-2">Nenhum evento pediu este item desde 20/10, quando o controle de saída e retorno começou.</p>
            ) : (
              <div className="flex flex-col gap-5">
                <section aria-labelledby={`andamento-${itemId}`}>
                  <h3 id={`andamento-${itemId}`} className="m-0 mb-2 text-corpo font-semibold">
                    Em andamento <span className="numero font-normal text-ink-3">· {emAndamento.length}</span>
                  </h3>
                  {emAndamento.length === 0 ? (
                    <p className="m-0 rounded-controle border border-line-soft bg-subtle px-3 py-2 text-pequeno text-ink-2">Tudo o que foi pedido já voltou.</p>
                  ) : (
                    <ListaEventos eventos={emAndamento} />
                  )}
                </section>
                {historico.length > 0 && (
                  <section aria-labelledby={`historico-${itemId}`}>
                    <h3 id={`historico-${itemId}`} className="m-0 mb-2 text-corpo font-semibold">
                      Histórico · já voltou <span className="numero font-normal text-ink-3">· {historico.length}</span>
                    </h3>
                    <ListaEventos eventos={historico} />
                  </section>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setAberto(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function ListaEventos({ eventos }: { eventos: EventoComPedidos[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {eventos.map((e) => (
        <li key={e.evento.id} className={cn("overflow-hidden rounded-controle border", e.situacao === "fora" ? "border-warning-border border-l-4 border-l-warning" : "border-line")}>
          <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-3 py-2", e.situacao === "fora" ? "bg-warning-bg" : "bg-subtle")}>
            <Link href={`/eventos/${e.evento.id}`} className="font-medium text-ink no-underline hover:underline">
              <Codigo>{e.evento.codigo}</Codigo> {e.evento.nome}
            </Link>
            <span className="numero text-pequeno text-ink-3">{periodoCurto(e.evento.dataMontagem, e.evento.dataDesmontagem)}</span>
            <Tag tom={SITUACAO[e.situacao].tom} className="ml-auto">
              {SITUACAO[e.situacao].rotulo}
            </Tag>
            <span className="numero text-corpo font-semibold">{e.total} un.</span>
          </div>
          {e.retorno && (
            <p className="m-0 border-b border-line-soft px-3 py-1.5 text-pequeno">
              <span className="text-success">{e.retorno.voltaram} {e.retorno.voltaram === 1 ? "voltou bom" : "voltaram bons"}</span>
              {e.retorno.reforma > 0 && <span className="text-warning"> · {e.retorno.reforma} para reforma</span>}
              {e.retorno.perdidos > 0 && <span className="text-danger"> · {e.retorno.perdidos} {e.retorno.perdidos === 1 ? "perdido" : "perdidos"}</span>}
              <span className="text-ink-3"> · registrado {diaMes(e.retorno.em)}</span>
              {e.retorno.observacao && <span className="block text-rotulo text-muted">{e.retorno.observacao}</span>}
            </p>
          )}
          <ul className="m-0 list-none divide-y divide-line-row p-0">
            {e.pedidos.map((p, k) => (
              <li key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-pequeno">
                <span className="numero w-10 shrink-0 text-right font-semibold text-ink">{p.quantidade}</span>
                <span className="min-w-0 flex-1">
                  {p.solicitacao ? (
                    <>
                      <Link href={`/solicitacoes/${p.solicitacao.id}`} className="link">
                        {p.solicitacao.codigo}
                      </Link>
                      {p.solicitacao.titulo && <span className="text-ink-2"> · {p.solicitacao.titulo}</span>}
                      <span className="block text-rotulo text-muted">
                        {p.solicitacao.area}
                        {p.solicitacao.solicitante && ` · ${p.solicitacao.solicitante}`}
                        {p.solicitacao.enviadaEm && ` · enviada ${diaMes(p.solicitacao.enviadaEm)}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-2">Incluído pela logística na ata</span>
                  )}
                </span>
                <span className="text-rotulo text-ink-3">{p.origem === "solta" ? "peça solta" : `no projeto ${p.origem}`}</span>
                {p.destino && <span className="text-rotulo text-ink-3">· {p.destino}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
