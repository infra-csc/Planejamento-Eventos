"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type TipoToast = "info" | "erro";
type ItemToast = { id: number; mensagem: string; tipo: TipoToast; desfazer?: () => void | Promise<void>; restante: number; inicio: number | null };

const MAXIMO = 3;
let lista: ItemToast[] = [];
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const ouvintes = new Set<() => void>();

function emitir() {
  lista = [...lista];
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function agendar(t: ItemToast) {
  t.inicio = Date.now();
  timers.set(
    t.id,
    setTimeout(() => remover(t.id), t.restante),
  );
}

function remover(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  lista = lista.filter((t) => t.id !== id);
  emitir();
}

/** Pausa todos os toasts enquanto o mouse ou o foco estão sobre eles (WCAG 2.2.1). */
function pausar() {
  for (const t of lista) {
    const timer = timers.get(t.id);
    if (!timer || t.inicio == null) continue;
    clearTimeout(timer);
    timers.delete(t.id);
    t.restante = Math.max(1500, t.restante - (Date.now() - t.inicio));
    t.inicio = null;
  }
}

function retomar() {
  for (const t of lista) if (!timers.has(t.id)) agendar(t);
}

/**
 * Toast escuro do handoff (§6): canto inferior direito, com "Desfazer" opcional.
 * Empilha até 3 (um novo não apaga o "Desfazer" do anterior), pausa no hover/foco e aceita Ctrl+Z.
 */
export function toast(mensagem: string, opcoes?: { desfazer?: () => void | Promise<void>; duracao?: number; tipo?: TipoToast }) {
  const item: ItemToast = {
    id: ++seq,
    mensagem,
    tipo: opcoes?.tipo ?? "info",
    desfazer: opcoes?.desfazer,
    restante: opcoes?.duracao ?? (opcoes?.desfazer ? 8000 : 5000),
    inicio: null,
  };
  lista = [...lista, item];
  while (lista.length > MAXIMO) {
    const velho = lista[0];
    remover(velho.id);
  }
  agendar(item);
  emitir();
}

export function toastErro(mensagem: string) {
  toast(mensagem, { tipo: "erro", duracao: 7000 });
}

export function fecharToast() {
  for (const t of lista) remover(t.id);
}

async function executarDesfazer(t: ItemToast) {
  const f = t.desfazer;
  remover(t.id);
  await f?.();
}

export function Toaster() {
  const itens = useSyncExternalStore(
    assinar,
    () => lista,
    () => lista,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (/^(input|textarea|select)$/i.test(alvo.tagName) || alvo.isContentEditable)) return;
      const ultimo = [...lista].reverse().find((t) => t.desfazer);
      if (!ultimo) return;
      e.preventDefault();
      void executarDesfazer(ultimo);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div aria-live="polite" role="status" className="no-print">
      {itens.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[var(--z-toast)] flex max-w-[520px] flex-col items-end gap-2" onMouseEnter={pausar} onMouseLeave={retomar} onFocus={pausar} onBlur={retomar}>
          {itens.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex animate-fade-up-rapido items-center gap-2.5 rounded-cartao px-4 py-3 text-white shadow-toast",
                t.tipo === "erro" ? "bg-danger" : "bg-dark",
              )}
              role={t.tipo === "erro" ? "alert" : undefined}
            >
              <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", t.tipo === "erro" ? "bg-white" : "bg-accent-light")} />
              <span className="text-corpo">{t.mensagem}</span>
              {t.desfazer && (
                <button
                  type="button"
                  onClick={() => void executarDesfazer(t)}
                  className={cn("ml-1.5 cursor-pointer border-0 bg-transparent p-0 text-corpo font-medium underline", t.tipo === "erro" ? "text-white" : "text-accent-light")}
                  title="Desfazer (Ctrl+Z)"
                >
                  Desfazer
                </button>
              )}
              <button type="button" onClick={() => remover(t.id)} aria-label="Fechar aviso" className="-mr-1 ml-1 cursor-pointer border-0 bg-transparent px-1 text-destaque leading-none text-white/60 hover:text-white">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
