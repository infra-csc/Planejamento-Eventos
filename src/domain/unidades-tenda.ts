/**
 * Descrições permanecem na ordem do pedido, sem agrupar textos iguais.
 * Uma descrição única é compartilhada por todas as unidades; lacunas não são inventadas.
 * O número é uma posição dentro da linha, não a identidade de uma tenda física.
 */
export function descricaoDaUnidade(descricoes: readonly string[] | null | undefined, numero: number): string | null {
  if (!Number.isSafeInteger(numero) || numero < 1) return null;
  const texto = descricoes?.length === 1 ? descricoes[0] : descricoes?.[numero - 1];
  return texto?.trim() || null;
}
