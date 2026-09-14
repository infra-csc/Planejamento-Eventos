"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "./field";
import { Button } from "./button";
import { cn } from "@/lib/cn";

/** Barra de filtros que sincroniza com a URL (permite abrir link direto com filtros). */
export function FiltersBar({
  search,
  selects = [],
  className,
}: {
  search?: { name: string; placeholder: string };
  selects?: Array<{ name: string; label: string; options: Array<{ value: string; label: string }>; all?: string }>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [busca, setBusca] = useState(params.get(search?.name ?? "q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    start(() => router.replace(`${pathname}?${next.toString()}`));
  };

  useEffect(() => {
    if (!search) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if ((params.get(search.name) ?? "") !== busca) set(search.name, busca);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const temFiltro = [...params.keys()].some((k) => k !== "pagina");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} aria-busy={pending}>
      {search && (
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input aria-label={search.placeholder} placeholder={search.placeholder} value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
      )}
      {selects.map((s) => (
        <Select key={s.name} aria-label={s.label} value={params.get(s.name) ?? ""} onChange={(e) => set(s.name, e.target.value)} className="w-auto min-w-40">
          <option value="">{s.all ?? `${s.label}: todos`}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
      {temFiltro && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setBusca("");
            start(() => router.replace(pathname));
          }}
        >
          <X className="size-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
