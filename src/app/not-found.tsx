import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Erro 404</p>
      <h1 className="mt-2 text-lg font-semibold text-ink">Página não encontrada</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">O endereço pode estar errado ou o registro foi removido.</p>
      <Link href="/" className="mt-5 text-sm text-info hover:underline">
        Voltar para o painel
      </Link>
    </div>
  );
}
