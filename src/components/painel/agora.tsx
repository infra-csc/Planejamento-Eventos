import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { IndicadorLink } from "@/components/ui/indicador-link";

export type TomAgora = "danger" | "warning" | "info" | "neutro";

/** Uma ação que depende da pessoa agora: contagem, o que é, e o link direto para resolver. */
export type AcaoAgora = {
  chave: string;
  icone: NomeIcone;
  tom: TomAgora;
  /** Contagem em destaque (algarismos tabulares). Sem ela, o título fala sozinho (ex.: reunião às 14:00). */
  n?: React.ReactNode;
  titulo: string;
  /** Detalhe curto (texto): fica na mesma linha no desktop e corta com reticências (inteiro no `title`). */
  detalhe?: string;
  href: string;
};

/* O tom tinge só o ícone: a linha inteira continua neutra. */
const TOM_ICONE: Record<TomAgora, string> = {
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  neutro: "text-ink-3",
};

/**
 * Topo do painel: o que precisa da pessoa agora, uma linha por assunto (contagem, o que é, detalhe) dentro de
 * um cartão só. Antes eram cartões de 90–110 px com um link de texto repetindo o destino ("Ver eventos") e
 * deixavam um cartão órfão na segunda fileira. Sem nada pendente, uma linha dizendo isso.
 */
export function Agora({ acoes, vazio, titulo = "Precisa de você agora" }: { acoes: AcaoAgora[]; vazio: { titulo: string; descricao: string }; titulo?: string }) {
  return (
    <section aria-labelledby="painel-agora" className="mb-5">
      <h2 id="painel-agora" className="m-0 mb-2 text-secao font-semibold tracking-[-0.01em] text-ink">
        {titulo}
      </h2>
      {acoes.length === 0 ? (
        <p className="m-0 flex items-center gap-2.5 rounded-cartao border border-line bg-surface px-cartao py-3 text-corpo text-ink">
          <Icone nome="check-circulo" className="shrink-0 text-success" />
          <span className="font-medium">{vazio.titulo}</span>
          <span className="hidden min-w-0 truncate text-pequeno text-muted sm:inline">{vazio.descricao}</span>
        </p>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-cartao border border-line bg-surface p-0">
          {acoes.map((a) => (
            <li key={a.chave} className="border-b border-line-row last:border-b-0">
              <Link
                href={a.href}
                className="group relative flex min-h-11 items-center gap-3 px-cartao py-2.5 no-underline transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <Icone nome={a.icone} className={cn("shrink-0", TOM_ICONE[a.tom])} />
                <span className="min-w-0 flex-1 md:flex md:items-baseline md:gap-3">
                  <span className="block shrink-0 text-corpo text-ink">
                    {a.n != null && <span className="numero mr-1.5 font-semibold">{a.n}</span>}
                    <span className="font-medium">{a.titulo}</span>
                  </span>
                  {a.detalhe && (
                    <span className="block min-w-0 truncate text-pequeno text-muted" title={a.detalhe}>
                      {a.detalhe}
                    </span>
                  )}
                </span>
                <IndicadorLink />
                <Icone nome="chevron-direita" className="shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
