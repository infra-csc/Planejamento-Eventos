"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { alterarAtivoProjetoAction } from "@/app/(app)/projetos/actions";

export function AtivoToggle({ id, ativo }: { id: string; ativo: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {ativo ? "Inativar" : "Reativar"}
      </Button>
      {open && (
        <ConfirmDialog
          open
          onOpenChange={setOpen}
          title={ativo ? "Inativar projeto" : "Reativar projeto"}
          description={ativo ? "Projetos inativos não podem entrar em novas solicitações. Eventos existentes mantêm suas linhas." : "O projeto voltará a aparecer nas listas de seleção."}
          confirmLabel={ativo ? "Inativar" : "Reativar"}
          danger={ativo}
          action={alterarAtivoProjetoAction}
          hidden={{ id, ativo: String(!ativo) }}
        />
      )}
    </>
  );
}
