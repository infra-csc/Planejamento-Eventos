"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Section } from "@/components/ui/layout";
import { transicionarEventoAction } from "@/app/(app)/eventos/actions";
import type { EventoStatus } from "@/server/db/schema";

/** Ações de exceção do evento, fora do cabeçalho: adiar a reunião e cancelar. */
export function SituacaoEvento({ eventoId, codigo, status }: { eventoId: string; codigo: string; status: EventoStatus }) {
  const [aberto, setAberto] = useState<"VOLTAR_PREPARACAO" | "CANCELAR" | null>(null);
  if (status !== "PREPARACAO" && status !== "EM_REUNIAO" && status !== "ABERTO") return null;
  return (
    <Section titulo="Situação do evento" sub="Mudanças de exceção. Ficam registradas no histórico com a justificativa.">
      <div className="flex flex-col gap-3 px-[18px] py-3.5">
        {status === "EM_REUNIAO" && (
          <div className="flex items-center gap-4">
            <span className="min-w-0 flex-1">
              <span className="block text-corpo text-ink">Adiar a reunião</span>
              <span className="block text-pequeno text-muted">O evento volta para preparação e as áreas podem enviar de novo.</span>
            </span>
            <Button variant="secondary" size="md" onClick={() => setAberto("VOLTAR_PREPARACAO")}>
              Voltar para preparação
            </Button>
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="min-w-0 flex-1">
            <span className="block text-corpo text-ink">Cancelar evento</span>
            <span className="block text-pequeno text-muted">Solicitações em aberto são canceladas. Não dá para desfazer.</span>
          </span>
          <Button variant="dangerOutline" size="md" onClick={() => setAberto("CANCELAR")}>
            Cancelar evento
          </Button>
        </div>
      </div>
      {aberto && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAberto(null)}
          title={aberto === "CANCELAR" ? `Cancelar ${codigo}` : `Adiar a reunião de ${codigo}`}
          description={aberto === "CANCELAR" ? "O evento e as solicitações em aberto são cancelados. As áreas são notificadas." : "As áreas voltam a poder enviar necessidades até a nova data da reunião."}
          confirmLabel={aberto === "CANCELAR" ? "Cancelar evento" : "Voltar para preparação"}
          danger={aberto === "CANCELAR"}
          reasonLabel="Justificativa"
          action={transicionarEventoAction}
          hidden={{ eventoId, acao: aberto }}
        />
      )}
    </Section>
  );
}
