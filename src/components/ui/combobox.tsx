"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { combinaBusca } from "@/lib/busca";

export type OpcaoCombo = { value: string; label: string; descricao?: string; selo?: string; seloTom?: "accent" | "warning" | "muted"; disabled?: boolean };

const TOM = { accent: "bg-accent-bg text-accent", warning: "bg-warning-bg text-warning", muted: "bg-neutral-bg text-muted" } as const;

type Posicao = { left: number; width: number; top?: number; bottom?: number; max: number; alvo: HTMLElement };

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
  const campoRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  // A lista vai num portal (no body, ou dentro do modal quando o campo está num) e flutua presa ao
  // campo: assim não é cortada por cartões com overflow escondido e, sem espaço embaixo, abre para cima.
  const [pos, setPos] = useState<Posicao | null>(null);

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
      const alvo = e.target as Node;
      if (!raiz.current?.contains(alvo) && !listaRef.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      const campo = campoRef.current;
      if (!campo) return;
      const r = campo.getBoundingClientRect();
      // O modal é centralizado com translate: lá dentro, position: fixed é relativo a ele.
      const modal = campo.closest<HTMLElement>("[role=dialog]");
      const base = modal ? modal.getBoundingClientRect() : { left: 0, top: 0, bottom: window.innerHeight };
      const abaixo = window.innerHeight - r.bottom - 12;
      const acima = r.top - 12;
      const alvo = modal ?? document.body;
      if (abaixo >= 220 || abaixo >= acima) setPos({ left: r.left - base.left, width: r.width, top: r.bottom - base.top + 4, max: Math.min(320, Math.max(120, abaixo)), alvo });
      else setPos({ left: r.left - base.left, width: r.width, bottom: base.bottom - r.top + 4, max: Math.min(320, acima), alvo });
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto]);

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice, aberto, pos]);

  const escolher = (o: OpcaoCombo) => {
    if (o.disabled) return;
    onChange(o.value);
    setBusca("");
    setAberto(false);
  };

  return (
    <div ref={raiz} className={cn("relative", className)}>
      <div ref={campoRef} className="relative">
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
          aria-activedescendant={aberto && visiveis[indice] ? `${uid}-opcao-${indice}` : undefined}
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
          onBlur={(e) => {
            // Tab para fora (ou foco em outro campo): fecha a lista. Clique numa opção não tira o foco (mousedown cancelado).
            if (raiz.current?.contains(e.relatedTarget as Node | null)) return;
            setAberto(false);
            setBusca("");
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
            "h-[34px] w-full rounded-controle border border-line-control bg-surface pl-9 pr-9 text-corpo text-ink placeholder:text-meta focus:border-accent focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger-input",
          )}
        />
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 transition-transform", aberto && "rotate-180")}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {aberto &&
        pos &&
        createPortal(
          <ul
            ref={listaRef}
            id={`${uid}-lista`}
            role="listbox"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }}
            className="fixed z-[calc(var(--z-dialogo)+2)] m-0 list-none overflow-y-auto rounded-cartao border border-line-strong bg-surface p-1.5 shadow-popover animate-fade-up-rapido"
          >
            {visiveis.length === 0 && <li className="px-2.5 py-3 text-center text-pequeno text-muted">Nada encontrado para “{busca}”.</li>}
            {visiveis.map((o, i) => (
              <li
                key={o.value}
                id={`${uid}-opcao-${i}`}
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
                  <span className="block truncate text-ink" title={o.label}>
                    {o.label}
                  </span>
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
          </ul>,
          pos.alvo,
        )}
    </div>
  );
}
