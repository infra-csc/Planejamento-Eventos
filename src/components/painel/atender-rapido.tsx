"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { toast, toastErro, toastSucesso } from "@/components/ui/toast";
import { desfazerRespostaAction, responderItemAction } from "@/app/(app)/solicitacoes/actions";
import { focarConteudoSePerdido } from "@/components/shell/foco";

/**
 * Atender rápido na fila do painel (solicitação com um único item pendente): um botão de ícone na coluna de
 * ações, com o item no nome e no `title`. Parcial e não atender pedem motivo: abrem pela própria linha.
 */
export function AtenderRapido({ itemId, codigo, rotulo, sufixo }: { itemId: string; codigo: string; rotulo: string; sufixo: string }) {
  const [pendente, iniciar] = useTransition();
  const nome = `Atender ${rotulo}`;
  return (
    <Button
      variant="atender"
      size="xs"
      aria-label={nome}
      title={nome}
      className="w-7 px-0 max-md:w-10"
      loading={pendente}
      onClick={(e) => {
        // A linha sai da fila com o próprio botão: o foco vai para a linha seguinte (ou a anterior), não para o
        // <body> — quem atende pelo teclado continua na fila (auditoria 30/10, parte A N8).
        const linha = e.currentTarget.closest("tr");
        const vizinha = (linha?.nextElementSibling ?? linha?.previousElementSibling) as HTMLElement | null;
        iniciar(async () => {
          const r = await responderItemAction(itemId, { status: "ATENDIDO" });
          if (!r.ok) {
            toastErro(r.erro);
            return;
          }
          (vizinha?.querySelector<HTMLElement>("a[href], button:not([disabled])") ?? null)?.focus({ preventScroll: true });
          if (!vizinha) focarConteudoSePerdido();
          toastSucesso(`${codigo} respondida: ${rotulo} atendido, ${sufixo}`, {
            desfazer: async () => {
              const u = await desfazerRespostaAction(itemId);
              if (u.ok) toast("Resposta desfeita");
              else toastErro(u.erro);
            },
          });
        });
      }}
    >
      <Icone nome="check" />
    </Button>
  );
}
