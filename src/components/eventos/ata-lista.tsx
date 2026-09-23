"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { Tag } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { IconeCheck, IconeLapis } from "@/components/ui/icons";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { EmptyState, RodapeTabela } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toast, toastErro } from "@/components/ui/toast";
import { alterarQuantidadeLinhaAction, atualizarVersaoLinhaAction, conferirLinhaAction, conferirTodasAction } from "@/app/(app)/eventos/actions";
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";
import { VincularCatalogo } from "./vincular-catalogo";
import type { EventoStatus } from "@/server/db/schema";

/** Resultado de "conferir as restantes": avisa quando chegaram linhas novas depois que a tela abriu. */
const avisarTodas = (r: Awaited<ReturnType<typeof conferirTodasAction>>, rotulo: string) => {
  if (!r.ok) return toastErro(r.erro);
  toast(r.dados && r.dados.novas > 0 ? `${rotulo}. ${r.dados.novas} ${r.dados.novas === 1 ? "linha chegou" : "linhas chegaram"} depois e ${r.dados.novas === 1 ? "continua pendente" : "continuam pendentes"}: confira na lista.` : rotulo);
};

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
  /** Entrou depois do fechamento da ata (alteração atendida ou ajuste da logística). */
  posAta?: boolean;
};

/** Caixa de conferência da linha: a logística marca item a item na reunião; a ata só fecha com todas marcadas. */
function CheckConferida({ l, eventoId }: { l: LinhaAtaView; eventoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [otimista, setOtimista] = useState<boolean | null>(null);
  const marcada = otimista ?? Boolean(l.conferidoEm);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`${l.nome}: conferido na reunião`}
      title={marcada ? `Conferido${l.conferidoPor ? ` por ${l.conferidoPor}` : ""} — clique para desfazer` : "Marcar como conferido na reunião"}
      disabled={pendente}
      onClick={() => {
        const v = !marcada;
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
      className={cn(
        "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:opacity-60",
        marcada ? "border-success bg-success text-white hover:brightness-95" : "border-line-strong bg-surface text-transparent hover:border-success hover:text-success/50",
      )}
    >
      <IconeCheck size={14} />
    </button>
  );
}

/** Canetinha: ajustar a quantidade da linha (fica no histórico quem mudou, de quanto para quanto e a justificativa). */
function BotaoAjustar({ nome, onClick }: { nome: string; onClick: () => void }) {
  return (
    <IconButton label={`Ajustar ${nome}`} onClick={onClick}>
      <IconeLapis size={13} />
    </IconButton>
  );
}

const TAG_TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "avulso" } as const;

