"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { combinaBusca } from "@/lib/busca";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/badge";
import { toast, toastErro } from "@/components/ui/toast";
import { ajustarLinhaConferenciaAction, conferirLinhaAction, conferirTodasAction } from "@/app/(app)/eventos/actions";
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";
import { VincularCatalogo } from "./vincular-catalogo";
import type { LinhaConferencia } from "@/server/services/conferencia";

type Filtro = "todas" | "pendentes" | "conferidas";

const TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "avulso" } as const;

function IconeCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeCaneta() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.5 12.3 2.5 13l.7-3L11.3 2.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 3.6l2.4 2.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Check verde da linha: um clique confere, outro desfaz. Otimista, volta se o servidor recusar. */
function Check({ l, eventoId, onMudou }: { l: LinhaConferencia; eventoId: string; onMudou: (id: string, v: boolean) => void }) {
  const [pendente, iniciar] = useTransition();
  const marcada = Boolean(l.conferidoEm);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`${l.nome}: ${marcada ? "conferido, clique para desfazer" : "marcar como conferido"}`}
      title={marcada ? `Conferido${l.conferidoPor ? ` por ${l.conferidoPor}` : ""} — clique para desfazer` : "Marcar como conferido"}
      disabled={pendente}
      onClick={() => {
        const v = !marcada;
        onMudou(l.id, v);
        iniciar(async () => {
          const r = await conferirLinhaAction(eventoId, l.id, v);
          if (!r.ok) {
            onMudou(l.id, !v);
            toastErro(r.erro);
          } else if (r.dados && r.dados.conferidas === r.dados.total) {
            toast("Todas as linhas conferidas. Registre os presentes e feche a ata.");
          }
        });
      }}
      className={cn(
        "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors disabled:opacity-60",
        marcada ? "border-success bg-success text-white hover:brightness-95" : "border-line-strong bg-surface text-transparent hover:border-success hover:text-success/60",
      )}
    >
      <IconeCheck />
    </button>
  );
}

