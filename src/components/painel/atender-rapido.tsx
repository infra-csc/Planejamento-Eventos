"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Icone } from "@/components/ui/icons";
import { toast, toastErro, toastSucesso } from "@/components/ui/toast";
import { desfazerRespostaAction, responderItemAction } from "@/app/(app)/solicitacoes/actions";

/** Faixa de ação rápida da fila (handoff §5.2): solicitação com um único item pendente. */
export function AtenderRapido({ itemId, codigo, rotulo, href, sufixo }: { itemId: string; codigo: string; rotulo: string; href: string; sufixo: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="mt-2.5 flex flex-col gap-2 rounded-controle border border-line-soft bg-subtle px-3 py-2 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 items-center gap-2 text-pequeno text-ink-2">
        <Icone nome="caixa" className="text-ink-3" />
        <span className="min-w-0 truncate" title={rotulo}>
          {rotulo}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Button
          variant="atender"
          size="xs"
          loading={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await responderItemAction(itemId, { status: "ATENDIDO" });
              if (!r.ok) {
                toastErro(r.erro);
                return;
              }
              toastSucesso(`${codigo} respondida — item atendido, ${sufixo}`, {
                desfazer: async () => {
                  const u = await desfazerRespostaAction(itemId);
                  if (u.ok) toast("Resposta desfeita");
                  else toastErro(u.erro);
                },
              });
            })
          }
        >
          <Icone nome="check" />
          Atender
        </Button>
        <Link href={href} className={buttonClasses({ variant: "secondary", size: "xs", className: "font-normal no-underline" })}>
          Parcial / não atender
        </Link>
      </span>
    </div>
  );
}
