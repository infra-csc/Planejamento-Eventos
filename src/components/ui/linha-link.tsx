"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

function deveIgnorar(alvo: EventTarget | null) {
  return alvo instanceof HTMLElement && Boolean(alvo.closest("a,button,input,select,textarea,label"));
}

/**
 * Linha de tabela clicável (handoff §8): role="link", tabIndex 0, Enter/Espaço abrem.
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
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </tr>
  );
}
