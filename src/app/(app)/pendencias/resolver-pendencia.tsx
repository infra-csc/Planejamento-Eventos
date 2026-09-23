"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icone } from "@/components/ui/icons";
import { resolverPendenciaAction } from "./actions";

/** Botão "Marcar como resolvida" da lista de pendências: pede a observação e grava no histórico do item. */
export function ResolverPendencia({ itemId, codigo, descricao, faltante }: { itemId: string; codigo: string; descricao: string; faltante: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="secondary" size="xs" onClick={() => setAberto(true)}>
        <Icone nome="check" />
        Marcar como resolvida
      </Button>
      {aberto && (
        <ConfirmDialog
          open
          onOpenChange={setAberto}
          title={`Resolver pendência · ${codigo}`}
          description={`${descricao} — faltam ${faltante}. A pendência sai da lista, a observação fica no histórico do item e a área que pediu é avisada.`}
          confirmLabel="Marcar como resolvida"
          reasonLabel="Como foi resolvida"
          reasonPlaceholder="Ex.: 2 unidades locadas na Tendas Sul, entrega na véspera da montagem"
          action={resolverPendenciaAction}
          hidden={{ itemId }}
        />
      )}
    </>
  );
}
