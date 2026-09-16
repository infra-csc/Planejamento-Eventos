"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Aviso } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { TRANSICOES_EVENTO, type AcaoEvento } from "@/domain/evento";
import { transicionarEventoAction } from "@/app/(app)/eventos/actions";
import type { EventoStatus, Perfil } from "@/server/db/schema";

/**
 * Botões do cabeçalho do evento conforme perfil e fase (handoff §5.4).
 * Ações bloqueadas aparecem no estilo "bloqueado" e explicam o que falta num toast.
 */
export function AcoesEvento({
  evento,
  perfil,
  podeSolicitar,
  pendentesPreReuniao,
  solicitacoesAbertas,
}: {
  evento: { id: string; codigo: string; nome: string; status: EventoStatus };
  perfil: Perfil;
  podeSolicitar: boolean;
  pendentesPreReuniao: number;
  solicitacoesAbertas: string[];
}) {
  const [acao, setAcao] = useState<AcaoEvento | null>(null);
  const t = acao ? TRANSICOES_EVENTO[acao] : null;
  const base = `/eventos/${evento.id}`;

  const botoes: React.ReactNode[] = [];
  // Administrador tem acesso total: vê os botões da Logística e o de reabrir da Gestão.
  const admin = perfil === "ADMIN";
  if (perfil === "LOGISTICA" || admin) {
    if (evento.status === "PREPARACAO") {
      botoes.push(
        <Button key="iniciar" variant="primary" size="lg" onClick={() => setAcao("INICIAR_REUNIAO")}>
          Iniciar reunião
        </Button>,
      );
    }
    if (evento.status === "EM_REUNIAO") {
      botoes.push(
        <ButtonLink key="consolidar" href={`${base}/reuniao`} variant="primary" size="lg" className="no-underline">
          Consolidar ata
        </ButtonLink>,
      );
      botoes.push(
        pendentesPreReuniao > 0 ? (
          <Button key="fechar" variant="secondary" size="lg" aria-disabled="true" className="cursor-not-allowed text-meta" onClick={() => toast(`Ainda há ${pendentesPreReuniao} ${pendentesPreReuniao === 1 ? "item" : "itens"} sem resposta — responda todos para fechar a ata`)}>
            Fechar ata
          </Button>
        ) : (
          <Button key="fechar" variant="secondary" size="lg" onClick={() => setAcao("FECHAR_ATA")}>
            Fechar ata
          </Button>
        ),
      );
    }
    if (evento.status === "ABERTO") {
      botoes.push(
        solicitacoesAbertas.length > 0 ? (
          <Button
            key="encerrar"
            variant="bloqueado"
            size="lg"
            aria-disabled="true"
            onClick={() => toast(`Responda ou devolva ${solicitacoesAbertas.join(", ")} antes de encerrar`)}
          >
            Encerrar para alterações
          </Button>
        ) : (
          <Button key="encerrar" variant="primary" size="lg" onClick={() => setAcao("ENCERRAR")}>
            Encerrar para alterações
          </Button>
        ),
      );
    }
    if (evento.status !== "CANCELADO" && evento.status !== "ENCERRADO") {
      botoes.push(
        <ButtonLink key="editar" href={`${base}/editar`} variant="secondary" size="lg" className="no-underline">
          Editar
        </ButtonLink>,
      );
    }
  }
  if ((perfil === "GESTAO" || admin) && evento.status === "ENCERRADO") {
    botoes.push(
      <Button key="reabrir" variant="secondary" size="lg" onClick={() => setAcao("REABRIR")}>
        Reabrir em exceção
      </Button>,
    );
  }
  if (podeSolicitar && (evento.status === "PREPARACAO" || evento.status === "ABERTO")) {
    // Uma tela tem um primário: se já há ação de logística em destaque (admin vê as duas), solicitar vira secundário.
    const jaTemPrimario = botoes.some((b) => (b as React.ReactElement<{ variant?: string }>).props.variant === "primary");
    botoes.push(
      <ButtonLink key="solicitar" href={`/solicitacoes/nova?evento=${evento.id}`} variant={jaTemPrimario ? "secondary" : "primary"} size="lg" className="no-underline">
        {evento.status === "PREPARACAO" ? "Enviar necessidades" : "Solicitar alteração"}
      </ButtonLink>,
    );
  }

  return (
    <>
      {botoes}
      {acao && t && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAcao(null)}
          title={`${t.label} · ${evento.codigo}`}
          description={t.descricao}
          confirmLabel={acao === "FECHAR_ATA" ? "Fechar ata e gerar OS" : t.label}
          danger={acao === "CANCELAR"}
          reasonLabel={t.exigeJustificativa ? (acao === "REABRIR" ? "Justificativa da exceção" : "Justificativa") : undefined}
          action={transicionarEventoAction}
          hidden={{ eventoId: evento.id, acao }}
        >
          {acao === "ENCERRAR" && <Aviso>Depois do encerramento, nenhuma solicitação nova entra. Só a Gestão reabre, em exceção e com justificativa.</Aviso>}
          {acao === "FECHAR_ATA" && <Aviso>A ata é congelada e a OS de cada setor é gerada a partir dela. As áreas são notificadas.</Aviso>}
          {acao === "INICIAR_REUNIAO" && <Aviso>Os envios de necessidades ficam bloqueados enquanto a reunião acontece. Rascunhos das áreas continuam salvos.</Aviso>}
          {acao === "REABRIR" && <Aviso tom="warning">O evento volta a aceitar alterações. A reabertura fica marcada no evento e no histórico.</Aviso>}
        </ConfirmDialog>
      )}
    </>
  );
}
