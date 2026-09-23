/**
 * Regras puras da sessão (sem banco): testáveis e usadas por session.ts.
 *
 * Política: a sessão expira depois de 14 dias SEM USO ou 30 dias desde o login, o que vier primeiro.
 * - `sessoes.expira_em` é a expiração por inatividade; cada uso a empurra para agora + 14 dias,
 *   mas no máximo uma gravação por hora (não escreve no banco a cada requisição).
 * - `sessoes.criado_em` + 30 dias é o teto absoluto: nem o uso contínuo passa dele.
 */
export const INATIVIDADE_MS = 14 * 24 * 60 * 60 * 1000;
export const DURACAO_MAXIMA_MS = 30 * 24 * 60 * 60 * 1000;
export const RENOVAR_A_CADA_MS = 60 * 60 * 1000;

export type SessaoTempo = { expiraEm: Date; criadoEm: Date };

/** Limite absoluto da sessão (login + 30 dias). */
export const limiteAbsoluto = (s: Pick<SessaoTempo, "criadoEm">) => new Date(s.criadoEm.getTime() + DURACAO_MAXIMA_MS);

export function sessaoValida(s: SessaoTempo, agora = new Date()): boolean {
  return s.expiraEm.getTime() > agora.getTime() && limiteAbsoluto(s).getTime() > agora.getTime();
}

/** Expiração de uma sessão recém-criada. */
export function expiracaoInicial(agora = new Date()): Date {
  return new Date(agora.getTime() + Math.min(INATIVIDADE_MS, DURACAO_MAXIMA_MS));
}

/**
 * Nova `expiraEm` depois de um uso, ou null quando não vale gravar (renovada há menos de 1 hora,
 * ou já encostada no teto de 30 dias).
 */
export function novaExpiracao(s: SessaoTempo, agora = new Date()): Date | null {
  const alvo = Math.min(agora.getTime() + INATIVIDADE_MS, limiteAbsoluto(s).getTime());
  if (alvo - s.expiraEm.getTime() < RENOVAR_A_CADA_MS) return null;
  return new Date(alvo);
}

/** Com a troca de senha pendente, só o perfil (onde se troca a senha) abre. */
export function caminhoLiberadoComTrocaPendente(caminho: string): boolean {
  return caminho === "/perfil" || caminho.startsWith("/perfil/") || caminho.startsWith("/perfil?");
}
