import { connection } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, pecas, projetos } from "@/server/db/schema";
import { Numero } from "@/components/ui/numero";

async function numeros() {
  try {
    const db = await getDb();
    const [[ev], [pc], [pj]] = await Promise.all([
      db.select({ n: count() }).from(eventos).where(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])),
      db.select({ n: count() }).from(pecas).where(eq(pecas.ativo, true)),
      db.select({ n: count() }).from(projetos).where(and(eq(projetos.ativo, true))),
    ]);
    return { eventos: Number(ev.n), pecas: Number(pc.n), projetos: Number(pj.n) };
  } catch {
    return null;
  }
}

/** Tela de entrada (handoff §5.1): painel escuro à esquerda, formulário à direita. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Renderização por requisição: a CSP com nonce (proxy.ts) só é aplicada em páginas dinâmicas —
  // uma página pré-gerada no build sairia sem nonce e o navegador bloquearia os scripts dela.
  await connection();
  const n = await numeros();
  return (
    <div className="grid min-h-screen bg-page lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col justify-between gap-8 bg-dark px-6 py-6 text-white sm:px-10 lg:px-16 lg:py-14">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="block size-[22px] rounded-chip bg-accent-light" />
          <span className="text-corpo font-semibold uppercase tracking-[0.18em] text-white">Norte Mkt</span>
        </div>
        <div className="max-w-[440px] max-lg:hidden">
          <p className="mb-5 mt-0 text-metrica font-semibold tracking-[-0.03em]">Da reunião de OS ao caminhão carregado, em um só lugar.</p>
          <p className="m-0 text-secao leading-relaxed text-on-dark-3">Catálogo de peças, projetos padrão, ata da reunião, OS gerada automaticamente e solicitações respondidas item a item.</p>
        </div>
        <div className="flex gap-10 text-corpo text-on-dark-3 max-lg:hidden">
          {n && (
            <>
              <span>
                <Numero valor={n.eventos} className="block text-metrica text-accent-light" />
                eventos ativos
              </span>
              <span>
                <Numero valor={n.pecas} className="block text-metrica text-white" />
                peças no catálogo
              </span>
              <span>
                <Numero valor={n.projetos} className="block text-metrica text-white" />
                projetos padrão
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[352px] animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
