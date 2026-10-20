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
