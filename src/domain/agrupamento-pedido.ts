/** Agrupamento de apresentação: preserva os objetos e IDs das linhas originais. */
const normalizar = (texto: string) => texto.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export function agruparItensPedido<T extends { descricao: string; tenda?: boolean }>(
  itens: readonly T[],
  chaveOriginal: (item: T, indice: number) => string,
): T[][] {
  const grupos = new Map<string, T[]>();
  itens.forEach((item, indice) => {
    const chave = item.tenda ? `tenda:${normalizar(item.descricao)}` : `item:${chaveOriginal(item, indice)}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
  });
  return [...grupos.values()];
}

export function agruparLocaisTenda<T extends { destino?: string | null }>(itens: readonly T[]): Array<{ local: string | null; itens: T[] }> {
  const locais = new Map<string, { local: string | null; itens: T[] }>();
  for (const item of itens) {
    const local = item.destino?.trim() || null;
    const chave = local ? normalizar(local) : "";
    const grupo = locais.get(chave) ?? { local, itens: [] };
    grupo.itens.push(item);
    locais.set(chave, grupo);
  }
  return [...locais.values()];
}

/** Campos que identificam "o mesmo item" num pedido (o mesmo projeto pedido para vários locais é um item só). */
export type ItemContavel = { operacao: string; projetoId: string | null; pecaId: string | null; eventoItemId: string | null; descricaoLivre: string | null; status?: string };

export const chaveItemPedido = (i: ItemContavel) => [i.operacao, i.projetoId ?? "", i.pecaId ?? "", i.eventoItemId ?? "", i.descricaoLivre ?? ""].join("|");

/**
 * Itens de um pedido contados como a tela da solicitação os mostra: a tenda em 3 locais é 1 item, e o item só conta
 * como respondido quando todas as linhas dele foram respondidas. Antes o histórico dizia "3 itens", a lista "2/3" e a
 * solicitação "Itens 1" para o mesmo pedido (auditoria 30/10, parte A N15).
 */
export function contarItensPedido(itens: readonly ItemContavel[]): { total: number; respondidos: number } {
  const grupos = new Map<string, boolean>();
  for (const i of itens) {
    const chave = chaveItemPedido(i);
    grupos.set(chave, (grupos.get(chave) ?? true) && i.status !== "EM_ANALISE");
  }
  return { total: grupos.size, respondidos: [...grupos.values()].filter(Boolean).length };
}
