"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/badge";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toast, toastErro } from "@/components/ui/toast";
import { alterarQuantidadeLinhaAction, atualizarVersaoLinhaAction, conferirLinhaAction, conferirTodasAction } from "@/app/(app)/eventos/actions";
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";
import type { EventoStatus } from "@/server/db/schema";

export type LinhaAtaView = {
  id: string;
  tipo: "PROJETO" | "PECA" | "AVULSO";
  nome: string;
  codigo: string | null;
  quantidade: number;
  destino: string | null;
  areaNome: string | null;
  origemLabel: string;
  origemSolicitacaoId: string | null;
  versao: number | null;
  versaoAtual: number | null;
  versaoDefasada: boolean;
  /** Primeira imagem do projeto padrão (miniatura na linha). */
  capaId?: string | null;
  /** Conferida na reunião de OS (ISO) e por quem. */
  conferidoEm?: string | null;
  conferidoPor?: string | null;
};

/** Caixa de conferência da linha: a logística marca item a item na reunião; a ata só fecha com todas marcadas. */
function CheckConferida({ l, eventoId }: { l: LinhaAtaView; eventoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [otimista, setOtimista] = useState<boolean | null>(null);
  const marcada = otimista ?? Boolean(l.conferidoEm);
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[12px]", marcada ? "text-success" : "text-ink-3 hover:bg-subtle")} title={marcada && l.conferidoPor ? `Conferido por ${l.conferidoPor}` : "Marcar como conferido na reunião"}>
      <input
        type="checkbox"
        className="size-4 cursor-pointer accent-[var(--color-success)]"
        checked={marcada}
        disabled={pendente}
        aria-label={`${l.nome}: conferido na reunião`}
        onChange={(e) => {
          const v = e.target.checked;
          setOtimista(v);
          iniciar(async () => {
            const r = await conferirLinhaAction(eventoId, l.id, v);
            if (!r.ok) {
              setOtimista(null);
              toastErro(r.erro);
            } else if (r.dados && r.dados.conferidas === r.dados.total) {
              toast("Todas as linhas conferidas — a ata pode ser fechada");
            }
          });
        }}
      />
      <span className="hidden sm:inline">{marcada ? "conferido" : "conferir"}</span>
    </label>
  );
}

const TAG_TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "avulso" } as const;

function BadgeVersao({ l, eventoId, podeAtualizar }: { l: LinhaAtaView; eventoId: string; podeAtualizar: boolean }) {
  const [pendente, iniciar] = useTransition();
  const texto = `v${l.versao} · atualizar para v${l.versaoAtual}`;
  const cls = "ml-2 inline-flex h-[22px] items-center rounded-[5px] border border-warning-border bg-warning-bg px-[7px] text-[11px] font-medium text-warning";
  if (!podeAtualizar) return <span className={cls}>{`v${l.versao} · existe v${l.versaoAtual}`}</span>;
  return (
    <button
      type="button"
      disabled={pendente}
      className={cn(cls, "cursor-pointer hover:border-warning")}
      onClick={() =>
        iniciar(async () => {
          const r = await atualizarVersaoLinhaAction(eventoId, l.id);
          if (r.ok) toast(`${l.nome} atualizado para v${l.versaoAtual}`);
          else toastErro(r.erro);
        })
      }
    >
      {pendente ? "atualizando…" : texto}
    </button>
  );
}

/**
 * Tabela da ata (handoff §5.6). `compacta` é a versão da coluna direita da consolidação:
 * Item · Qtd. · Origem.
 */
