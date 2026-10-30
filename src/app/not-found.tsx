import type { Metadata } from "next";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/ui/botao-voltar";
import { Icone } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Não encontrado" };

/**
 * 404 fora do shell (endereço que não é de nenhuma rota): tela cheia, curta, com a marca.
 * Renderizada a cada requisição: estática, saía sem o nonce da CSP e o navegador bloqueava os scripts dela.
 */
export default async function NotFound() {
  await connection();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4">
      <div className="flex w-full max-w-md animate-fade-up flex-col items-center text-center">
        <div className="mb-8 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/selo-app.svg" alt="" aria-hidden width={24} height={24} className="block size-6 shrink-0" />
          <span className="text-pequeno font-semibold uppercase tracking-[0.18em] text-ink">Norte Mkt</span>
        </div>
        <span aria-hidden className="mb-4 grid size-11 place-items-center rounded-full bg-surface text-ink-3">
          <Icone nome="busca" tamanho={20} />
        </span>
        <p className="m-0 mb-1 text-pequeno text-muted">
          Erro <span className="numero">404</span>
        </p>
        {/* Mesmo título, tamanho e texto do 404 de dentro do app (eram dois desenhos; auditoria 28/10, nº 58). */}
        <h1 className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">Não encontrado</h1>
        <p className="m-0 mt-1.5 text-corpo text-ink-2">Esta página ou registro não existe, foi excluído ou o endereço está incompleto.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/" variant="primary" size="lg" className="no-underline">
            Ir para o painel
          </ButtonLink>
          <BotaoVoltar />
        </div>
      </div>
    </main>
  );
}
