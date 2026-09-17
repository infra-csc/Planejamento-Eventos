"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Aviso, BannerEscuro } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { transicionarEventoAction } from "@/app/(app)/eventos/actions";
import type { EventoStatus } from "@/server/db/schema";

/** Banner escuro da consolidação (handoff §5.7). */
export function BannerReuniao({
  eventoId,
  nome,
  codigo,
  status,
  conferidas,
  total,
  presentesOk,
  iniciadaEm,
}: {
  eventoId: string;
  nome: string;
  codigo: string;
  status: EventoStatus;
  /** Linhas da ata conferidas item a item na reunião. */
  conferidas: number;
  total: number;
  /** "Pessoas presentes" preenchido: exigido para fechar. */
  presentesOk: boolean;
  iniciadaEm: string | null;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState<"INICIAR_REUNIAO" | "FECHAR_ATA" | null>(null);
  const faltam = total - conferidas;
  const completo = faltam <= 0 && total > 0 && presentesOk;
  const pct = total ? Math.round((conferidas / total) * 100) : 0;
  const emReuniao = status === "EM_REUNIAO";

  const titulo = emReuniao ? `Reunião de OS em andamento · ${nome}` : `Preparação da reunião de OS · ${nome}`;
  const sub = !emReuniao
    ? "As necessidades das áreas já estão na ata. Inicie a reunião para bloquear novos envios e conferir item a item."
    : total === 0
      ? "A ata está vazia. Inclua linhas decididas na reunião antes de fechar."
      : faltam > 0
        ? `${faltam === 1 ? "Falta conferir 1 linha" : `Faltam conferir ${faltam} linhas`} da ata. Use o check verde em cada item ou projeto abaixo.`
        : !presentesOk
          ? "Tudo conferido. Registre quem estava presente em “Dados da reunião” para fechar a ata."
          : "Tudo conferido e presentes registrados. Feche a ata para gerar a OS.";
  const motivoBloqueio = total === 0 ? "Inclua ao menos uma linha na ata" : faltam > 0 ? `Ainda ${faltam === 1 ? "falta 1 linha" : `faltam ${faltam} linhas`} sem conferência` : "Registre quem estava presente na reunião";

  return (
    <BannerEscuro
      className="mb-[18px]"
      aria-label="Andamento da reunião"
      titulo={titulo}
      acoes={
        emReuniao ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Button variant={completo ? "pink" : "bloqueado"} size="xl" aria-disabled={!completo} onClick={() => (completo ? setConfirmar("FECHAR_ATA") : toast(`${motivoBloqueio} — só então a ata pode ser fechada`))}>
              Fechar ata e gerar OS
            </Button>
            {!completo && <span className="text-rotulo text-on-dark-4">{motivoBloqueio}</span>}
          </div>
        ) : (
          <Button variant="pink" size="xl" onClick={() => setConfirmar("INICIAR_REUNIAO")}>
            Iniciar reunião
          </Button>
        )
      }
    >
      <p className="m-0">{sub}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative block h-1.5 max-w-[360px] flex-1 overflow-hidden rounded-[3px] bg-dark-3" role="progressbar" aria-valuenow={conferidas} aria-valuemin={0} aria-valuemax={total} aria-label="Linhas conferidas">
          <span className={cn("absolute left-0 top-0 block h-1.5 rounded-[3px]", faltam <= 0 && total > 0 ? "bg-success-light" : "bg-accent-light")} style={{ width: `${pct === 0 ? 0 : Math.max(4, pct)}%` }} />
        </span>
        <span className="font-mono text-pequeno text-on-dark-2">
          {conferidas}/{total} conferidas
        </span>
        {emReuniao && iniciadaEm && <span className="text-pequeno text-on-dark-4">· iniciada {iniciadaEm}</span>}
      </div>
      {confirmar && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirmar(null)}
          title={confirmar === "FECHAR_ATA" ? `Fechar a ata de ${codigo}` : `Iniciar a reunião de ${codigo}`}
          description={confirmar === "FECHAR_ATA" ? "A ata é congelada com hora de início e fechamento, presentes e cada linha conferida. A OS v1 é gerada a partir dela." : "Registra a hora de início. Os envios de necessidades ficam bloqueados enquanto a reunião acontece."}
          confirmLabel={confirmar === "FECHAR_ATA" ? "Fechar ata e gerar OS" : "Iniciar reunião"}
          action={transicionarEventoAction}
          hidden={{ eventoId, acao: confirmar }}
          onSuccess={() => {
            // Ata fechada: a OS v1 acabou de nascer, é o que a logística quer ver em seguida.
            if (confirmar === "FECHAR_ATA") router.push(`/eventos/${eventoId}/os`);
          }}
        >
          {confirmar === "FECHAR_ATA" && <Aviso>As áreas são notificadas e, a partir daqui, mudanças entram como solicitação de alteração.</Aviso>}
        </ConfirmDialog>
      )}
    </BannerEscuro>
  );
}
