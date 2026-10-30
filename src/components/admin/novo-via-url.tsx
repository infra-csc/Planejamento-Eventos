"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";

const PARAM = "novo";

/** Liga/desliga `?novo=1` sem ida ao servidor (o Next sincroniza o History API com useSearchParams). */
function gravarPedido(atuais: string, pathname: string, pedir: boolean) {
  const next = new URLSearchParams(atuais);
  if (pedir) next.set(PARAM, "1");
  else next.delete(PARAM);
  const qs = next.toString();
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
}

/**
 * Ação "Novo…" do cabeçalho da administração. O modal de criação mora no painel (client), então o
 * botão só pede pela URL (`?novo=1`) — o que também mantém o link direto funcionando.
 */
export function BotaoNovo({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    // Criar leva o "+" em todo o app (auditoria 28/10 nº 115); abre o diálogo de criação.
    <Button variant="primary" size="lg" abreDialogo onClick={() => gravarPedido(params.toString(), pathname, true)}>
      <Icone nome="mais" />
      {children}
    </Button>
  );
}

/** Chama `abrir` quando a URL passa a pedir `?novo=1`; devolve a função que limpa o pedido ao fechar o modal. */
export function usePedidoNovo(abrir: () => void): () => void {
  const pathname = usePathname();
  const params = useSearchParams();
  const pedido = params.get(PARAM) === "1";
  const [visto, setVisto] = useState(false);
  if (pedido !== visto) {
    setVisto(pedido);
    if (pedido) abrir();
  }
  return () => {
    if (pedido) gravarPedido(params.toString(), pathname, false);
  };
}
