import { cn } from "@/lib/cn";
import { formatarData, formatarDataHora } from "@/lib/format";

/**
 * Números, datas e códigos (docs/design-system.md § Números e datas).
 *
 *  - Números e datas: fonte normal com algarismos tabulares (utilitário `numero`), para as colunas
 *    alinharem sem o peso visual do mono.
 *  - Códigos (SOL-0001, EVT-0002, código de peça): mono. Só eles.
 *
 * Em JSX que já formata o valor, basta a classe: <td className="numero text-right">…</td>.
 */

const FORMATO = new Intl.NumberFormat("pt-BR");

/** Número formatado em pt-BR (1.234), tabular. `unidade` vem depois, em cor de apoio. */
export function Numero({ valor, unidade, className }: { valor: number | null | undefined; unidade?: string; className?: string }) {
  return (
    <span className={cn("numero", className)}>
      {valor == null ? "—" : FORMATO.format(valor)}
      {unidade && valor != null && <span className="text-muted"> {unidade}</span>}
    </span>
  );
}

/** Data (ISO "aaaa-mm-dd" ou Date) em dd/mm/aaaa — com `hora`, dd/mm/aa hh:mm. Em <time> com dateTime. */
export function Data({ valor, hora, className }: { valor: string | Date | null | undefined; hora?: boolean; className?: string }) {
  if (!valor) return <span className={cn("numero", className)}>—</span>;
  const iso = typeof valor === "string" ? valor : valor.toISOString();
  const texto = hora || typeof valor !== "string" ? formatarDataHora(valor) : formatarData(valor);
  return (
    <time dateTime={iso} className={cn("numero", className)}>
      {texto}
    </time>
  );
}

/** Código de registro (SOL-0001, EVT-0002, código de peça): mono, sem quebra. */
export function Codigo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap font-mono", className)}>{children}</span>;
}
