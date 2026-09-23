// Sem "server-only": lido pela tela de login e pela autenticação; não expõe nada ao navegador sozinho.

/** Senha dos usuários criados pelo seed de demonstração (scripts/seed.ts). */
export const SENHA_DEMO = "norte1234";

/**
 * Modo demonstração (bloco "entrar como" no login, senha do seed aceita sem troca obrigatória).
 * - Local (`npm run dev` fora do Replit): ligado por padrão.
 * - Replit e produção: só com EXIBIR_DEMO=true explícito. Qualquer pessoa com o link entra como
 *   qualquer perfil, inclusive Administrador — use apenas com dados de demonstração.
 */
export function exibirDemo() {
  if (process.env.EXIBIR_DEMO === "true") return true;
  if (process.env.EXIBIR_DEMO === "false") return false;
  const exposto = Boolean(process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || process.env.DATABASE_URL);
  return process.env.NODE_ENV !== "production" && !exposto;
}
