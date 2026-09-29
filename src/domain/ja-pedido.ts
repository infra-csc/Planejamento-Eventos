/**
 * Aviso informativo na hora de pedir: o mesmo projeto ou peça já foi pedido neste evento, por quem
 * e em que situação. Não bloqueia nada — só evita pedir em dobro sem saber.
 */

export type SituacaoPedido = "na ata" | "aguardando resposta" | "atendido" | "atendido em parte" | "incluído pela logística";

export type PedidoAnterior = {
  quantidade: number;
  area: string | null;
  pessoa: string | null;
  codigo: string | null;
  situacao: SituacaoPedido;
};

/** Pedidos anteriores por evento e por referência (id do projeto ou da peça). */
export type PedidosPorEvento = Record<string, Record<string, PedidoAnterior[]>>;

/** "4× · Produção · Ana Lima · SOL-0012 · na ata". */
export function textoPedido(p: PedidoAnterior): string {
  return [`${p.quantidade}×`, p.area ?? (p.situacao === "incluído pela logística" ? "Logística" : null), p.pessoa, p.codigo, p.situacao].filter(Boolean).join(" · ");
}

/** Total já pedido e as linhas do aviso (as mais recentes primeiro, até `max`). */
export function resumoJaPedido(pedidos: readonly PedidoAnterior[] | undefined, max = 3): { total: number; linhas: string[]; outros: number } | null {
  if (!pedidos?.length) return null;
  const total = pedidos.reduce((a, p) => a + p.quantidade, 0);
  return { total, linhas: pedidos.slice(0, max).map(textoPedido), outros: Math.max(0, pedidos.length - max) };
}
