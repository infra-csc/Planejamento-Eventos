"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Erro de dados (handoff §6): card laranja com a mensagem e "Tentar de novo". */
export default function ErroApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const semConexao = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div role="alert" className="max-w-[640px] rounded-[10px] border border-danger-border bg-danger-bg px-5 py-4">
      <p className="m-0 text-[14px] font-semibold text-danger">{semConexao ? "Sem conexão com a internet" : "Não foi possível carregar esta página"}</p>
      <p className="mb-0 mt-1 text-[13px] leading-[1.5] text-ink-2">
        {semConexao ? "Verifique sua rede e tente de novo." : "O erro foi registrado. Tente de novo; se continuar, avise o administrador."}
        {error.digest && <span className="mt-1 block font-mono text-[11.5px] text-muted">código {error.digest}</span>}
      </p>
      <Button variant="secondary" size="md" onClick={reset} className="mt-3">
        Tentar de novo
      </Button>
    </div>
  );
}
