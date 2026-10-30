"use client";

import { useRef } from "react";

/**
 * Foco de volta para o cartão ou a linha que abriu o diálogo. Detalhe → Editar troca o conteúdo do mesmo
 * diálogo: o botão que abriu a edição some, e ao salvar o foco caía no <body> (auditoria 30/10, parte D N20).
 * `guardar` ignora o que já está dentro de um diálogo (fica quem abriu o primeiro); `devolver` foca depois que
 * o Radix termina de fechar.
 */
export function useFocoDeVolta() {
  const origem = useRef<HTMLElement | null>(null);
  return {
    guardar() {
      const ativo = document.activeElement;
      if (ativo instanceof HTMLElement && ativo !== document.body && !ativo.closest("[role=dialog]")) origem.current = ativo;
    },
    devolver() {
      const alvo = origem.current;
      origem.current = null;
      if (alvo) requestAnimationFrame(() => alvo.isConnected && alvo.focus({ preventScroll: true }));
    },
  };
}
