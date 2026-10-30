"use client";

import { useEffect, useRef } from "react";

/**
 * Depois de gravar e fechar o diálogo, a lista recarrega e o botão que abriu pode sumir (o retorno vai para
 * "registrados", a reforma concluída sai da tabela): o foco caía no <body> e quem usa teclado voltava ao topo
 * (auditoria 30/10, parte C N20). `pedir(alvos)` guarda para onde ir; quando `dados` muda (a lista recarregou) e o
 * foco está perdido, vai para o primeiro alvo que ainda existe.
 */
export function useFocoAposAtualizar(dados: unknown) {
  const alvos = useRef<string[] | null>(null);
  useEffect(() => {
    const lista = alvos.current;
    if (!lista) return;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && ativo.isConnected) return;
    alvos.current = null;
    for (const seletor of lista) {
      const el = document.querySelector<HTMLElement>(seletor);
      if (el) {
        el.focus({ preventScroll: false });
        return;
      }
    }
  }, [dados]);
  return (seletores: string[]) => {
    alvos.current = seletores;
  };
}
