"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { alterarAtivoPecaAction } from "@/app/(app)/catalogo/actions";

export function PecaAtivoBotao({ id, ativo, nome }: { id: string; ativo: boolean; nome: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className={ativo ? "text-danger" : ""} onClick={() => setOpen(true)}>
        {ativo ? "Inativar" : "Reativar"}
      </Button>
      {open && (
        <ConfirmDialog
          open
          onOpenChange={setOpen}
          title={`${ativo ? "Inativar" : "Reativar"} ${nome}`}
          description={ativo ? "Peças inativas não podem entrar em novos projetos nem em solicitações. Se estiver no BOM de um projeto ativo, a inativação é bloqueada." : "A peça volta a aparecer nas seleções."}
          confirmLabel={ativo ? "Inativar" : "Reativar"}
          danger={ativo}
          action={alterarAtivoPecaAction}
          hidden={{ id, ativo: String(!ativo) }}
        />
      )}
    </>
  );
}
