"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "@/components/ui/icons";

/**
 * Controle dentro de uma linha clicável (`LinhaLink`): cliques e teclas daqui — inclusive de dentro de um modal aberto
 * por ele, que no React sobem pela árvore de componentes — não abrem a linha.
 */
export function SemCliqueDaLinha({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={className} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </span>
  );
}

/**
 * Item com vários locais na lista do evento: a linha do total (nome, quantidade somada, "N locais") abre e fecha as
 * linhas de cada local. Começa aberta com poucos locais; com muitos, fechada — a lista continua lida num relance.
 * Clicar em qualquer ponto da linha do total também abre/fecha (menos nos botões dela).
 */
export function ItemComLocais({
  nome,
  detalhe,
  resumoCelular,
  celulas,
  nLocais,
  inicialAberto,
  children,
}: {
  nome: string;
  /** Texto curto ao lado do nome (ex.: "7 fechamentos · 1 calha"). */
  detalhe?: React.ReactNode;
  /** Linha de baixo quando a lista é estreita (as colunas Local e Área somem). */
  resumoCelular?: string;
  /** As outras células da linha do total (quantidade, local, área, ações). */
  celulas: React.ReactNode;
  nLocais: number;
  inicialAberto: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(inicialAberto);
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-subtle"
        onClick={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest("a,button,input,[role=dialog]")) return;
          setAberto((v) => !v);
        }}
      >
        <th scope="row" className="max-w-0 border-b border-line-row py-2 pl-cartao pr-3 text-left font-normal">
          <span className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => setAberto((v) => !v)}
              className="-ml-1.5 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-controle border-0 bg-transparent px-1.5 py-0.5 text-left text-corpo font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent max-md:min-h-10"
            >
              <Icone nome="chevron-direita" className={cn("size-3.5 shrink-0 text-ink-3 transition-transform duration-150", aberto && "rotate-90")} />
              <span className="truncate" title={nome}>
                {nome}
              </span>
              <span className="sr-only">
                , {nLocais} {nLocais === 1 ? "local" : "locais"}
              </span>
            </button>
            {detalhe && <span className="hidden shrink-0 text-pequeno text-ink-3 @lg:inline">{detalhe}</span>}
          </span>
          {/* Celular: sem as colunas Local e Área, o resumo ("2 locais · 7 fechamentos") desce para baixo do nome. */}
          {resumoCelular && <span className="block truncate pl-5 text-pequeno text-ink-2 @lg:hidden">{resumoCelular}</span>}
        </th>
        {celulas}
      </tr>
      {/* As linhas de cada local continuam na mesma tabela, logo abaixo do total. */}
      {aberto ? children : null}
    </>
  );
}
