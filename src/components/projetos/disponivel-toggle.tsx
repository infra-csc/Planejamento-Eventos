"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { alterarDisponivelProjetoAction } from "@/app/(app)/projetos/actions";

/** Tira/põe o projeto nas listas de seleção das solicitações (ele continua ativo na biblioteca). */
export function DisponivelToggle({ id, disponivel }: { id: string; disponivel: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button abreDialogo variant="ghost" onClick={() => setOpen(true)}>
        {disponivel ? "Tirar das solicitações" : "Liberar nas solicitações"}
      </Button>
      {open && (
        <ConfirmDialog
          open
          onOpenChange={setOpen}
          title={disponivel ? "Tirar das solicitações" : "Liberar nas solicitações"}
          description={
            disponivel
              ? "O projeto continua na biblioteca, mas deixa de aparecer nas listas de seleção das solicitações. Eventos existentes mantêm suas linhas."
              : "O projeto volta a aparecer nas listas de seleção das solicitações."
          }
          // O botão diz o que faz, não só "Tirar"/"Liberar" (auditoria 28/10, nº 161).
          confirmLabel={disponivel ? "Tirar das solicitações" : "Liberar nas solicitações"}
          action={alterarDisponivelProjetoAction}
          hidden={{ id, disponivel: String(!disponivel) }}
        />
      )}
    </>
  );
}
