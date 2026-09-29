/**
 * Aviso informativo na hora de pedir: o mesmo projeto ou peça já foi pedido neste evento, por quem
 * e em que situação. Não bloqueia nada — só evita pedir em dobro sem saber.
 */
import { textoDescricoes } from "./descricoes-itens";

export type SituacaoPedido = "na ata" | "aguardando resposta" | "atendido" | "atendido em parte" | "incluído pela logística";

export type PedidoAnterior = {
  quantidade: number;
  area: string | null;
  pessoa: string | null;
  codigo: string | null;
  situacao: SituacaoPedido;
  /** Onde vai ficar (a mesma solicitação pode ter o item em vários locais). */
  destino?: string | null;
  /** Descrição de cada unidade, como quem pediu escreveu. */
  descricoes?: string[] | null;
};

/** Pedidos anteriores por evento e por referência (id do projeto ou da peça). */
export type PedidosPorEvento = Record<string, Record<string, PedidoAnterior[]>>;

/** Um pedido (solicitação, ou a inclusão direta da logística) com as linhas do item em cada local. */
export type GrupoPedido = {
  chave: string;
  codigo: string | null;
  area: string;
  pessoa: string | null;
  situacao: SituacaoPedido;
  total: number;
  linhas: Array<{ quantidade: number; destino: string | null; descricao: string | null }>;
};

/** Junta as linhas da mesma solicitação (itens por local viram linhas de um pedido só). */
export function agruparPedidos(pedidos: readonly PedidoAnterior[] | undefined): GrupoPedido[] {
  const grupos = new Map<string, GrupoPedido>();
  for (const p of pedidos ?? []) {
    const chave = p.codigo ?? `logistica:${p.pessoa ?? ""}`;
    const g = grupos.get(chave) ?? { chave, codigo: p.codigo, area: p.area ?? (p.situacao === "incluído pela logística" ? "Logística" : "—"), pessoa: p.pessoa, situacao: p.situacao, total: 0, linhas: [] };
    g.total += p.quantidade;
    g.linhas.push({ quantidade: p.quantidade, destino: p.destino?.trim() || null, descricao: textoDescricoes(p.descricoes, p.quantidade) });
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

/** Resumo de uma linha para o cartão: total e de quem ("SOL-0027 · Produção" ou "3 pedidos"). */
export function resumoJaPedido(pedidos: readonly PedidoAnterior[] | undefined): { total: number; grupos: GrupoPedido[]; quem: string } | null {
  const grupos = agruparPedidos(pedidos);
  if (!grupos.length) return null;
  const total = grupos.reduce((a, g) => a + g.total, 0);
  const quem = grupos.length === 1 ? [grupos[0].codigo, grupos[0].area].filter(Boolean).join(" · ") : `${grupos.length} pedidos`;
  return { total, grupos, quem };
}
