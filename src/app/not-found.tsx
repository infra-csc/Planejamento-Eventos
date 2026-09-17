import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-6">
      <div className="max-w-[420px] animate-fade-up">
        <div className="mb-6 flex items-center gap-2.5">
          <span aria-hidden className="block size-[18px] rounded-chip bg-accent" />
          <span className="text-pequeno font-semibold uppercase tracking-[0.18em] text-ink">Norte Mkt</span>
        </div>
        <p className="m-0 font-mono text-pequeno text-muted">erro 404</p>
        <h1 className="mb-0 mt-1 text-pagina font-semibold tracking-[-0.025em]">Página não encontrada</h1>
        <p className="mb-0 mt-2 text-secao leading-[1.55] text-ink-2">O endereço pode estar errado, ou o registro foi excluído. Eventos e solicitações canceladas continuam acessíveis pela busca.</p>
        <Link href="/" className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-corpo font-medium text-white no-underline hover:bg-accent-hover">
          Voltar para o painel
        </Link>
      </div>
    </div>
  );
}
