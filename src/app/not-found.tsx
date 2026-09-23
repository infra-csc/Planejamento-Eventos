import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Página não encontrada" };

/** 404 fora do shell (endereço que não é de nenhuma rota): tela cheia, curta, com a marca. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4">
      <div className="flex w-full max-w-md animate-fade-up flex-col items-center text-center">
        <div className="mb-8 flex items-center gap-2.5">
          <span aria-hidden className="block size-4 rounded-chip bg-accent" />
          <span className="text-pequeno font-semibold uppercase tracking-[0.18em] text-ink">Norte Mkt</span>
        </div>
        <span aria-hidden className="mb-4 grid size-11 place-items-center rounded-full bg-surface text-ink-3">
          <Icone nome="busca" tamanho={20} />
        </span>
        <p className="m-0 mb-1 text-pequeno text-muted">
          Erro <span className="numero">404</span>
        </p>
        <h1 className="m-0 text-pagina font-semibold tracking-[-0.02em] text-ink">Página não encontrada</h1>
        <p className="m-0 mt-2 text-corpo text-ink-2">O endereço pode estar errado ou o registro foi excluído.</p>
        <ButtonLink href="/" variant="primary" size="lg" className="mt-6 no-underline">
          Ir para o painel
        </ButtonLink>
      </div>
    </main>
  );
}
