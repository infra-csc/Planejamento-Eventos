"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { conferirLinhaAction } from "@/app/(app)/eventos/actions";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { QuantidadeAta } from "@/components/eventos/quantidade-ata";
import { toastErro, toastSucesso } from "@/components/ui/toast";

export type LinhaMesmoItem = {
  id: string;
  quantidade: number;
  destino: string | null;
  area: string | null;
  /** Só quando quem vê pode ver os dados do pedido (logística ou a própria área). */
  solicitante: string | null;
  codigo: string | null;
  descricao: string | null;
  observacao: string | null;
  conferidoEm: string | null;
  conferidoPor: string | null;
};

/** Check de conferência de uma linha, o mesmo da tela de conferência (resposta imediata; volta se o servidor recusar). */
function BotaoConferir({ eventoId, l }: { eventoId: string; l: LinhaMesmoItem }) {
  const router = useRouter();
  const [marcada, setMarcada] = useState(Boolean(l.conferidoEm));
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`${l.destino ?? "Linha"}: ${marcada ? "conferido, clique para desfazer" : "marcar como conferido"}`}
      title={marcada ? `Conferido${l.conferidoPor ? ` por ${l.conferidoPor}` : ""} — clique para desfazer` : "Marcar como conferido"}
      disabled={pendente}
      onClick={() => {
        const v = !marcada;
        setMarcada(v);
        iniciar(async () => {
          const r = await conferirLinhaAction(eventoId, l.id, v);
          if (!r.ok) {
            setMarcada(!v);
            toastErro(r.erro);
            return;
          }
          if (r.dados && r.dados.conferidas === r.dados.total) toastSucesso("Todas as linhas conferidas. Registre os presentes e feche a ata.");
          router.refresh();
        });
      }}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-progress disabled:opacity-60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        marcada ? "border-success bg-success text-white hover:brightness-95" : "border-line-control bg-surface text-transparent hover:border-success hover:text-success",
      )}
    >
      <Icone nome="check" tamanho={16} />
    </button>
  );
}

/**
 * Todas as linhas do mesmo projeto/peça no evento (ex.: todas as tendas 10×10 pedidas), com local,
 * quantidade, quem pediu e a descrição — e o check de conferência de cada uma quando a reunião permite.
 */
export function MesmoItemNoEvento({ eventoId, atualId, linhas, podeConferir }: { eventoId: string; atualId: string; linhas: LinhaMesmoItem[]; podeConferir: boolean }) {
  return (
    <ul className="m-0 list-none p-0">
      {linhas.map((l) => {
        const atual = l.id === atualId;
        const conferida = Boolean(l.conferidoEm);
        return (
          <li key={l.id} className={cn("flex items-start gap-3 border-b border-line-row px-cartao py-3 last:border-b-0", atual && "bg-selected")}>
            {podeConferir ? (
              <BotaoConferir key={`${l.id}-${l.conferidoEm ?? ""}`} eventoId={eventoId} l={l} />
            ) : (
              <span role="img" aria-label={conferida ? "Conferido" : "Não conferido"} className={cn("grid size-9 shrink-0 place-items-center rounded-full border-2", conferida ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
                <Icone nome="check" tamanho={16} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <QuantidadeAta valor={l.quantidade} className="text-corpo font-semibold text-ink" />
                <span className="text-corpo text-ink">{l.destino ?? <span className="text-muted">local não informado</span>}</span>
                <span className="text-pequeno text-muted">· {l.area ?? "Logística"}</span>
                {atual ? (
                  <span className="text-rotulo font-medium text-accent">esta linha</span>
                ) : (
                  <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="link text-rotulo">
                    abrir
                  </Link>
                )}
              </p>
              {(l.solicitante || l.codigo) && (
                <p className="m-0 mt-0.5 text-pequeno text-ink-3">
                  {l.solicitante}
                  {l.solicitante && l.codigo ? " · " : ""}
                  {l.codigo && <Codigo>{l.codigo}</Codigo>}
                </p>
              )}
              {l.descricao && (
                <p className="m-0 mt-1 whitespace-pre-line break-words text-pequeno text-ink-2">
                  <span className="text-muted">Descrição: </span>
                  {l.descricao}
                </p>
              )}
              {l.observacao && (
                <p className="m-0 mt-0.5 whitespace-pre-line break-words text-pequeno text-ink-2">
                  <span className="text-muted">Obs.: </span>
                  {l.observacao}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
