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
          "flex w-full items-center gap-[5px] whitespace-nowrap px-3 py-[9px] text-[11.5px] no-underline",
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
    <th scope="col" className={cn("border-b border-line-soft bg-subtle px-3 py-[9px] text-[11.5px] font-medium text-muted first:pl-[18px] last:pr-[18px]", className)} style={{ width: largura, textAlign: alinhar }}>
      {children}
    </th>
  );
}

/** Rodapé de paginação (#faf8f8): "1–8 de 10" + Anterior / Próxima. */
export function Paginacao({ total, pagina, paginas, de, porPagina, hrefPagina }: { total: number; pagina: number; paginas: number; de: number; porPagina: number; hrefPagina: (p: number) => string }) {
  if (total <= porPagina) return null;
  const btn = "flex h-7 items-center rounded-[7px] border border-line-strong bg-surface px-2.5 text-[12.5px] no-underline";
  return (
    <div className="flex items-center gap-2 bg-subtle px-[18px] py-[11px]">
      <span className="flex-1 text-[12.5px] text-muted">
        {de + 1}–{Math.min(de + porPagina, total)} de {total}
      </span>
      {pagina > 1 ? (
        <Link href={hrefPagina(pagina - 1)} scroll={false} className={cn(btn, "text-ink hover:bg-subtle")}>
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(btn, "cursor-not-allowed text-on-dark-4")}>
          Anterior
        </span>
      )}
      {pagina < paginas ? (
        <Link href={hrefPagina(pagina + 1)} scroll={false} className={cn(btn, "text-ink hover:bg-subtle")}>
          Próxima
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(btn, "cursor-not-allowed text-on-dark-4")}>
          Próxima
        </span>
      )}
    </div>
  );
}
