"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function TabsNav({ tabs, className }: { tabs: Array<{ href: string; label: string; count?: number; exact?: boolean }>; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("-mb-px flex gap-1 overflow-x-auto border-b border-line", className)} aria-label="Seções">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              active ? "border-brand text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink hover:border-line-strong",
            )}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && <span className="rounded-sm bg-black/5 px-1.5 text-xs text-ink-secondary tabular">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
