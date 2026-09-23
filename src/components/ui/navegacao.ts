"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Sinal global de "navegação em andamento" (docs/design-system.md § Carregamento).
 *
 * Quem sabe que uma navegação está pendente avisa aqui: os indicadores de link (useLinkStatus),
 * as transições de LinhaLink/BuscaUrl/FiltroEvento e o clique em link interno capturado pela
 * barra do shell. A barra fina no topo e o anúncio "Carregando…" do leitor de tela leem daqui.
 */
let fontes = 0;
let clique = false;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};
const pendente = () => fontes > 0 || clique;

/** Registra uma fonte pendente enquanto `ativo` for verdadeiro. */
export function useSinalizarNavegacao(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    fontes++;
    emitir();
    return () => {
      fontes--;
      emitir();
    };
  }, [ativo]);
}

/** Clique num link interno: pendente até a URL mudar (limparCliqueNavegacao) ou o tempo-limite. */
let limite: ReturnType<typeof setTimeout> | null = null;
export function marcarCliqueNavegacao() {
  clique = true;
  if (limite) clearTimeout(limite);
  // Rede de segurança: um link que não navega (preventDefault, mesma URL) não prende a barra.
  limite = setTimeout(limparCliqueNavegacao, 8000);
  emitir();
}

export function limparCliqueNavegacao() {
  if (limite) clearTimeout(limite);
  limite = null;
  if (!clique) return;
  clique = false;
  emitir();
}

export function useNavegacaoPendente() {
  return useSyncExternalStore(assinar, pendente, () => false);
}
