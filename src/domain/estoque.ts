/**
 * Estoque da Ativação (Yan, 20/10): uma tela à parte, da própria Ativação e do administrador. O fluxo da
 * solicitação e da OS não muda; quando a Ativação pede uma peça ligada a um item do estoque (ex.: Puff →
 * "Puff Cubo"), o pedido mostra quanto ainda tem no período do evento.
 */

export const CATEGORIAS_ESTOQUE = ["Ativação", "Esporte", "Reformas"] as const;

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();

/** A área Ativação (pelo nome, sem acento) e o administrador cuidam do estoque. */
export function podeGerenciarEstoque(usuario: { perfil: string; areaNome?: string | null }): boolean {
  return usuario.perfil === "ADMIN" || (usuario.areaNome != null && semAcento(usuario.areaNome) === "ativacao");
}

/**
 * Quanto ainda tem para este evento: o estoque menos o que outros eventos do mesmo período já levam.
 * Nunca negativo; `falta` > 0 quando o pedido passa do que resta.
 */
export function saldoEstoque(estoque: number, emOutrosEventos: number, pedido = 0): { restam: number; falta: number } {
  const restam = Math.max(0, estoque - emOutrosEventos);
  return { restam, falta: Math.max(0, pedido - restam) };
}

/** Os períodos [início, fim] (AAAA-MM-DD) se cruzam. */
export const periodosSeCruzam = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => a.inicio <= b.fim && b.inicio <= a.fim;

/* ------------------------------------------------------------------ */
/* Módulo Ativação (27/10): saída pela OS, retorno e reformas            */
/* ------------------------------------------------------------------ */

/**
 * Eventos que contam para saída e retorno: os que desmontam a partir desta data. Os anteriores já voltaram antes
 * de o módulo existir (sem isso, todo evento antigo apareceria com retorno pendente).
 */
export const INICIO_RETORNOS = "2026-10-20";

/** Situações do evento em que a OS existe: o que ela leva sai do estoque. */
export const STATUS_COM_OS = ["ABERTO", "ENCERRADO"] as const;

/**
 * Como o item está: `quantidade` é o que a Ativação tem em bom estado (no galpão ou em evento); o que está em
 * reforma fica à parte até voltar. Disponível = em posse − o que está fora em evento (saiu e não voltou).
 */
export function situacaoItem(quantidade: number, emEvento: number, emReforma: number) {
  return { emPosse: quantidade, emEvento, emReforma, disponivel: Math.max(0, quantidade - emEvento), total: quantidade + emReforma };
}

export type DadosRetorno = { levou: number; voltaram: number; reforma: number; perdidos: number; observacao?: string | null };

/**
 * Confere um retorno: números inteiros, 0 ou mais; quando a soma não bate com o que a OS levou, a observação
 * explica (ex.: "2 a mais vieram de outro evento"). Devolve a mensagem do problema ou null.
 */
export function problemaRetorno(r: DadosRetorno): string | null {
  for (const [rotulo, v] of [["voltaram", r.voltaram], ["para reforma", r.reforma], ["perdidos", r.perdidos]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 1_000_000) return `Quantidade inválida em “${rotulo}”: use um número inteiro, 0 ou mais.`;
  }
  const soma = r.voltaram + r.reforma + r.perdidos;
  if (soma !== r.levou && !r.observacao?.trim()) return `A OS levou ${r.levou} e o retorno soma ${soma}. Diga na observação o que aconteceu.`;
  return null;
}

/** Concluir uma reforma: consertados voltam ao estoque, baixados saem; os dois somam o que estava em reforma. */
export function problemaConclusao(quantidade: number, consertados: number, baixados: number): string | null {
  if (![consertados, baixados].every((v) => Number.isInteger(v) && v >= 0)) return "Use números inteiros, 0 ou mais.";
  if (consertados + baixados !== quantidade) return `Estão em reforma ${quantidade}: consertados e baixados precisam somar ${quantidade}.`;
  return null;
}
