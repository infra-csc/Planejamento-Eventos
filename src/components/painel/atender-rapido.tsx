"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { toast } from "@/components/ui/toast";
import { desfazerRespostaAction, responderItemAction } from "@/app/(app)/solicitacoes/actions";

/** Faixa de ação rápida da fila (handoff §5.2): solicitação com um único item pendente. */
export function AtenderRapido({ itemId, codigo, rotulo, href, sufixo }: { itemId: string; codigo: string; rotulo: string; href: string; sufixo: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="mt-[9px] flex items-center gap-2 rounded-lg border border-line-soft bg-subtle px-[11px] py-2">
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{rotulo}</span>
      <Button
        variant="atender"
        size="xs"
        loading={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await responderItemAction(itemId, { status: "ATENDIDO" });
            if (!r.ok) {
              toast(r.erro);
              return;
            }
            toast(`${codigo} respondida — item atendido, ${sufixo}`, {
              desfazer: async () => {
                const u = await desfazerRespostaAction(itemId);
                toast(u.ok ? "Resposta desfeita" : u.erro);
              },
            });
          })
        }
      >
        Atender
      </Button>
      <Link href={href} className={buttonClasses({ variant: "secondary", size: "xs", className: "font-normal no-underline" })}>
        Parcial / recusar
      </Link>
    </div>
  );
}
