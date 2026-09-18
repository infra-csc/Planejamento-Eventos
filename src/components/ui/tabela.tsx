import Link from "next/link";
import { cn } from "@/lib/cn";

/** Caption visualmente oculta, exigida pelo handoff (§8) em toda tabela. */
export function CaptionOculta({ children }: { children: React.ReactNode }) {
  return <caption className="sr-only">{children}</caption>;
}

/**
 * Cabeçalho ordenável (handoff §5.9): aria-sort no <th> e um controle real dentro dele.
 * O estado vive na URL (?ordem=&dir=), então a ordenação sobrevive a recarregar e compartilhar o link.
 */
export function ThOrdenavel({
  label,
  ativo,
  dir,
  href,
  largura,
  alinhar = "left",
}: {
  label: string;
  ativo: boolean;
  dir?: "asc" | "desc" | null;
  href: string;
  largura?: number | string;
  alinhar?: "left" | "right";
}) {
  const ariaSort = ativo ? (dir === "desc" ? "descending" : "ascending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className="border-b border-line-soft bg-subtle p-0 font-medium" style={{ width: largura, textAlign: alinhar }}>
      <Link
        href={href}
        scroll={false}
        className={cn(
          "flex w-full items-center gap-[5px] whitespace-nowrap px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.06em] no-underline",
          ativo ? "text-ink" : "text-muted hover:text-ink",
          alinhar === "right" ? "justify-end" : "justify-start",
        )}
      >
        {label}
        <span className="font-mono">{ativo ? (dir === "desc" ? "↓" : "↑") : ""}</span>
      </Link>
    </th>
  );
}

export function Th({ children, largura, alinhar = "left", className }: { children?: React.ReactNode; largura?: number | string; alinhar?: "left" | "right"; className?: string }) {
  return (
    <th scope="col" className={cn("border-b border-line-soft bg-subtle px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.06em] text-muted first:pl-cartao last:pr-cartao", className)} style={{ width: largura, textAlign: alinhar }}>
      {children}
    </th>
  );
}

/** Páginas a mostrar: primeira, última e vizinhas da atual; o resto vira reticências. */
export function paginasVisiveis(pagina: number, paginas: number): Array<number | "…"> {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const meio = [pagina - 1, pagina, pagina + 1].filter((p) => p > 1 && p < paginas);
  const lista: Array<number | "…"> = [1];
  if (meio[0] > 2) lista.push("…");
  lista.push(...meio);
  if (meio[meio.length - 1] < paginas - 1) lista.push("…");
  lista.push(paginas);
  return lista;
}

/** Rodapé de paginação: "Mostrando 1 a 25 de 97" + páginas numeradas com anterior/próxima. */
export function Paginacao({ total, pagina, paginas, de, porPagina, hrefPagina }: { total: number; pagina: number; paginas: number; de: number; porPagina: number; hrefPagina: (p: number) => string }) {
  if (total <= porPagina) return null;
  const caixa = "grid h-8 min-w-8 place-items-center border-l border-line-strong px-2 text-pequeno tabular-nums no-underline first:border-l-0";
  const seta = (dir: "ant" | "prox") => (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "ant" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-cartao py-3">
      <span className="text-pequeno text-muted">
        Mostrando <span className="font-medium text-ink">{de + 1}</span> a <span className="font-medium text-ink">{Math.min(de + porPagina, total)}</span> de <span className="font-medium text-ink">{total}</span>
      </span>
      <nav aria-label="Paginação" className="flex overflow-hidden rounded-controle border border-line-strong bg-surface">
        {pagina > 1 ? (
          <Link href={hrefPagina(pagina - 1)} scroll={false} aria-label="Página anterior" className={cn(caixa, "text-ink-2 hover:bg-subtle")}>
            {seta("ant")}
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(caixa, "cursor-not-allowed text-meta")}>
            {seta("ant")}
          </span>
        )}
        {paginasVisiveis(pagina, paginas).map((p, i) =>
          p === "…" ? (
            <span key={"r" + i} aria-hidden className={cn(caixa, "text-meta")}>
              …
            </span>
          ) : p === pagina ? (
            <span key={p} aria-current="page" className={cn(caixa, "bg-accent-bg font-semibold text-accent")}>
              {p}
            </span>
          ) : (
            <Link key={p} href={hrefPagina(p)} scroll={false} aria-label={"Página " + p} className={cn(caixa, "text-ink-2 hover:bg-subtle")}>
              {p}
            </Link>
          ),
        )}
        {pagina < paginas ? (
          <Link href={hrefPagina(pagina + 1)} scroll={false} aria-label="Próxima página" className={cn(caixa, "text-ink-2 hover:bg-subtle")}>
            {seta("prox")}
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(caixa, "cursor-not-allowed text-meta")}>
            {seta("prox")}
          </span>
        )}
      </nav>
    </div>
  );
}