export function AtaLista({
  eventoId,
  status,
  linhas,
  editavel,
  opcoes,
  areas,
  compacta = false,
  dataReuniao,
  conferivel = false,
}: {
  eventoId: string;
  status: EventoStatus;
  linhas: LinhaAtaView[];
  editavel: boolean;
  opcoes: OpcoesReferencia;
  areas: Array<{ id: string; nome: string }>;
  compacta?: boolean;
  dataReuniao: string;
  /** Reunião em andamento: mostra a coluna de conferência item a item. */
  conferivel?: boolean;
}) {
  const [incluir, setIncluir] = useState(false);
  const [conferindoTodas, iniciarTodas] = useTransition();
  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const [ajustar, setAjustar] = useState<LinhaAtaView | null>(null);
  const exigeJustificativa = status === "ABERTO";
  const soma = linhas.reduce((a, l) => a + l.quantidade, 0);

  const botaoIncluir = editavel && (
    <button type="button" onClick={() => setIncluir(true)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-accent hover:underline">
      + Incluir linha {exigeJustificativa ? "com justificativa" : "decidida na reunião"}
    </button>
  );

  return (
    <>
      {linhas.length === 0 ? (
        <div className={cn("text-center", compacta ? "px-[18px] py-8" : "px-[18px] py-12")}>
          <p className="m-0 text-[13.5px] font-medium text-ink">Ata ainda não montada</p>
          <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-muted">
            {compacta ? "As linhas entram aqui conforme você responde os itens." : `A ata é montada na reunião de OS, marcada para ${dataReuniao}.`}
          </p>
          {botaoIncluir && <div className="mt-3">{botaoIncluir}</div>}
        </div>
      ) : (
        <>
          <table className="w-full border-collapse">
            <CaptionOculta>Linhas da ata</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th>Item</Th>
                <Th largura={compacta ? 52 : 70} alinhar="right">
                  Qtd.
                </Th>
                {!compacta && <Th largura={130}>Destino</Th>}
                {!compacta && <Th largura={120}>Área</Th>}
                <Th largura={compacta ? 120 : 170}>Origem</Th>
                {conferivel && <Th largura={compacta ? 44 : 110}>{compacta ? <span className="sr-only">Conferido</span> : "Conferido"}</Th>}
                {editavel && !compacta && <Th largura={70}></Th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className={cn("hover:bg-subtle", conferivel && !l.conferidoEm && "bg-warning-bg/40")}>
                  <th scope="row" className="border-b border-line-row px-[18px] py-[11px] text-left font-normal">
                    {l.capaId && <ImagemZoom src={`/api/anexos/${l.capaId}`} alt={l.nome} className="float-left mr-2.5 h-9 w-12 overflow-hidden rounded-[5px] border border-line" />}
                    <span className="text-[13.5px] text-ink">{l.nome}</span>
                    {!compacta && (
                      <Tag className="ml-2" tom="muted">
                        {TAG_TIPO[l.tipo]}
                      </Tag>
                    )}
                    {l.versaoDefasada && <BadgeVersao l={l} eventoId={eventoId} podeAtualizar={editavel} />}
                    {l.codigo && <span className="mt-px block font-mono text-[11.5px] text-muted">{l.codigo}</span>}
                  </th>
                  <td className="border-b border-line-row px-2.5 py-[11px] text-right font-mono text-[13px] font-medium">{l.quantidade}</td>
                  {!compacta && <td className="border-b border-line-row px-2.5 py-[11px] text-[12.5px] text-ink-2">{l.destino ?? <span className="text-meta">—</span>}</td>}
                  {!compacta && <td className="border-b border-line-row px-2.5 py-[11px] text-[12.5px] text-ink-2">{l.areaNome ?? <span className="text-meta">Logística</span>}</td>}
                  <td className="border-b border-line-row px-2.5 py-[11px] text-[12px] text-ink-3">
                    {l.origemSolicitacaoId ? (
                      <Link href={`/solicitacoes/${l.origemSolicitacaoId}`} className="font-mono text-ink-2 no-underline hover:underline">
                        {l.origemLabel}
                      </Link>
                    ) : (
                      l.origemLabel
                    )}
                  </td>
                  {conferivel && (
                    <td className="border-b border-line-row px-1.5 py-[7px]">
                      <CheckConferida l={l} eventoId={eventoId} />
                    </td>
                  )}
                  {editavel && !compacta && (
                    <td className="border-b border-line-row py-[11px] pr-[18px] text-right">
                      <button type="button" onClick={() => setAjustar(l)} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-accent hover:underline" aria-label={`Ajustar ${l.nome}`}>
                        Ajustar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-3 bg-subtle px-[18px] py-2.5 text-[12.5px] text-ink-3">
            <span>
              {linhas.length} {linhas.length === 1 ? "linha" : "linhas"} na ata · <span className="font-mono">{soma}</span> unidades
              {conferivel && (
                <>
                  {" · "}
                  <span className={cn("font-mono", conferidas === linhas.length ? "text-success" : "text-warning")}>
                    {conferidas}/{linhas.length}
                  </span>{" "}
                  conferidas
                </>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              {conferivel && conferidas < linhas.length && linhas.length - conferidas > 1 && (
                <button
                  type="button"
                  disabled={conferindoTodas}
                  onClick={() =>
                    iniciarTodas(async () => {
                      const r = await conferirTodasAction(eventoId);
                      if (r.ok) toast("Linhas restantes marcadas como conferidas");
                      else toastErro(r.erro);
                    })
                  }
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-ink-2 hover:underline disabled:opacity-60"
                >
                  {conferindoTodas ? "conferindo…" : `Conferir as ${linhas.length - conferidas} restantes`}
                </button>
              )}
              {botaoIncluir}
            </span>
          </div>
        </>
      )}

      <Dialog open={incluir} onOpenChange={setIncluir}>
        {incluir && (
          <DialogContent
            title={exigeJustificativa ? "Ajuste da logística" : "Incluir linha na ata"}
            description={exigeJustificativa ? "A ata já foi fechada: a inclusão exige justificativa e gera nova versão da OS." : "Projeto padrão, peça do catálogo ou item avulso decidido na reunião."}
            width={520}
          >
            <LinhaAtaForm eventoId={eventoId} opcoes={opcoes} areas={areas} exigeJustificativa={exigeJustificativa} onDone={() => setIncluir(false)} />
          </DialogContent>
        )}
      </Dialog>

      {ajustar && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAjustar(null)}
          title={`Ajustar ${ajustar.nome}`}
          description={exigeJustificativa ? "A ata já foi fechada: o ajuste exige justificativa, gera nova versão da OS e avisa a área." : "Quantidade 0 remove a linha da ata. A linha fica no histórico."}
          confirmLabel="Salvar ajuste"
          reasonLabel={exigeJustificativa ? "Justificativa" : undefined}
          action={alterarQuantidadeLinhaAction}
          hidden={{ eventoId, linhaId: ajustar.id }}
        >
          <Field label="Quantidade" htmlFor="quantidade" hint="Use 0 para remover a linha.">
            <Input id="quantidade" name="quantidade" type="number" min={0} defaultValue={ajustar.quantidade} required autoFocus className="w-[120px] font-mono" />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}