/** Modal da canetinha: nova quantidade + motivo obrigatório; mostra o que a área vai ver. */
function AjusteModal({ l, eventoId, onFechar }: { l: LinhaConferencia; eventoId: string; onFechar: () => void }) {
  const [qtd, setQtd] = useState(l.quantidade);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const pedido = l.origem?.quantidadeSolicitada ?? null;
  const efeito =
    qtd === l.quantidade
      ? null
      : qtd === 0
        ? "sai da ata"
        : pedido != null && qtd < pedido
          ? `a área vê "parcial: ${qtd} de ${pedido}" com o motivo`
          : pedido != null && qtd === pedido
            ? "a área vê atendido integralmente"
            : `a ata passa a ter ${qtd}`;

  const salvar = () => {
    if (qtd === l.quantidade) return setErro("Altere a quantidade para salvar um ajuste.");
    if (!motivo.trim()) return setErro("Informe o motivo. Ele fica no histórico e vai para quem pediu.");
    setErro(null);
    iniciar(async () => {
      const r = await ajustarLinhaConferenciaAction(eventoId, l.id, qtd, motivo);
      if (!r.ok) return setErro(r.erro);
      toast(qtd === 0 ? `${l.nome} retirado da ata` : `${l.nome}: ${l.quantidade} → ${qtd}`);
      onFechar();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={`Ajustar ${l.nome}`} description="O ajuste fica registrado com seu nome, data e motivo." width={480}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-[8px] bg-subtle px-3.5 py-2.5 text-[12.5px]">
            <span>
              <span className="block text-muted">Na ata agora</span>
              <span className="font-mono text-[15px] font-medium">{l.quantidade}</span>
            </span>
            <span>
              <span className="block text-muted">{l.origem ? `Pedido em ${l.origem.codigo}` : "Origem"}</span>
              <span className="font-mono text-[15px] font-medium">{pedido ?? "incluída na reunião"}</span>
            </span>
          </div>

          <div>
            <label htmlFor="qtd-ajuste" className="text-[13px] font-medium text-ink">
              Nova quantidade
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex items-center overflow-hidden rounded-lg border border-line-control">
                <button type="button" aria-label="Diminuir" onClick={() => setQtd((q) => Math.max(0, q - 1))} className="h-10 w-10 cursor-pointer border-0 bg-subtle text-[16px] text-ink-2 hover:bg-control">
                  −
                </button>
                <input
                  id="qtd-ajuste"
                  type="number"
                  min={0}
                  value={qtd}
                  autoFocus
                  onChange={(e) => setQtd(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="h-10 w-20 border-0 bg-surface text-center font-mono text-[15px] focus:outline-none"
                />
                <button type="button" aria-label="Aumentar" onClick={() => setQtd((q) => q + 1)} className="h-10 w-10 cursor-pointer border-0 bg-subtle text-[16px] text-ink-2 hover:bg-control">
                  +
                </button>
              </div>
              <span className="text-[12px] text-muted">{efeito ?? "0 retira a linha da ata"}</span>
            </div>
          </div>

          <div>
            <label htmlFor="motivo-ajuste" className="text-[13px] font-medium text-ink">
              Motivo <span className="font-normal text-danger">obrigatório</span>
            </label>
            <textarea
              id="motivo-ajuste"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: só 3 disponíveis na data; o 4º vem de locação"
              className="mt-1.5 min-h-[84px] w-full resize-y rounded-lg border border-line-control bg-surface px-3 py-2.5 text-[13.5px] leading-[1.5] text-ink placeholder:text-meta focus:border-accent focus:outline-none"
            />
          </div>

          {erro && <p className="m-0 text-[12.5px] text-danger">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={pendente}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvar} loading={pendente}>
              Salvar ajuste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Colunas da tabela de conferência: check · item · quem pediu · destino · qtd · ações. */
const COLUNAS = "grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_64px_128px] items-center gap-x-3";

function Linha({
  l,
  eventoId,
  editavel,
  onMudou,
  onAjustar,
  opcoes,
  podeCadastrar,
}: {
  l: LinhaConferencia;
  eventoId: string;
  editavel: boolean;
  onMudou: (id: string, v: boolean) => void;
  onAjustar: (l: LinhaConferencia) => void;
  opcoes: OpcoesReferencia;
  podeCadastrar: boolean;
}) {
  const conferida = Boolean(l.conferidoEm);
  const pedidoDiferente = l.origem && l.origem.quantidadeSolicitada !== l.quantidade;
  const dicas = [l.origem?.observacao ? `Obs.: ${l.origem.observacao}` : null, l.origem?.ajustes ? `Peças ajustadas: ${l.origem.ajustes}` : null, l.ultimoAjuste ? `Ajustado por ${l.ultimoAjuste.por}: ${l.ultimoAjuste.descricao}` : null].filter(Boolean).join("\n");
  return (
    <li className={cn(COLUNAS, "min-h-[44px] border-b border-line-row px-[18px] py-1.5 last:border-b-0 hover:bg-subtle", !conferida && "bg-[color-mix(in_srgb,var(--color-warning-bg)_35%,transparent)]")}>
      <span className="flex justify-center">
        {editavel ? (
          <Check l={l} eventoId={eventoId} onMudou={onMudou} />
        ) : (
          <span className={cn("inline-flex size-6 items-center justify-center rounded-full border-2", conferida ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
            <IconeCheck />
          </span>
        )}
      </span>

      <span className="flex min-w-0 items-center gap-1.5">
        <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="truncate text-[13.5px] font-medium text-ink no-underline hover:text-accent hover:underline" title={`Ver detalhes de ${l.nome}`}>
          {l.nome}
        </Link>
        {l.tipo === "AVULSO" ? <Tag tom="warning">fora do catálogo</Tag> : <Tag tom="muted">{TIPO[l.tipo]}</Tag>}
        {l.codigo && <span className="hidden shrink-0 font-mono text-[11px] text-muted xl:inline">{l.codigo}</span>}
        {dicas && (
          <span title={dicas} aria-label={dicas} className={cn("shrink-0 text-[12px]", l.ultimoAjuste ? "text-warning" : "text-muted")}>
            {l.ultimoAjuste ? <IconeCaneta /> : "ⓘ"}
          </span>
        )}
      </span>

      <span className="truncate text-[12.5px] text-ink-3" title={l.origem ? `${l.origem.solicitante} · ${l.origem.codigo}${l.origem.titulo ? ` · ${l.origem.titulo}` : ""}` : undefined}>
        {l.origem ? (
          <>
            <span className="text-ink-2">{l.origem.solicitante}</span> ·{" "}
            <Link href={`/solicitacoes/${l.origem.solicitacaoId}`} className="font-mono text-ink-3 no-underline hover:underline">
              {l.origem.codigo}
            </Link>
          </>
        ) : (
          <>incluída na reunião{l.incluidaPor ? ` · ${l.incluidaPor}` : ""}</>
        )}
      </span>

      <span className="truncate text-[12.5px] text-ink-3" title={l.destino ?? undefined}>
        {l.destino ?? "—"}
      </span>

      <span className="text-right">
        <span className="font-mono text-[14px] font-medium text-ink">{l.quantidade}</span>
        {pedidoDiferente && <span className="block font-mono text-[10.5px] leading-none text-muted">pedido {l.origem!.quantidadeSolicitada}</span>}
      </span>

      <span className="flex items-center justify-end gap-1">
        {editavel && l.tipo === "AVULSO" && <VincularCatalogo compacto linha={{ linhaId: l.id, descricao: l.nome, quantidade: l.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />}
        {editavel && (
          <button
            type="button"
            onClick={() => onAjustar(l)}
            aria-label={`Ajustar quantidade de ${l.nome}`}
            title="Ajustar quantidade (com motivo)"
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent text-ink-3 hover:border-line hover:bg-surface hover:text-accent"
          >
            <IconeCaneta />
          </button>
        )}
        <Link
          href={`/eventos/${eventoId}/itens/${l.id}`}
          aria-label={`Detalhes de ${l.nome}`}
          title={l.tipo === "PROJETO" ? "Detalhes, peças do projeto e histórico" : "Detalhes e histórico"}
          className="inline-flex size-7 items-center justify-center rounded-full text-ink-3 no-underline hover:bg-surface hover:text-accent"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </span>
    </li>
  );
}

/**
 * Conferência da ata na reunião de OS: todas as linhas agrupadas por área, com quem pediu,
 * observações e ajustes. A logística marca cada uma com o check verde; a canetinha ajusta a
 * quantidade com motivo e log. A ata só fecha com tudo conferido.
 */
export function ConferenciaAta({
  eventoId,
  linhas: iniciais,
  editavel,
  opcoes,
  areas,
  podeCadastrar = false,
}: {
  eventoId: string;
  linhas: LinhaConferencia[];
  editavel: boolean;
  opcoes: OpcoesReferencia;
  areas: Array<{ id: string; nome: string }>;
  podeCadastrar?: boolean;
}) {
  // Estado local só para a resposta imediata do check; a revalidação do servidor substitui a lista.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [base, setBase] = useState(iniciais);
  if (base !== iniciais) {
    setBase(iniciais);
    setOverride({});
  }
  const linhas = useMemo(() => iniciais.map((l) => (l.id in override ? { ...l, conferidoEm: override[l.id] ? (l.conferidoEm ?? new Date().toISOString()) : null, conferidoPor: override[l.id] ? l.conferidoPor : null } : l)), [iniciais, override]);
  const mudou = (id: string, v: boolean) => setOverride((o) => ({ ...o, [id]: v }));

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [ajustando, setAjustando] = useState<LinhaConferencia | null>(null);
  const [incluir, setIncluir] = useState(false);
  const [conferindo, iniciarTodas] = useTransition();

  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const pendentes = linhas.length - conferidas;
  const visiveis = linhas.filter((l) => (filtro === "pendentes" ? !l.conferidoEm : filtro === "conferidas" ? Boolean(l.conferidoEm) : true) && (!busca.trim() || combinaBusca(`${l.nome} ${l.codigo ?? ""} ${l.destino ?? ""} ${l.areaNome ?? ""} ${l.origem?.codigo ?? ""} ${l.origem?.solicitante ?? ""}`, busca)));

  const grupos = useMemo(() => {
    const mapa = new Map<string, LinhaConferencia[]>();
    for (const l of visiveis) {
      const k = l.areaNome ?? "Logística";
      mapa.set(k, [...(mapa.get(k) ?? []), l]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [visiveis]);

  const filtroBtn = (v: Filtro, rotulo: string, n: number) => (
    <button
      key={v}
      type="button"
      onClick={() => setFiltro(v)}
      aria-pressed={filtro === v}
      className={cn("flex cursor-pointer items-center gap-1.5 rounded-[7px] border-0 px-3 py-1.5 text-[13px]", filtro === v ? "bg-dark font-medium text-white" : "bg-transparent text-ink-2 hover:bg-subtle")}
    >
      {rotulo}
      <span className={cn("rounded-[4px] px-1.5 font-mono text-[11px]", filtro === v ? "bg-dark-3 text-on-dark-2" : "bg-control text-ink-3")}>{n}</span>
    </button>
  );

  return (
    <section className="rounded-[10px] border border-line bg-surface" aria-label="Conferência da ata">
      <div className="flex flex-col gap-3 border-b border-line-soft px-[18px] py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[15px] font-semibold">Ata da reunião · conferência</h2>
            <p className="mb-0 mt-0.5 text-[12.5px] text-muted">Confira cada item ou projeto com as áreas. Ajustes pedem motivo e ficam no histórico.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editavel && pendentes > 1 && (
              <Button
                variant="secondary"
                size="sm"
                loading={conferindo}
                onClick={() =>
                  iniciarTodas(async () => {
                    const r = await conferirTodasAction(eventoId);
                    if (r.ok) toast(`${pendentes} linhas marcadas como conferidas`);
                    else toastErro(r.erro);
                  })
                }
              >
                Conferir as {pendentes} restantes
              </Button>
            )}
            {editavel && (
              <Button variant="secondary" size="sm" onClick={() => setIncluir(true)}>
                + Incluir linha
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-[9px] bg-control p-[3px]">
            {filtroBtn("todas", "Todas", linhas.length)}
            {filtroBtn("pendentes", "A conferir", pendentes)}
            {filtroBtn("conferidas", "Conferidas", conferidas)}
          </div>
          <input
            aria-label="Buscar na ata"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item, área, solicitação ou pessoa"
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-line-control bg-surface px-3 text-[13.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="px-[18px] py-14 text-center">
          <p className="m-0 text-[14px] font-medium">A ata está vazia</p>
          <p className="mt-1 text-[12.5px] text-muted">As necessidades enviadas pelas áreas entram aqui automaticamente. Você também pode incluir linhas decididas na reunião.</p>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="m-0 px-[18px] py-10 text-center text-[13px] text-muted">{filtro === "pendentes" ? "Nada a conferir. Tudo certo por aqui." : "Nenhuma linha com esse filtro."}</p>
      ) : (
        <>
        <div className={cn(COLUNAS, "border-b border-line-soft px-[18px] py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted")} aria-hidden>
          <span />
          <span>Item</span>
          <span>Pedido por</span>
          <span>Destino</span>
          <span className="text-right">Qtd.</span>
          <span />
        </div>
        {grupos.map(([area, ls]) => {
          const ok = ls.filter((l) => l.conferidoEm).length;
          return (
            <div key={area}>
              <div className="flex items-center justify-between gap-3 border-b border-line-soft bg-subtle px-[18px] py-1.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-2">{area}</span>
                <span className={cn("font-mono text-[12px]", ok === ls.length ? "text-success" : "text-ink-3")}>
                  {ok}/{ls.length} conferidas
                </span>
              </div>
              <ul className="m-0 list-none p-0">
                {ls.map((l) => (
                  <Linha key={l.id} l={l} eventoId={eventoId} editavel={editavel} onMudou={mudou} onAjustar={setAjustando} opcoes={opcoes} podeCadastrar={podeCadastrar} />
                ))}
              </ul>
            </div>
          );
        })}
        </>
      )}

      <div className="flex items-center justify-between gap-3 rounded-b-[10px] border-t border-line-soft bg-subtle px-[18px] py-2.5 text-[12.5px] text-ink-3">
        <span>
          {linhas.length} {linhas.length === 1 ? "linha" : "linhas"} · <span className="font-mono">{linhas.reduce((a, l) => a + l.quantidade, 0)}</span> unidades
        </span>
        <span className={cn("font-mono", pendentes === 0 && linhas.length > 0 ? "text-success" : "text-warning")}>
          {conferidas}/{linhas.length} conferidas
        </span>
      </div>

      {ajustando && <AjusteModal l={ajustando} eventoId={eventoId} onFechar={() => setAjustando(null)} />}
      <Dialog open={incluir} onOpenChange={setIncluir}>
        {incluir && (
          <DialogContent title="Incluir linha na ata" description="Projeto padrão, peça do catálogo ou item avulso decidido na reunião. Já entra conferida." width={520}>
            <LinhaAtaForm eventoId={eventoId} opcoes={opcoes} areas={areas} exigeJustificativa={false} onDone={() => setIncluir(false)} />
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
