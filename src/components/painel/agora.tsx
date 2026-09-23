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
  detalhe?: React.ReactNode;
  href: string;
  /** Verbo do link ("Ver atrasadas", "Abrir conferência"). No celular fica só a seta. */
  rotuloAcao: string;
};

/* O tom tinge só o ícone: um nível de destaque por cartão. */
const TOM_ICONE: Record<TomAgora, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
  neutro: "bg-neutral-bg text-ink-3",
};

function CartaoAcao({ a }: { a: AcaoAgora }) {
  return (
    <Link
      href={a.href}
      className="group flex min-h-16 items-center gap-3 rounded-cartao border border-line bg-surface px-4 py-3 no-underline transition-colors hover:border-line-strong hover:bg-subtle"
    >
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-controle", TOM_ICONE[a.tom])}>
        <Icone nome={a.icone} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 text-corpo text-ink">
          {a.n != null && <span className="numero text-titulo font-semibold tracking-[-0.01em]">{a.n}</span>}
          <span className="min-w-0 truncate font-medium">{a.titulo}</span>
        </span>
        {a.detalhe && <span className="block truncate text-pequeno text-muted">{a.detalhe}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-pequeno font-medium text-accent">
        <span className="hidden group-hover:underline sm:inline">{a.rotuloAcao}</span>
        <IndicadorLink />
        <Icone nome="chevron-direita" className="text-ink-3 sm:text-accent" />
      </span>
    </Link>
  );
}

/**
 * Topo do painel: o que precisa da pessoa agora, com contagem e link direto.
 * Sem nada pendente, uma linha só dizendo isso (sem cartões vazios).
 */
export function Agora({ acoes, vazio }: { acoes: AcaoAgora[]; vazio: { titulo: string; descricao: string } }) {
  return (
    <section aria-labelledby="painel-agora" className="mb-6">
      <h2 id="painel-agora" className="m-0 mb-2.5 text-secao font-semibold tracking-[-0.01em] text-ink">
        Precisa de você agora
      </h2>
      {acoes.length === 0 ? (
        <div className="flex items-center gap-3 rounded-cartao border border-line bg-surface px-4 py-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-controle bg-success-bg text-success">
            <Icone nome="check-circulo" />
          </span>
          <span className="min-w-0">
            <span className="block text-corpo font-medium text-ink">{vazio.titulo}</span>
            <span className="block text-pequeno text-muted">{vazio.descricao}</span>
          </span>
        </div>
      ) : (
        <ul className={cn("m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2", acoes.length >= 3 && "xl:grid-cols-3")}>
          {acoes.map((a) => (
            <li key={a.chave} className="min-w-0">
              <CartaoAcao a={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
