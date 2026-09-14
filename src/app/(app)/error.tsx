"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";

export default function ErroApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const semConexao = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <EmptyState
      title={semConexao ? "Sem conexão com a internet" : "Algo deu errado ao carregar esta página"}
      description={semConexao ? "Verifique sua rede e tente novamente." : "O erro foi registrado. Tente novamente; se persistir, avise o administrador."}
      action={
        <Button variant="primary" onClick={reset}>
          Tentar novamente
        </Button>
      }
    />
  );
}
