/** Regras do saldo que a tela e o servidor compartilham. */
export const QTD_MAXIMA_SALDO = 1_000_000;

export type SugestaoContagem = { quantidade: number; origem: string } | null;

/**
 * Número de referência na primeira contagem: o "em posse" da Ativação no almoxarifado dela e o "estoque próprio" antigo do catálogo
 * no principal. É só sugestão: quem conta confirma, e o saldo nasce da contagem.
 */
export function sugestaoDaContagem(p: { ehAtivacao: boolean; emPosse: number | null; estoqueProprio: number }): SugestaoContagem {
  if (p.ehAtivacao) return p.emPosse != null && p.emPosse > 0 ? { quantidade: p.emPosse, origem: "Em posse na Ativação" } : null;
  return p.estoqueProprio > 0 ? { quantidade: p.estoqueProprio, origem: "Estoque próprio antigo do catálogo" } : null;
}
