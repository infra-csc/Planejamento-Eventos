"use client";

import { useEffect } from "react";

/**
 * Abaixo de `lg` o painel de detalhe fica depois da lista inteira: ao escolher um item (`?p=`), rola
 * até ele. No desktop o painel já está ao lado (fixo no topo), então nada acontece.
 * `selecionado` é o id vindo da URL; sem seleção explícita, não rola.
 */
export function RolarAoSelecionar({ alvoId, selecionado }: { alvoId: string; selecionado: string | undefined }) {
  useEffect(() => {
    if (!selecionado || !window.matchMedia("(max-width: 1023.98px)").matches) return;
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
  }, [alvoId, selecionado]);
  return null;
}
