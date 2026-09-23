"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Erro ao montar uma versão para impressão (OS, ata, arena): mensagem, "Tentar de novo" e volta ao app. */
export default function ErroImpressao({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-4xl px-4">
      <title>Erro na impressão · Norte Mkt</title>
      <div role="alert" className="max-w-[640px] rounded-cartao border border-danger-border bg-danger-bg px-5 py-4">
        <h1 className="m-0 text-secao font-semibold text-danger">Não foi possível montar a versão para impressão</h1>
        <p className="mb-0 mt-1 text-corpo text-ink-2">
          O erro foi registrado. Tente de novo; se continuar, avise o administrador.
          {error.digest && <span className="mt-1 block font-mono text-rotulo text-muted">código {error.digest}</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="md" onClick={reset}>
            Tentar de novo
          </Button>
          <Link href="/" className="link text-corpo">
            Voltar para o painel
          </Link>
        </div>
      </div>
    </div>
  );
}
