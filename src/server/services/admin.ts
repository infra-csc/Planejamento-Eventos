import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, sessoes, usuarios, type Perfil } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { ehRequisitante, PERFIL_LABEL } from "@/domain/permissions";
import { hashSenha, verificarSenha } from "@/server/auth/password";
import { obterConfiguracoes, registrarHistorico, salvarConfiguracao, type ChaveConfig } from "./support";

/* ------------------------------------------------------------------ */
/* Áreas                                                                */
/* ------------------------------------------------------------------ */

export async function listarAreas(incluirInativas = false) {
  const db = await getDb();
  return db.query.areas.findMany({ where: incluirInativas ? undefined : eq(areas.ativo, true), orderBy: [asc(areas.nome)] });
}

export async function listarAreasComContagem(usuario: UsuarioAtual) {
  exigir(usuario, "admin.areas");
  const db = await getDb();
  const rows = await db
    .select({ id: areas.id, nome: areas.nome, ativo: areas.ativo, usuarios: count(usuarios.id) })
    .from(areas)
    .leftJoin(usuarios, eq(usuarios.areaId, areas.id))
    .groupBy(areas.id)
    .orderBy(asc(areas.nome));
  return rows.map((r) => ({ ...r, usuarios: Number(r.usuarios) }));
}

export async function salvarArea(usuario: UsuarioAtual, id: string | null, dados: { nome: string; ativo: boolean }) {
  exigir(usuario, "admin.areas");
  const db = await getDb();
  const [dup] = await db.select({ id: areas.id }).from(areas).where(sql`lower(${areas.nome}) = ${dados.nome.toLowerCase()}`);
  if (dup && dup.id !== id) throw new ValidacaoError("Já existe uma área com este nome.", { nome: "Nome em uso." });
  if (id) {
    await db.update(areas).set(dados).where(eq(areas.id, id));
    await registrarHistorico(db, { entidade: "area", entidadeId: id, acao: "EDITADA", descricao: `Área "${dados.nome}" alterada.`, usuarioId: usuario.id, dadosDepois: dados });
    return id;
  }
  const [a] = await db.insert(areas).values(dados).returning();
  await registrarHistorico(db, { entidade: "area", entidadeId: a.id, acao: "CRIADA", descricao: `Área "${dados.nome}" criada.`, usuarioId: usuario.id });
  return a.id;
}

/* ------------------------------------------------------------------ */
/* Usuários                                                             */
/* ------------------------------------------------------------------ */

export type DadosUsuario = { nome: string; email: string; perfil: Perfil; areaId: string | null; senha: string | null; ativo: boolean };

export async function listarUsuarios(usuario: UsuarioAtual) {
  exigir(usuario, "admin.usuarios");
  const db = await getDb();
  return db.query.usuarios.findMany({ with: { area: true }, orderBy: [asc(usuarios.nome)] });
}

export async function listarUsuariosPorPerfil(perfis: Perfil[]) {
  const db = await getDb();
  const { inArray } = await import("drizzle-orm");
  return db.query.usuarios.findMany({ where: and(inArray(usuarios.perfil, perfis), eq(usuarios.ativo, true)), columns: { id: true, nome: true, perfil: true }, orderBy: [asc(usuarios.nome)] });
}

function validarPerfilArea(dados: DadosUsuario) {
  if (ehRequisitante(dados.perfil) && !dados.areaId) {
    throw new ValidacaoError(`Perfil ${PERFIL_LABEL[dados.perfil]} exige uma área.`, { areaId: "Escolha a área." });
  }
}

export async function criarUsuario(usuario: UsuarioAtual, dados: DadosUsuario) {
  exigir(usuario, "admin.usuarios");
  validarPerfilArea(dados);
  if (!dados.senha || dados.senha.length < 8) throw new ValidacaoError("Defina uma senha inicial com pelo menos 8 caracteres.", { senha: "Mínimo de 8 caracteres." });
  const db = await getDb();
  const [dup] = await db.select({ id: usuarios.id }).from(usuarios).where(sql`lower(${usuarios.email}) = ${dados.email.toLowerCase()}`);
  if (dup) throw new ValidacaoError("Já existe um usuário com este e-mail.", { email: "E-mail em uso." });
  const [u] = await db
    .insert(usuarios)
    .values({ nome: dados.nome, email: dados.email, perfil: dados.perfil, areaId: ehRequisitante(dados.perfil) ? dados.areaId : null, ativo: dados.ativo, senhaHash: await hashSenha(dados.senha) })
    .returning();
  await registrarHistorico(db, { entidade: "usuario", entidadeId: u.id, acao: "CRIADO", descricao: `Usuário ${u.nome} (${PERFIL_LABEL[u.perfil]}) criado.`, usuarioId: usuario.id });
  return u;
}

