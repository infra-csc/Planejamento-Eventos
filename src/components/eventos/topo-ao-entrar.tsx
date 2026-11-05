"use client";

import { useEffect } from "react";

/**
 * Ao entrar num evento vindo de uma linha mais abaixo na lista, a página abria já rolada, com o cabeçalho e o "Editar" escondidos.
 * Fica no layout do evento: só roda na entrada, e trocar de aba ou de filtro não mexe na rolagem. Link com âncora (#itens) segue valendo.
 */
export function TopoAoEntrar() {
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0 });
  }, []);
  return null;
}
