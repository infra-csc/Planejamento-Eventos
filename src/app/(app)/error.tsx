"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";

/** Erro de dados dentro do shell: ícone, uma frase, "Tentar de novo" e o código do erro para o suporte. */
export default function ErroApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const semConexao = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center sm:py-20">
      <span aria-hidden className="mb-4 grid size-11 place-items-center rounded-full bg-danger-bg text-danger">
        <Icone nome={semConexao ? "alerta" : "erro"} tamanho={20} />
      </span>
      <h1 className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">{semConexao ? "Sem conexão com a internet" : "Não foi possível carregar esta página"}</h1>
      <p className="m-0 mt-1.5 text-corpo text-ink-2">{semConexao ? "Verifique sua rede e tente de novo." : "O erro foi registrado. Tente de novo; se continuar, avise o administrador."}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="primary" size="lg" onClick={reset}>
          Tentar de novo
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg" className="no-underline">
          Ir para o painel
        </ButtonLink>
      </div>
      {error.digest && (
        <p className="m-0 mt-4 text-pequeno text-muted">
          Código do erro <Codigo className="text-ink-2">{error.digest}</Codigo>
        </p>
      )}
    </div>
  );
}
