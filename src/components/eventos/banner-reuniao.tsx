"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Aviso } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { transicionarEventoAction } from "@/app/(app)/eventos/actions";
import type { EventoStatus } from "@/server/db/schema";

/** Banner escuro da consolidação (handoff §5.7). */
export function BannerReuniao({ eventoId, nome, codigo, status, respondidos, total }: { eventoId: string; nome: string; codigo: string; status: EventoStatus; respondidos: number; total: number }) {
  const [confirmar, setConfirmar] = useState<"INICIAR_REUNIAO" | "FECHAR_ATA" | null>(null);
  const completo = respondidos >= total;
  const pct = total ? Math.round((respondidos / total) * 100) : 100;
  const emReuniao = status === "EM_REUNIAO";

  const titulo = emReuniao ? `Reunião de OS em andamento · ${nome}` : `Preparação da reunião de OS · ${nome}`;
  const sub = !emReuniao
    ? "As áreas ainda podem enviar. Você já pode responder o que chegou; inicie a reunião para bloquear novos envios."
    : completo
      ? "Todos os itens foram respondidos. Revise a ata à direita e feche para gerar a OS."
      : `Faltam ${total - respondidos} ${total - respondidos === 1 ? "item" : "itens"} para fechar a ata. Atendido entra com a quantidade pedida, parcial com a atendida.`;

  return (
    <section className="mb-[18px] flex items-center gap-6 rounded-[10px] bg-dark px-[22px] py-[18px]" aria-label="Andamento da reunião">
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[15px] font-semibold text-white">{titulo}</h2>
        <p className="mb-0 mt-1 text-[13px] leading-[1.5] text-on-dark-3">{sub}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="relative block h-1.5 max-w-[360px] flex-1 overflow-hidden rounded-[3px] bg-dark-3" role="progressbar" aria-valuenow={respondidos} aria-valuemin={0} aria-valuemax={total} aria-label="Itens respondidos">
            <span className="absolute left-0 top-0 block h-1.5 rounded-[3px]" style={{ width: `${pct}%`, background: completo ? "#7fd0a8" : "#e0798f" }} />
          </span>
          <span className="font-mono text-[12.5px] text-on-dark-2">
            {respondidos}/{total} respondidos
          </span>
        </div>
      </div>
      {emReuniao ? (
        <button
          type="button"
          aria-disabled={!completo}
          onClick={() => (completo ? setConfirmar("FECHAR_ATA") : toast(`Ainda há ${total - respondidos} ${total - respondidos === 1 ? "item" : "itens"} sem resposta — responda todos para fechar a ata`))}
          className={cn("h-[38px] shrink-0 rounded-lg border-0 px-4 text-[13.5px] font-medium", completo ? "cursor-pointer bg-accent-light text-dark hover:brightness-105" : "cursor-not-allowed bg-dark-3 text-muted")}
        >
          Fechar ata e gerar OS
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmar("INICIAR_REUNIAO")} className="h-[38px] shrink-0 cursor-pointer rounded-lg border-0 bg-accent-light px-4 text-[13.5px] font-medium text-dark hover:brightness-105">
          Iniciar reunião
        </button>
      )}
      {confirmar && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirmar(null)}
          title={confirmar === "FECHAR_ATA" ? `Fechar a ata de ${codigo}` : `Iniciar a reunião de ${codigo}`}
          description={confirmar === "FECHAR_ATA" ? "A ata é congelada e a OS de cada setor é gerada a partir dela." : "Os envios de necessidades ficam bloqueados enquanto a reunião acontece."}
          confirmLabel={confirmar === "FECHAR_ATA" ? "Fechar ata e gerar OS" : "Iniciar reunião"}
          action={transicionarEventoAction}
          hidden={{ eventoId, acao: confirmar }}
        >
          {confirmar === "FECHAR_ATA" && <Aviso>As áreas são notificadas e, a partir daqui, mudanças entram como solicitação de alteração.</Aviso>}
        </ConfirmDialog>
      )}
    </section>
  );
}
