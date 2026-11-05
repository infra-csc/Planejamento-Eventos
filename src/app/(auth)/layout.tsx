import { connection } from "next/server";

/**
 * Tela de entrada: logo no alto, um cartão só com o formulário e o fundo cinza do app. Sem painel escuro ao lado, que é o
 * desenho do sistema da gráfica (o Miró). O canto laranja é o mesmo detalhe do item escolhido no menu.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Renderização por requisição: a CSP com nonce (proxy.ts) só é aplicada em páginas dinâmicas —
  // uma página pré-gerada no build sairia sem nonce e o navegador bloquearia os scripts dela.
  await connection();
  return (
    <div className="flex min-h-screen flex-col items-center bg-page px-4 py-8 sm:py-12">
      <main className="my-auto flex w-full max-w-[400px] flex-col gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nortelog.svg" alt="NorteLog" className="block h-9 w-auto self-start" />
        <div className="relative animate-fade-up rounded-cartao border border-line bg-surface p-6 shadow-card sm:p-8">
          <span aria-hidden className="canto-marca !size-5 !rounded-tr-cartao" />
          {children}
        </div>
        <p className="m-0 text-pequeno text-ink-3">Da reunião de OS ao caminhão carregado, em um só lugar.</p>
      </main>
    </div>
  );
}
