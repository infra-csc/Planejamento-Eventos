import Link from "next/link";
import { Icone } from "@/components/ui/icons";
import { Section } from "@/components/ui/layout";

export type Exportacao = {
  href: string;
  rotulo: string;
  /** Uma linha: o que vem no arquivo. */
  descricao?: string;
  /** "xlsx" baixa o arquivo; "imprimir" abre a página de impressão em outra aba. */
  tipo: "xlsx" | "imprimir";
};

/**
 * Exportações agrupadas num bloco só (OS, ata): cada uma é uma linha com ícone, nome, formato e
 * uma frase do conteúdo. Nenhuma é `primary` — a ação principal da tela fica em outro lugar.
 */
export function Exportacoes({ titulo = "Exportar", sub, itens, className }: { titulo?: string; sub?: React.ReactNode; itens: Exportacao[]; className?: string }) {
  return (
    <Section titulo={titulo} sub={sub} className={className}>
      <ul className="m-0 list-none p-0">
        {itens.map((x) => {
          const conteudo = (
            <>
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-controle border border-line bg-subtle text-ink-3 transition-colors duration-150 group-hover:border-line-strong group-hover:text-ink">
                <Icone nome={x.tipo === "xlsx" ? "download" : "imprimir"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-corpo font-medium text-ink">{x.rotulo}</span>
                  <span className="text-rotulo text-muted">{x.tipo === "xlsx" ? ".xlsx" : "PDF"}</span>
                </span>
                {x.descricao && <span className="mt-0.5 block text-pequeno text-muted">{x.descricao}</span>}
              </span>
              <Icone nome={x.tipo === "xlsx" ? "download" : "link-externo"} className="mt-1 shrink-0 text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 max-md:hidden" />
            </>
          );
          const cls =
            "group flex items-start gap-3 border-b border-line-row px-cartao py-3 text-left no-underline transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-md:min-h-12";
          return (
            <li key={x.href} className="last:[&>*]:border-b-0">
              {x.tipo === "imprimir" ? (
                <Link href={x.href} target="_blank" className={cls}>
                  {conteudo}
                  <span className="sr-only"> (abre em outra aba)</span>
                </Link>
              ) : (
                <a href={x.href} className={cls}>
                  {conteudo}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
