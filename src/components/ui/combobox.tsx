"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { combinaBusca, relevanciaBusca } from "@/lib/busca";
import { Icone } from "./icons";

export type OpcaoCombo = { value: string; label: string; descricao?: string; selo?: string; seloTom?: "accent" | "warning" | "muted"; disabled?: boolean };

const TOM = { accent: "bg-accent-bg text-accent", warning: "bg-warning-bg text-warning", muted: "bg-neutral-bg text-ink-3" } as const;

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
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
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
  /* Vêm do <Field>: erro, dica e obrigatório chegam ao campo (auditoria 28/10 nº 63). */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
}) {
  const uid = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const invalido = invalid || ariaInvalid === true || ariaInvalid === "true";
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
    // Filtra e ordena pela relevância (o nome que começa pelo termo primeiro); empate fica na ordem alfabética.
    return base
      .filter((o) => combinaBusca(`${o.label} ${o.descricao ?? ""}`, t))
      .map((o, i) => ({ o, i, r: relevanciaBusca(o.label, t) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.o);
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

  // Esc com a lista aberta fecha só a lista. O diálogo (Radix) escuta o Esc no document, na captura, antes do
  // campo: a escuta na janela vem antes dele e o `preventDefault` faz o diálogo ignorar este Esc. Antes o Esc
  // fechava o diálogo inteiro e o que já fora preenchido se perdia (auditoria 28/10 nº 142).
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.activeElement !== inputRef.current) return;
      e.preventDefault();
      setAberto(false);
      setBusca("");
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [aberto]);

  useLayoutEffect(() => {
    if (!aberto) return;
    let quadro = 0;
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
      // Celular: o diálogo sobe da borda de baixo (animação). Campo focado ao abrir era medido no meio da subida:
      // a lista abria para cima, com a altura de antes, e passava do topo da tela, cobrindo o título e as
      // primeiras opções (auditoria 28/10 nº 12). Enquanto o diálogo se move, mede de novo a cada quadro.
      if (modal?.getAnimations?.().some((a) => a.playState === "running")) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      cancelAnimationFrame(quadro);
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

  // Quantas opções sobraram com o que foi digitado: o leitor de tela não via a lista mudar (auditoria 28/10 nº 137).
  const filtrando = aberto && busca.trim() !== "" && busca !== selecionada?.label;
  const anuncio = !filtrando ? "" : visiveis.length === 0 ? "Nada encontrado" : visiveis.length === 1 ? "1 opção" : `${visiveis.length} opções`;

  return (
    <div ref={raiz} className={cn("relative", className)}>
      <span aria-live="polite" className="sr-only">
        {anuncio}
      </span>
      <div ref={campoRef} className="relative">
        <Icone nome="busca" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={`${uid}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && visiveis[indice] ? `${uid}-opcao-${indice}` : undefined}
          aria-invalid={invalido || undefined}
          aria-required={ariaRequired || undefined}
          aria-describedby={describedBy}
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
            // Foco: borda + anel da marca, como os outros campos (auditoria 28/10 nº 135).
            "h-[34px] w-full rounded-controle border border-line-control bg-surface pl-9 pr-9 text-corpo text-ink transition-[color,border-color,box-shadow] duration-150 placeholder:text-meta hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent max-md:h-10",
            "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger-input",
          )}
        />
        <Icone nome="chevron-baixo" className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 transition-transform duration-150", aberto && "rotate-180")} />
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
                  "flex cursor-pointer items-center gap-2.5 rounded-controle px-2.5 py-2 text-corpo max-md:min-h-10",
                  i === indice && "opcao-ativa",
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
                {o.selo && <span className={cn("numero shrink-0 rounded-chip px-1.5 py-px text-rotulo font-medium", TOM[o.seloTom ?? "muted"])}>{o.selo}</span>}
                {o.value === value && (
                  <Icone nome="check" className="text-accent" />
                )}
              </li>
            ))}
          </ul>,
          pos.alvo,
        )}
    </div>
  );
}
