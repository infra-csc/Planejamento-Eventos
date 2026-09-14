"use client";

import { useSyncExternalStore } from "react";

type ItemToast = { id: number; mensagem: string; desfazer?: () => void | Promise<void> };

let atual: ItemToast | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const ouvintes = new Set<() => void>();

function emitir() {
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/**
 * Toast escuro do handoff (§6): canto inferior direito, 5s, com "Desfazer" opcional.
 * Um por vez — o novo substitui o anterior.
 */
export function toast(mensagem: string, opcoes?: { desfazer?: () => void | Promise<void>; duracao?: number }) {
  if (timer) clearTimeout(timer);
  atual = { id: ++seq, mensagem, desfazer: opcoes?.desfazer };
  emitir();
  timer = setTimeout(() => {
    atual = null;
    emitir();
  }, opcoes?.duracao ?? 5000);
}

export function fecharToast() {
  if (timer) clearTimeout(timer);
  atual = null;
  emitir();
}

export function Toaster() {
  const t = useSyncExternalStore(
    assinar,
    () => atual,
    () => null,
  );
  return (
    <div aria-live="polite" role="status" className="no-print">
      {t && (
        <div key={t.id} className="fixed bottom-6 right-6 z-[70] flex max-w-[520px] animate-fade-up-rapido items-center gap-2.5 rounded-[10px] bg-dark px-4 py-3 text-white shadow-[0_12px_32px_rgba(42,20,24,.28)]">
          <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-accent-light" />
          <span className="text-[13.5px]">{t.mensagem}</span>
          {t.desfazer && (
            <button
              type="button"
              onClick={async () => {
                const f = t.desfazer;
                fecharToast();
                await f?.();
              }}
              className="ml-1.5 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-accent-light underline"
            >
              Desfazer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
