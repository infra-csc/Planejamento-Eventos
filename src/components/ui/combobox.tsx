"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { combinaBusca } from "@/lib/busca";

export type OpcaoCombo = { value: string; label: string; descricao?: string; selo?: string; seloTom?: "accent" | "warning" | "muted"; disabled?: boolean };

const TOM = { accent: "bg-accent-bg text-accent", warning: "bg-warning-bg text-warning", muted: "bg-neutral-bg text-muted" } as const;

/**
 * Campo de busca com lista: digite para filtrar (nome, descrição), setas para navegar, Enter escolhe,
 * Esc fecha. Para listas longas (eventos, projetos) onde um <select> não dá conta.
 */
export function ComboBox({
  id,
  value,
  onChange,
  opcoes,
  placeholder = "Buscar…",
  disabled,
  invalid,
  className,
  ordenarAlfabetico = true,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string) => void;
  opcoes: OpcaoCombo[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  ordenarAlfabetico?: boolean;
}) {
  const uid = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const selecionada = opcoes.find((o) => o.value === value) ?? null;
  const visiveis = useMemo(() => {
    const base = ordenarAlfabetico ? [...opcoes].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })) : opcoes;
    const t = busca.trim().toLowerCase();
    // Com o rótulo do escolhido ainda no campo (logo após focar), mostra a lista inteira.
    if (!t || t === selecionada?.label.toLowerCase()) return base;
    return base.filter((o) => combinaBusca(`${o.label} ${o.descricao ?? ""}`, t));
  }, [opcoes, busca, ordenarAlfabetico, selecionada]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice, aberto]);

  const escolher = (o: OpcaoCombo) => {
    if (o.disabled) return;
    onChange(o.value);
    setBusca("");
    setAberto(false);
  };

  return (
    <div ref={raiz} className={cn("relative", className)}>
      <div className="relative">
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={id}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={`${uid}-lista`}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={aberto ? busca : (selecionada?.label ?? "")}
          placeholder={placeholder}
          onFocus={(e) => {
            // Ao focar com algo escolhido, o texto fica selecionado: digitar substitui, em vez de emendar.
            setBusca(selecionada?.label ?? "");
            setAberto(true);
            setIndice(Math.max(0, visiveis.findIndex((o) => o.value === value)));
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => {
            setBusca(e.target.value);
            setIndice(0);
            if (!aberto) setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAberto(true);
              setIndice((i) => Math.min(visiveis.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndice((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && aberto) {
              e.preventDefault();
              if (visiveis[indice]) escolher(visiveis[indice]);
            } else if (e.key === "Escape") {
              setAberto(false);
              setBusca("");
            }
          }}
          className={cn(
            "h-[38px] w-full rounded-lg border border-line-control bg-surface pl-9 pr-9 text-corpo text-ink placeholder:text-meta focus:border-accent focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger-input",
          )}
        />
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 transition-transform", aberto && "rotate-180")}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {aberto && (
        <ul
          ref={listaRef}
          id={`${uid}-lista`}
          role="listbox"
          className="absolute left-0 right-0 z-30 m-0 mt-1 max-h-[320px] list-none overflow-y-auto rounded-cartao border border-line-strong bg-surface p-1.5 shadow-popover animate-fade-up-rapido"
        >
          {visiveis.length === 0 && <li className="px-2.5 py-3 text-center text-pequeno text-muted">Nada encontrado para “{busca}”.</li>}
          {visiveis.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              data-indice={i}
              onMouseEnter={() => setIndice(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(o)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-controle px-2.5 py-2 text-corpo",
                i === indice && "bg-subtle",
                o.value === value && "font-medium",
                o.disabled && "cursor-not-allowed text-meta",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">{o.label}</span>
                {o.descricao && <span className="block truncate text-rotulo text-muted">{o.descricao}</span>}
              </span>
              {o.selo && <span className={cn("shrink-0 rounded-chip px-1.5 py-px text-micro font-medium", TOM[o.seloTom ?? "muted"])}>{o.selo}</span>}
              {o.value === value && (
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
