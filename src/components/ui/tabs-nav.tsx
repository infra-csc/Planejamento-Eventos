"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type Aba = { href: string; label: string; n?: number | string | null; exact?: boolean };

/** Abas sublinhadas do evento (aba ativa com borda inferior #8e2740). */
export function TabsNav({ tabs, className }: { tabs: Aba[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("mb-5 flex gap-0.5 overflow-x-auto border-b border-line", className)} aria-label="Seções do evento">
      {tabs.map((t) => {
        const ativo = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-2 px-3.5 py-[9px] text-[13.5px] no-underline",
              ativo ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {t.n != null && t.n !== 0 && t.n !== "" && (
              <span className={cn("rounded-[5px] px-1.5 py-px font-mono text-[11px]", ativo ? "bg-accent-bg text-accent" : "bg-neutral-bg text-muted")}>{t.n}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
