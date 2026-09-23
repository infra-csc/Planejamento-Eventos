"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import "./globals.css";

/**
 * Erro no layout raiz: substitui o documento inteiro, então precisa de <html> e <body> próprios.
 * Sem fontes do layout (Geist cai no fallback do sistema); o resto dos tokens vem do globals.css.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body>
        <title>Erro · Norte Mkt</title>
        <main className="flex min-h-screen items-center justify-center bg-page px-6">
          <div role="alert" className="max-w-[440px]">
            <div className="mb-6 flex items-center gap-2.5">
              <span aria-hidden className="block size-[18px] rounded-chip bg-accent" />
              <span className="text-pequeno font-semibold uppercase tracking-[0.18em] text-ink">Norte Mkt</span>
            </div>
            <h1 className="m-0 text-pagina font-semibold tracking-[-0.025em]">Algo deu errado</h1>
            <p className="mb-0 mt-2 text-secao leading-relaxed text-ink-2">O sistema não conseguiu abrir esta tela. O erro foi registrado; tente de novo e, se continuar, avise o administrador.</p>
            {error.digest && <p className="mb-0 mt-1 font-mono text-rotulo text-muted">código {error.digest}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="primary" size="lg" onClick={reset}>
                Tentar de novo
              </Button>
              {/* <a> de propósito: recarrega o documento inteiro, que é o que resolve um erro no layout raiz. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={buttonClasses({ variant: "secondary", size: "lg", className: "no-underline" })}>
                Ir para o Painel
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
