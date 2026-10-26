"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Children, cloneElement, Fragment, isValidElement, useTransition, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useSinalizarNavegacao } from "./navegacao";

function deveIgnorar(alvo: EventTarget | null) {
  return alvo instanceof HTMLElement && Boolean(alvo.closest("a,button,input,select,textarea,label"));
}

const novaAba = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

/** Célula escondida em alguma largura (`hidden sm:table-cell`, `max-md:hidden`): o link sumiria junto com ela. */
const someEmAlgumaLargura = (className: unknown) => typeof className === "string" && className.split(/s+/).some((c) => c === "hidden" || /^max-[a-z0-9]+:hidden$/.test(c));

/**
 * Coloca `link` no começo da primeira célula (<td>/<th>) de `filhos` que aparece em todas as larguras,
 * atravessando fragmentos (sem nenhuma assim, na primeira). Devolve `null` quando não há célula direta
 * (ex.: células vindas de um componente próprio).
 * Antes ia sempre na primeira: nas listas em que a coluna do código some no celular, o link sumia com ela
 * e teclado e leitor de tela não tinham como abrir a linha.
 */
function comLinkNaPrimeiraCelula(filhos: ReactNode, link: ReactElement): ReactNode | null {
  // 1º: onde pôr (pela posição, não pela identidade dos props, que não é garantida em elementos vindos do servidor).
  const celulas: Array<{ tipo: string; className?: unknown; scope?: unknown }> = [];
  const coletar = (no: ReactNode) =>
    Children.forEach(no, (filho) => {
      if (!isValidElement<{ children?: ReactNode; className?: unknown; scope?: unknown }>(filho)) return;
      if (filho.type === Fragment) coletar(filho.props.children);
      else if (filho.type === "td" || filho.type === "th") celulas.push({ tipo: filho.type, className: filho.props.className, scope: filho.props.scope });
    });
  coletar(filhos);
  if (!celulas.length) return null;
  const visiveis = celulas.map((c, i) => ({ ...c, i })).filter((c) => !someEmAlgumaLargura(c.className));
  // O cabeçalho da linha (nome do registro) é o melhor lugar; senão a primeira célula visível em todas as larguras.
  const alvo = (visiveis.find((c) => c.tipo === "th" && c.scope === "row") ?? visiveis[0])?.i ?? 0;
  // 2º: põe o link no começo dessa célula.
  let n = -1;
  let feito = false;
  const percorrer = (no: ReactNode): ReactNode =>
    Children.map(no, (filho) => {
      if (feito || !isValidElement<{ children?: ReactNode }>(filho)) return filho;
      if (filho.type === Fragment) return cloneElement(filho, undefined, percorrer(filho.props.children));
      if (filho.type === "td" || filho.type === "th") {
        n++;
        if (n !== alvo) return filho;
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
  // A barra fina do topo (e o anúncio "Carregando…") acompanham a abertura da linha.
  useSinalizarNavegacao(abrindo);
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
