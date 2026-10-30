"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const nada = () => () => undefined;
const lugar = () => document.querySelector<HTMLElement>("[data-acoes-pagina]");

/**
 * Põe a ação principal de uma aba no cabeçalho da página (`PageHeader`, à direita do título), onde ficam as
 * ações de todas as listas. O cabeçalho mora no layout das abas e a ação (com o seu diálogo e estado) na aba:
 * Ativação › Estoque ("Novo item") e Carga › Calendário ("Novo veículo") a deixavam na barra de filtros
 * (auditoria 28/10 nº 54). Ao sair da aba, a ação some do cabeçalho junto.
 */
export function AcaoNoCabecalho({ children }: { children: React.ReactNode }) {
  // Depois da hidratação: no servidor não há cabeçalho onde pôr (o botão aparece um instante depois da página).
  const alvo = useSyncExternalStore(nada, lugar, () => null);
  return alvo ? createPortal(children, alvo) : null;
}
