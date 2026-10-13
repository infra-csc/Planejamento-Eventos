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
