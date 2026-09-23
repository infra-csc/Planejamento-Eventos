import { cn } from "@/lib/cn";

/**
 * Total de uma lista anunciado ao leitor de tela quando muda (filtro, aba, busca, página).
 * "12 solicitações", "1 evento" — `complemento` acrescenta o recorte ("· Atrasadas").
 *
 * A região `aria-live` só anuncia MUDANÇAS de um elemento que já estava no DOM: ponha-a no
 * cabeçalho do cartão da lista, fora de blocos condicionais (vazio/cheio), para que o mesmo
 * elemento sobreviva entre renders — páginas server re-renderizam na navegação por filtro e o
 * React só troca o texto. `oculto` quando a contagem já está visível (ex.: contador nas abas).
 */
export function ContagemAoVivo({
  n,
  singular,
  plural,
  complemento,
  oculto,
  className,
}: {
  n: number;
  singular: string;
  plural: string;
  complemento?: string | null;
  oculto?: boolean;
  className?: string;
}) {
  const texto = `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}${complemento ? ` · ${complemento}` : ""}`;
  return (
    <p aria-live="polite" aria-atomic="true" className={cn("m-0", oculto ? "sr-only" : "numero text-pequeno text-muted", className)}>
      {texto}
    </p>
  );
}
