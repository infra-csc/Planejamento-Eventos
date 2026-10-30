"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";

/*
 * "Novo item" no cabeçalho da Ativação, como a ação principal das outras listas (Eventos, Solicitações, Biblioteca),
 * em vez de na barra de filtros (auditoria 28/10, nº 54). O cabeçalho é do layout das abas e o diálogo é da tela do
 * estoque: o botão avisa por um evento da página, sem navegar (navegar recarregaria o estoque inteiro).
 */
const EVENTO = "ativacao:novo-item";

/** Registra quem abre o diálogo de novo item; devolve a função que desfaz o registro. */
export function aoPedirNovoItem(abrir: () => void) {
  window.addEventListener(EVENTO, abrir);
  return () => window.removeEventListener(EVENTO, abrir);
}

/** Só na aba Estoque (as outras abas têm a própria ação). */
export function BotaoNovoItemEstoque() {
  const caminho = usePathname();
  if (caminho !== "/ativacao") return null;
  return (
    <Button variant="primary" size="lg" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(EVENTO))}>
      <Icone nome="mais" />
      Novo item
    </Button>
  );
}
