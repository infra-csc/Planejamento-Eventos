"use client";

import * as S from "@radix-ui/react-select";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./icons";

export type OpcaoSelect = { value: string; label: string; descricao?: string; disabled?: boolean };
export type GrupoSelect = { label: string; opcoes: OpcaoSelect[] };

/** Radix não aceita item com value vazio; a opção "vazia" da API vira este sentinela por dentro. */
const VAZIO = "\x00vazio";
const paraRadix = (v: string) => (v === "" ? VAZIO : v);
const deRadix = (v: string) => (v === VAZIO ? "" : v);
const ordenar = (l: OpcaoSelect[]) => [...l].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));

/**
 * Lista suspensa do app (substitui o <select> nativo): mesma altura, borda e foco dos campos,
 * lista estilizada, busca por teclado, opções em ordem alfabética por padrão e grupos com título.
 * Em formulários, `name` grava o valor num input escondido; o servidor valida como sempre.
 */
export function Select({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Selecione",
  opcoes,
  grupos,
  ordenarAlfabetico = true,
  disabled,
  invalid,
  className,
  tamanho = "md",
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  opcoes?: OpcaoSelect[];
  grupos?: GrupoSelect[];
  ordenarAlfabetico?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  tamanho?: "sm" | "md";
  "aria-describedby"?: string;
  /** Nome acessível quando não há <label> ligado pelo id (filtros soltos). */
  "aria-label"?: string;
}) {
  const [interno, setInterno] = useState(defaultValue);
  const controlado = value !== undefined;
  const atual = controlado ? value : interno;

  const lista = useMemo(() => {
    if (grupos) return grupos.map((g) => ({ ...g, opcoes: ordenarAlfabetico ? ordenar(g.opcoes) : g.opcoes })).filter((g) => g.opcoes.length > 0);
    const l = opcoes ?? [];
    // A opção vazia (ex.: "Logística (sem área)") fica sempre no topo.
    const vazia = l.filter((o) => o.value === "");
    const resto = l.filter((o) => o.value !== "");
    return [{ label: "", opcoes: [...vazia, ...(ordenarAlfabetico ? ordenar(resto) : resto)] }];
  }, [opcoes, grupos, ordenarAlfabetico]);

  const todas = lista.flatMap((g) => g.opcoes);
  const selecionada = todas.find((o) => o.value === atual);

  return (
    <>
      {name && <input type="hidden" name={name} value={atual} />}
      <S.Root
        value={paraRadix(atual)}
        onValueChange={(v) => {
          const novo = deRadix(v);
          if (!controlado) setInterno(novo);
          onValueChange?.(novo);
        }}
        disabled={disabled}
      >
        <S.Trigger
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          className={cn(
            "group flex w-full cursor-pointer items-center justify-between gap-2 rounded-controle border border-line-control bg-surface text-left text-corpo text-ink outline-none transition-colors",
            "hover:border-ink-3 focus-visible:border-accent data-[state=open]:border-accent",
            "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger-input data-[placeholder]:text-meta",
            tamanho === "sm" ? "h-8 px-2.5 text-pequeno max-md:h-10" : "h-[34px] px-3 max-md:h-10",
            className,
          )}
        >
          <span className="min-w-0 truncate">
            <S.Value placeholder={placeholder}>{selecionada?.label ?? placeholder}</S.Value>
          </span>
          <S.Icon asChild>
            <span className="shrink-0 text-ink-3 transition-transform duration-150 group-data-[state=open]:rotate-180">
              <Icone nome="chevron-baixo" />
            </span>
          </S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={4}
            className="z-[calc(var(--z-dialogo)+2)] max-h-[min(360px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[220px] overflow-hidden rounded-cartao border border-line-strong bg-surface shadow-popover animate-fade-up-rapido"
          >
            <S.ScrollUpButton className="flex h-6 items-center justify-center text-meta">
              <Icone nome="chevron-cima" />
            </S.ScrollUpButton>
            <S.Viewport className="p-1.5">
              {lista.map((g, gi) => (
                <S.Group key={g.label || gi}>
                  {g.label && <S.Label className="px-2.5 pb-1 pt-2 text-micro font-semibold uppercase tracking-[0.12em] text-meta">{g.label}</S.Label>}
                  {g.opcoes.map((o) => (
                    <S.Item
                      key={o.value || VAZIO}
                      value={paraRadix(o.value)}
                      disabled={o.disabled}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center gap-2 rounded-controle py-[7px] pl-8 pr-3 text-corpo text-ink outline-none focus:outline-none focus-visible:outline-none max-md:min-h-10",
                        "data-[highlighted]:opcao-ativa data-[state=checked]:font-medium data-[disabled]:cursor-not-allowed data-[disabled]:text-meta",
                        o.value === "" && "text-ink-3",
                      )}
                    >
                      <S.ItemIndicator className="absolute left-2.5 text-accent">
                        <Icone nome="check" />
                      </S.ItemIndicator>
                      <span className="min-w-0 flex-1">
                        <S.ItemText>{o.label}</S.ItemText>
                        {o.descricao && <span className="block text-rotulo text-muted">{o.descricao}</span>}
                      </span>
                    </S.Item>
                  ))}
                </S.Group>
              ))}
              {todas.length === 0 && <p className="m-0 px-2.5 py-3 text-center text-pequeno text-muted">Nada para escolher.</p>}
            </S.Viewport>
            <S.ScrollDownButton className="flex h-6 items-center justify-center text-meta">
              <Icone nome="chevron-baixo" />
            </S.ScrollDownButton>
          </S.Content>
        </S.Portal>
      </S.Root>
    </>
  );
}
