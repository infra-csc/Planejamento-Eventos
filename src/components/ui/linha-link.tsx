"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

function deveIgnorar(alvo: EventTarget | null) {
  return alvo instanceof HTMLElement && Boolean(alvo.closest("a,button,input,select,textarea,label"));
}

const novaAba = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

/**
 * Linha de tabela clicável (handoff §8): role="link", tabIndex 0, Enter/Espaço abrem.
 * Ctrl/⌘ + clique e clique do meio abrem em nova aba, como um link comum.
 * Cliques em controles internos (links, botões) não disparam a navegação da linha.
 */
export function LinhaLink({ href, rotulo, className, children }: { href: string; rotulo: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={rotulo}
      className={cn("cursor-pointer hover:bg-subtle", className)}
      onClick={(e) => {
        if (deveIgnorar(e.target)) return;
        if (e.metaKey || e.ctrlKey) novaAba(href);
        else router.push(href);
      }}
      onAuxClick={(e) => {
        if (e.button !== 1 || deveIgnorar(e.target)) return;
        e.preventDefault();
        novaAba(href);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) novaAba(href);
          else router.push(href);
        }
      }}
    >
      {children}
    </tr>
  );
}
