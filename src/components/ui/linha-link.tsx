"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Children, cloneElement, Fragment, isValidElement, useTransition, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

function deveIgnorar(alvo: EventTarget | null) {
  return alvo instanceof HTMLElement && Boolean(alvo.closest("a,button,input,select,textarea,label"));
}

const novaAba = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

/**
 * Coloca `link` no começo da primeira célula (<td>/<th>) de `filhos`, atravessando fragmentos.
 * Devolve `null` quando não há célula direta (ex.: células vindas de um componente próprio).
 */
function comLinkNaPrimeiraCelula(filhos: ReactNode, link: ReactElement): ReactNode | null {
  let feito = false;
  const percorrer = (no: ReactNode): ReactNode =>
    Children.map(no, (filho) => {
      if (feito || !isValidElement<{ children?: ReactNode }>(filho)) return filho;
      if (filho.type === Fragment) return cloneElement(filho, undefined, percorrer(filho.props.children));
      if (filho.type === "td" || filho.type === "th") {
        feito = true;
        const conteudo = filho.props.children;
        return cloneElement(filho, undefined, link, ...(Array.isArray(conteudo) ? conteudo : [conteudo]));
      }
      return filho;
    });
  const resultado = percorrer(filhos);
  return feito ? resultado : null;
}

/**
 * Linha de tabela clicável (handoff §8). A linha inteira responde ao clique; para teclado e leitor
 * de tela há um link de verdade (visualmente oculto) na primeira célula, com `rotulo` como nome —
 * o contorno de foco dele aparece na linha toda (globals.css). Ctrl/⌘ + clique e clique do meio
 * abrem em nova aba, como um link comum. Cliques em controles internos (links, botões) não
 * disparam a navegação da linha.
 */
export function LinhaLink({ href, rotulo, className, children, scroll = true }: { href: string; rotulo: string; className?: string; children: React.ReactNode; /** false: não rola ao topo (seleção na mesma tela). */ scroll?: boolean }) {
  const router = useRouter();
  // Em dev a rota pode levar segundos para compilar: a linha mostra que está abrindo.
  const [abrindo, iniciar] = useTransition();
  const abrir = () => iniciar(() => router.push(href, { scroll }));
  // A linha não é <a>: ao passar o mouse ou focar, a rota já começa a vir.
  const prefetch = () => router.prefetch(href);

  const link = (
    <Link
      key="linha-link"
      href={href}
      scroll={scroll}
      data-linha-link=""
      className="sr-only"
      onClick={(e) => {
        // Clique simples (ou Enter): navega pela transição, para a linha mostrar "abrindo".
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        abrir();
      }}
    >
      {rotulo}
    </Link>
  );
  const celulas = comLinkNaPrimeiraCelula(children, link);

  const aoClicar = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (deveIgnorar(e.target)) return;
    if (e.metaKey || e.ctrlKey) novaAba(href);
    else abrir();
  };
  const aoClicarMeio = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (e.button !== 1 || deveIgnorar(e.target)) return;
    e.preventDefault();
    novaAba(href);
  };

  // Sem célula direta onde pôr o link: mantém a linha focável como antes.
  if (celulas === null) {
    return (
      <tr
        onPointerEnter={prefetch}
        onFocus={prefetch}
        role="link"
        tabIndex={0}
        aria-label={rotulo}
        aria-busy={abrindo || undefined}
        className={cn("cursor-pointer hover:bg-subtle", abrindo && "cursor-progress bg-selected opacity-70", className)}
        onClick={aoClicar}
        onAuxClick={aoClicarMeio}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) novaAba(href);
            else abrir();
          }
        }}
      >
        {children}
      </tr>
    );
  }

  return (
    <tr
      onPointerEnter={prefetch}
      onFocus={prefetch}
      aria-busy={abrindo || undefined}
      className={cn("cursor-pointer hover:bg-subtle", abrindo && "cursor-progress bg-selected opacity-70", className)}
      onClick={aoClicar}
      onAuxClick={aoClicarMeio}
    >
      {celulas}
    </tr>
  );
}
