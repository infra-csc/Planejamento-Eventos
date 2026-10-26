import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { usuarios } from "@/server/db/schema";
import { gerarToken, hashSenha } from "./password";
import { abrirSessaoUsuario } from "./session";
import { consumirTentativa } from "./limite";
import { registrarHistorico } from "@/server/services/support";
import { verificarTokenPortal, type MotivoRecusa } from "./portal";

/*
 * Entrada pelo Portal NORTE: valida o token, garante o usuário (cria ou atualiza pelo e-mail) e
 * abre a sessão. O hub é a fonte das permissões: o papel do token vira o perfil daqui a cada
 * entrada e uma conta inativa volta a ficar ativa. A área do requisitante fica como está (o
 * portal não conhece as áreas): quem entra sem área é orientado a pedir ao administrador.
 */

/** Janela em que um `jti` não pode ser reaproveitado (o token vive 2 min + tolerância). */
const JANELA_JTI_MS = 10 * 60_000;

export type EntradaPortal = { ok: true; destino: string } | { ok: false; motivo: MotivoRecusa | "desativado" | "reutilizado" | "inativo" };

/** Segredo compartilhado com o hub (SESSION_SECRET lá). Curto demais conta como desligado. */
export function segredoPortal(): string | null {
  const s = process.env.PORTAL_SSO_SECRET?.trim() ?? "";
  return s.length >= 32 ? s : null;
}

export async function entrarPeloPortal(jwt: string): Promise<EntradaPortal> {
  const segredo = segredoPortal();
  if (!segredo) return { ok: false, motivo: "desativado" };
  const v = verificarTokenPortal(jwt, segredo);
  if (!v.ok) return { ok: false, motivo: v.motivo };
  // Uso único: o mesmo link não entra duas vezes (contagem atômica na tabela de tentativas).
  const jti = await consumirTentativa([{ chave: `portal:jti:${v.token.jti}`, maximo: 1 }], JANELA_JTI_MS);
  if (jti.excedido) return { ok: false, motivo: "reutilizado" };

  const db = await getDb();
  const [existente] = await db.select().from(usuarios).where(sql`lower(${usuarios.email}) = ${v.token.email}`).limit(1);
  const perfil = v.token.perfil ?? "REQUISITANTE";
  let id: string;
  if (existente) {
    id = existente.id;
    // Quem já existe mantém o perfil e a situação (ativo/inativo) definidos na Administração do app: antes o papel do
    // portal regravava o perfil a cada entrada (quem saía de admin aqui voltava a ser admin) e reativava conta
    // desativada. O papel do portal só vale na criação (abaixo). Conta inativa não entra (abrirSessaoUsuario).
    if (v.token.nome !== null && existente.nome !== v.token.nome) {
      await db.update(usuarios).set({ nome: v.token.nome }).where(eq(usuarios.id, id));
    }
  } else {
    // Sem senha própria: a pessoa entra pelo portal; "Esqueci minha senha" cria uma se precisar.
    const [novo] = await db.insert(usuarios).values({ nome: v.token.nome ?? v.token.email.split("@")[0], email: v.token.email, senhaHash: await hashSenha(gerarToken()), perfil, areaId: null, ativo: true, trocarSenha: false }).returning({ id: usuarios.id });
    id = novo.id;
    await registrarHistorico(db, { entidade: "acesso", entidadeId: id, acao: "PORTAL", descricao: `Usuário criado pela entrada do Portal NORTE (perfil ${perfil}).`, usuarioId: id, verComo: null }).catch(() => undefined);
  }
  const usuario = await abrirSessaoUsuario(id);
  if (!usuario) return { ok: false, motivo: "inativo" };
  return { ok: true, destino: usuario.trocarSenha ? "/perfil?trocar=1" : "/" };
}