export async function editarUsuario(usuario: UsuarioAtual, id: string, dados: DadosUsuario) {
  exigir(usuario, "admin.usuarios");
  validarPerfilArea(dados);
  const db = await getDb();
  const atual = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!atual) throw new NaoEncontradoError("Usuário");
  const [dup] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(sql`lower(${usuarios.email}) = ${dados.email.toLowerCase()}`, ne(usuarios.id, id)));
  if (dup) throw new ValidacaoError("Já existe um usuário com este e-mail.", { email: "E-mail em uso." });
  if (id === usuario.id && (!dados.ativo || dados.perfil !== "ADMIN")) {
    throw new DomainError("Você não pode desativar ou rebaixar o próprio usuário.");
  }
  if (dados.senha && dados.senha.length < 8) throw new ValidacaoError("A nova senha deve ter pelo menos 8 caracteres.", { senha: "Mínimo de 8 caracteres." });
  const patch: Partial<typeof usuarios.$inferInsert> = {
    nome: dados.nome,
    email: dados.email,
    perfil: dados.perfil,
    areaId: ehRequisitante(dados.perfil) ? dados.areaId : null,
    ativo: dados.ativo,
  };
  if (dados.senha) patch.senhaHash = await hashSenha(dados.senha);
  await db.update(usuarios).set(patch).where(eq(usuarios.id, id));
  if (!dados.ativo || dados.senha) await db.delete(sessoes).where(eq(sessoes.usuarioId, id));
  const mudancas: string[] = [];
  if (atual.perfil !== dados.perfil) mudancas.push(`perfil ${PERFIL_LABEL[atual.perfil]} → ${PERFIL_LABEL[dados.perfil]}`);
  if (atual.ativo !== dados.ativo) mudancas.push(dados.ativo ? "reativado" : "desativado");
  if (atual.areaId !== patch.areaId) mudancas.push("área alterada");
  if (dados.senha) mudancas.push("senha redefinida");
  await registrarHistorico(db, {
    entidade: "usuario",
    entidadeId: id,
    acao: "EDITADO",
    descricao: `Usuário ${dados.nome} alterado${mudancas.length ? `: ${mudancas.join(", ")}` : "."}`,
    usuarioId: usuario.id,
    dadosAntes: { perfil: atual.perfil, areaId: atual.areaId, ativo: atual.ativo },
    dadosDepois: { perfil: dados.perfil, areaId: patch.areaId, ativo: dados.ativo },
  });
}

export async function alterarPropriaSenha(usuario: UsuarioAtual, senhaAtual: string, nova: string) {
  const db = await getDb();
  const u = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuario.id) });
  if (!u || !(await verificarSenha(senhaAtual, u.senhaHash))) throw new ValidacaoError("Senha atual incorreta.", { senhaAtual: "Senha incorreta." });
  await db.update(usuarios).set({ senhaHash: await hashSenha(nova) }).where(eq(usuarios.id, usuario.id));
}

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

export async function obterConfig() {
  const db = await getDb();
  return obterConfiguracoes(db);
}

export async function salvarConfig(usuario: UsuarioAtual, valores: Record<ChaveConfig, string>) {
  exigir(usuario, "admin.configuracoes");
  const db = await getDb();
  const antes = await obterConfiguracoes(db);
  for (const [k, v] of Object.entries(valores) as [ChaveConfig, string][]) await salvarConfiguracao(db, k, v);
  await registrarHistorico(db, { entidade: "configuracao", entidadeId: "geral", acao: "ALTERADA", descricao: "Configurações do sistema alteradas.", usuarioId: usuario.id, dadosAntes: antes, dadosDepois: valores });
}
