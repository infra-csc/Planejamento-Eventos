/**
 * Descrição por unidade dos itens adicionados numa solicitação: pediu 10 banners, descreve os 10
 * (texto, arte, medida de cada um). Acima de um limite, uma descrição só vale para todas as unidades.
 */

/** Até esta quantidade, uma descrição por unidade; acima, uma descrição única para todas. */
export const MAX_DESCRICOES_POR_UNIDADE = 50;
export const TAMANHO_DESCRICAO = 300;

/** Quantos campos de descrição o item pede para a quantidade informada (0 quando não se aplica). */
export function descricoesEsperadas(operacao: string, quantidade: number): number {
  if (operacao !== "ADICIONAR" || !Number.isInteger(quantidade) || quantidade <= 0) return 0;
  return quantidade <= MAX_DESCRICOES_POR_UNIDADE ? quantidade : 1;
}

/** Ajusta a lista ao número de campos: mantém o que já foi escrito, completa com vazio e corta o excesso. */
export function ajustarDescricoes(lista: readonly string[] | null | undefined, esperadas: number): string[] {
  const base = (lista ?? []).slice(0, esperadas);
  while (base.length < esperadas) base.push("");
  return base;
}

/** Quantas descrições ainda faltam (vazias) para o item poder ser enviado. */
export function faltamDescricoes(item: { operacao: string; quantidadeSolicitada: number; descricoes?: readonly string[] | null }): number {
  const esperadas = descricoesEsperadas(item.operacao, item.quantidadeSolicitada);
  const preenchidas = ajustarDescricoes(item.descricoes, esperadas).filter((d) => d.trim()).length;
  return esperadas - preenchidas;
}

/** Normaliza para gravar: texto aparado, no tamanho certo; nada quando o item não pede descrição. */
export function descricoesParaGravar(operacao: string, quantidade: number, lista: readonly string[] | null | undefined): string[] | null {
  const esperadas = descricoesEsperadas(operacao, quantidade);
  if (!esperadas) return null;
  const limpas = ajustarDescricoes(lista, esperadas).map((d) => d.trim().slice(0, TAMANHO_DESCRICAO));
  return limpas.some(Boolean) ? limpas : null;
}

/** Uma linha legível para quem responde: "1. Logo azul · 2. Logo branco", ou "Todas: …" quando é uma só. */
export function textoDescricoes(lista: readonly string[] | null | undefined, quantidade?: number): string | null {
  const itens = (lista ?? []).map((d) => d.trim());
  if (!itens.some(Boolean)) return null;
  if (itens.length === 1) return quantidade && quantidade > 1 ? `Todas as unidades: ${itens[0]}` : itens[0];
  if (itens.every((d) => d === itens[0])) return `Todas as ${itens.length} unidades: ${itens[0]}`;
  return itens.map((d, i) => `${i + 1}. ${d || "—"}`).join(" · ");
}

/** Observação do solicitante sobre o item com as descrições das unidades juntas, para as telas de leitura. */
export function observacaoDoItem(item: { justificativa?: string | null; descricoes?: readonly string[] | null; quantidadeSolicitada?: number | null }): string | null {
  const partes = [textoDescricoes(item.descricoes, item.quantidadeSolicitada ?? undefined), item.justificativa?.trim() || null].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/**
 * "Onde vai ficar" é por unidade (a mesma tenda pode ir para o Depósito e para o GV). Na hora de
 * gravar, unidades no mesmo local viram um item (destino = local) com as descrições delas, na ordem
 * em que os locais aparecem. Item sem descrição por unidade (alteração, remoção, >50 unidades) fica
 * inteiro num item só, com o primeiro local informado.
 */
export function agruparPorLocal(operacao: string, quantidade: number, descricoes: readonly string[] | null | undefined, locais: readonly string[] | null | undefined): Array<{ destino: string; quantidade: number; descricoes: string[] }> {
  const esperadas = descricoesEsperadas(operacao, quantidade);
  const locs = ajustarDescricoes(locais, esperadas).map((l) => l.trim().slice(0, 60));
  if (esperadas !== quantidade) return [{ destino: locs[0] ?? (locais?.[0] ?? "").trim().slice(0, 60), quantidade, descricoes: ajustarDescricoes(descricoes, esperadas) }];
  const descs = ajustarDescricoes(descricoes, esperadas);
  const grupos: Array<{ destino: string; quantidade: number; descricoes: string[] }> = [];
  locs.forEach((destino, n) => {
    const g = grupos.find((x) => x.destino === destino);
    if (g) {
      g.quantidade++;
      g.descricoes.push(descs[n]);
    } else grupos.push({ destino, quantidade: 1, descricoes: [descs[n]] });
  });
  return grupos;
}

/** A mesma descrição em todas as unidades (dados de exemplo, testes e "repetir em todas"). */
export function descricoesIguais(quantidade: number, texto: string): string[] {
  return Array.from({ length: descricoesEsperadas("ADICIONAR", quantidade) }, () => texto);
}