function BadgeVersao({ l, eventoId, podeAtualizar }: { l: LinhaAtaView; eventoId: string; podeAtualizar: boolean }) {
  const [pendente, iniciar] = useTransition();
  const texto = `v${l.versao} · atualizar para v${l.versaoAtual}`;
  const cls = "ml-2 inline-flex h-[22px] items-center rounded-chip border border-warning-border bg-warning-bg px-[7px] text-rotulo font-medium text-warning";
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
  contexto = "ata",
  podeCadastrar = false,
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
  /** "os": a mesma lista usada para ajustar os itens da OS depois da ata fechada. */
  contexto?: "ata" | "os";
  /** Pode cadastrar peça nova ao vincular um item fora do catálogo. */
  podeCadastrar?: boolean;
}) {
  const [incluir, setIncluir] = useState(false);
  const [conferindoTodas, iniciarTodas] = useTransition();
  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const [ajustar, setAjustar] = useState<LinhaAtaView | null>(null);
  const exigeJustificativa = status === "ABERTO";
  const soma = linhas.reduce((a, l) => a + l.quantidade, 0);

  const botaoIncluir = editavel && (
    <Button variant="link" size="sm" onClick={() => setIncluir(true)}>
      + {contexto === "os" ? "Incluir item na OS com justificativa" : `Incluir linha ${exigeJustificativa ? "com justificativa" : "decidida na reunião"}`}
    </Button>
  );

  return (
    <>
      {linhas.length === 0 ? (
        <EmptyState compact={compacta} title="Ata ainda não montada" description={compacta ? "As linhas entram aqui conforme você responde os itens." : `A ata é montada na reunião de OS, marcada para ${dataReuniao}.`} action={botaoIncluir || undefined} />
      ) : (
        <>
          {/* Rolagem própria no celular: sem ela, colunas como Total ficavam cortadas pelo cartão. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
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
                  {(conferivel || editavel) && (
                    <Th largura={conferivel && editavel ? 76 : 44}>
                      <span className="sr-only">Conferir e ajustar</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className={cn("hover:bg-subtle", conferivel && !l.conferidoEm && "bg-warning-bg/40")}>
                    <th scope="row" className="border-b border-line-row px-cartao py-[11px] text-left font-normal">
                      {l.capaId && <ImagemZoom src={`/api/anexos/${l.capaId}`} alt={l.nome} className="float-left mr-2.5 h-9 w-12 overflow-hidden rounded-chip border border-line" />}
                      <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="text-corpo text-ink no-underline hover:text-accent hover:underline" title="Detalhes, quem pediu e histórico">
                        {l.nome}
                      </Link>
                      {!compacta && (
                        <Tag className="ml-2" tom="muted">
                          {TAG_TIPO[l.tipo]}
                        </Tag>
                      )}
                      {l.posAta && (
                        <Tag className="ml-2" tom="accent">
                          depois da ata
                        </Tag>
                      )}
                      {l.versaoDefasada && <BadgeVersao l={l} eventoId={eventoId} podeAtualizar={editavel} />}
                      {l.tipo === "AVULSO" && editavel && (
                        <span className="ml-2 inline-block align-middle">
                          <VincularCatalogo compacto linha={{ linhaId: l.id, descricao: l.nome, quantidade: l.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />
                        </span>
                      )}
                      {l.codigo && <span className="mt-px block font-mono text-rotulo text-muted">{l.codigo}</span>}
                    </th>
                    <td className="border-b border-line-row px-2.5 py-[11px] text-right font-mono text-corpo font-medium">{l.quantidade}</td>
                    {!compacta && <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-ink-2">{l.destino ?? <span className="text-meta">—</span>}</td>}
                    {!compacta && <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-ink-2">{l.areaNome ?? <span className="text-meta">Logística</span>}</td>}
                    <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-ink-3">
                      {l.origemSolicitacaoId ? (
                        <Link href={`/solicitacoes/${l.origemSolicitacaoId}`} className="font-mono text-ink-2 no-underline hover:underline">
                          {l.origemLabel}
                        </Link>
                      ) : (
                        l.origemLabel
                      )}
                    </td>
                    {(conferivel || editavel) && (
                      <td className={cn("border-b border-line-row py-[7px] pl-1.5", compacta ? "pr-2.5" : "pr-[14px]")}>
                        <span className="flex items-center justify-end gap-1">
                          {conferivel && <CheckConferida l={l} eventoId={eventoId} />}
                          {editavel && <BotaoAjustar nome={l.nome} onClick={() => setAjustar(l)} />}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RodapeTabela
            direita={
              <span className="flex flex-wrap items-center gap-3">
                {conferivel && conferidas < linhas.length && linhas.length - conferidas > 1 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="!text-ink-2 hover:!text-ink"
                    disabled={conferindoTodas}
                    onClick={() =>
                      iniciarTodas(async () => {
                        // Só as linhas que estão na tela: o que chegar depois continua pendente.
                        const r = await conferirTodasAction(eventoId, linhas.filter((l) => !l.conferidoEm).map((l) => l.id));
                        avisarTodas(r, "Linhas restantes marcadas como conferidas");
                      })
                    }
                  >
                    {conferindoTodas ? "conferindo…" : `Conferir as ${linhas.length - conferidas} restantes`}
                  </Button>
                )}
                {botaoIncluir}
              </span>
            }
          >
            {linhas.length} {contexto === "os" ? (linhas.length === 1 ? "item na OS" : "itens na OS") : `${linhas.length === 1 ? "linha" : "linhas"} na ata`} · <span className="font-mono">{soma}</span> unidades
            {conferivel && (
              <>
                {" · "}
                <span className={cn("font-mono", conferidas === linhas.length ? "text-success" : "text-warning")}>
                  {conferidas}/{linhas.length}
                </span>{" "}
                conferidas
              </>
            )}
          </RodapeTabela>
        </>
      )}

      <Dialog open={incluir} onOpenChange={setIncluir}>
        {incluir && (
          <DialogContent
            title={exigeJustificativa ? "Ajuste da logística" : "Incluir linha na ata"}
            description={exigeJustificativa ? "A ata já foi fechada: a inclusão exige justificativa e gera nova versão da OS." : "Projeto padrão, peça do catálogo ou item fora do catálogo decidido na reunião."}
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
            <QuantidadeAjuste inicial={ajustar.quantidade} />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}

/** Quantidade do ajuste com − e +; o input oculto leva o valor no mesmo `name` que a action lê. */
function QuantidadeAjuste({ inicial }: { inicial: number }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <Stepper id="quantidade" valor={valor} onChange={setValor} min={0} autoFocus />
      <input type="hidden" name="quantidade" value={valor} />
    </>
  );
}
