import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, sessoes, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { PERFIL_LABEL, perfilUsaArea } from "@/domain/permissions";
import { hashSenha, verificarSenha } from "@/server/auth/password";
import { exigirDentroDoLimite, liberarTentativas } from "@/server/auth/limite";
import { exibirDemo, SENHA_DEMO } from "@/server/auth/demo";
import { gerarLinkAcesso, invalidarLinksPendentes, VALIDADE_CONVITE_MS } from "./recuperacao";
import { obterConfiguracoes, registrarHistorico, salvarConfiguracao, type ChaveConfig } from "./support";

/* ------------------------------------------------------------------ */
/* Áreas                                                                */
/* ------------------------------------------------------------------ */

export async function listarAreas(incluirInativas = false) {
  const db = await getDb();
  return db.query.areas.findMany({ where: incluirInativas ? undefined : eq(areas.ativo, true), orderBy: [asc(areas.criadoEm)] });
}

export async function listarAreasComContagem(usuario: UsuarioAtual) {
  exigir(usuario, "admin.areas");
  const db = await getDb();
  const [rows, pessoas, sols] = await Promise.all([
    db.select({ id: areas.id, nome: areas.nome, ativo: areas.ativo }).from(areas).orderBy(asc(areas.criadoEm)),
    db.select({ areaId: usuarios.areaId, n: count() }).from(usuarios).where(eq(usuarios.ativo, true)).groupBy(usuarios.areaId),
    db.select({ areaId: solicitacoes.areaId, n: count() }).from(solicitacoes).where(eq(solicitacoes.excluida, false)).groupBy(solicitacoes.areaId),
  ]);
  return rows.map((r) => ({
    ...r,
    pessoas: Number(pessoas.find((p) => p.areaId === r.id)?.n ?? 0),
    solicitacoes: Number(sols.find((s) => s.areaId === r.id)?.n ?? 0),
  }));
}

export async function salvarArea(usuario: UsuarioAtual, id: string | null, dados: { nome: string; ativo: boolean }) {
  exigir(usuario, "admin.areas");
  const db = await getDb();
  const [dup] = await db.select({ id: areas.id }).from(areas).where(sql`lower(${areas.nome}) = ${dados.nome.toLowerCase()}`);
  if (dup && dup.id !== id) throw new ValidacaoError("Já existe uma área com este nome.", { nome: "Nome em uso." });
  if (id) {
    await db.update(areas).set(dados).where(eq(areas.id, id));
    await registrarHistorico(db, { entidade: "area", entidadeId: id, acao: "EDITADA", descricao: `Área "${dados.nome}" alterada`, usuarioId: usuario.id, dadosDepois: dados });
    return id;
  }
  const [a] = await db.insert(areas).values(dados).returning();
  await registrarHistorico(db, { entidade: "area", entidadeId: a.id, acao: "CRIADA", descricao: `Área "${dados.nome}" criada`, usuarioId: usuario.id });
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
  return db.query.usuarios.findMany({
    where: and(inArray(usuarios.perfil, perfis), eq(usuarios.ativo, true)),
    columns: { id: true, nome: true, perfil: true },
    orderBy: [asc(usuarios.nome)],
  });
}

async function validarPerfilArea(dados: DadosUsuario) {
  if (!perfilUsaArea(dados.perfil)) return;
  if (!dados.areaId) throw new ValidacaoError(`Perfil ${PERFIL_LABEL[dados.perfil]} exige uma área.`, { areaId: "Escolha a área." });
  const db = await getDb();
  const area = await db.query.areas.findFirst({ where: and(eq(areas.id, dados.areaId), eq(areas.ativo, true)), columns: { id: true } });
  if (!area) throw new ValidacaoError("Escolha uma área ativa.", { areaId: "Área inexistente ou inativa." });
}

/**
 * Cria o usuário. Sem senha informada (fluxo padrão da tela), gera um link de acesso válido
 * por 7 dias para a pessoa definir a senha — não há envio de e-mail no MVP (RV-20).
 */
export async function criarUsuario(usuario: UsuarioAtual, dados: DadosUsuario) {
  exigir(usuario, "admin.usuarios");
  await validarPerfilArea(dados);
  if (dados.senha && dados.senha.length < 8) throw new ValidacaoError("A senha inicial deve ter pelo menos 8 caracteres.", { senha: "Mínimo de 8 caracteres." });
  const db = await getDb();
  const email = dados.email.trim();
  const [dup] = await db.select({ id: usuarios.id }).from(usuarios).where(sql`lower(${usuarios.email}) = ${email.toLowerCase()}`);
  if (dup) throw new ValidacaoError("Já existe um usuário com este e-mail.", { email: "Já existe um usuário com este e-mail." });
  const senha = dados.senha ?? randomBytes(24).toString("base64url");
  const [u] = await db
    .insert(usuarios)
    // Senha definida pelo administrador é provisória: a pessoa troca no primeiro acesso.
    .values({ nome: dados.nome, email, perfil: dados.perfil, areaId: perfilUsaArea(dados.perfil) ? dados.areaId : null, ativo: dados.ativo, senhaHash: await hashSenha(senha), trocarSenha: Boolean(dados.senha) })
    .returning();
  await registrarHistorico(db, { entidade: "usuario", entidadeId: u.id, acao: "CRIADO", descricao: `Usuário ${u.nome} criado — ${PERFIL_LABEL[u.perfil]}`, usuarioId: usuario.id });
  const linkAcesso = dados.senha ? null : await gerarLinkAcesso(u.id, VALIDADE_CONVITE_MS);
  if (linkAcesso) await registrarHistorico(db, { entidade: "usuario", entidadeId: u.id, acao: "LINK_ACESSO_GERADO", descricao: `Link de acesso gerado para ${u.nome}`, usuarioId: usuario.id });
  return { ...u, linkAcesso };
}

/** Edita nome, perfil e área. O e-mail é somente leitura depois de criado (handoff §5.14). */
export async function editarUsuario(usuario: UsuarioAtual, id: string, dados: DadosUsuario) {
  exigir(usuario, "admin.usuarios");
  await validarPerfilArea(dados);
  const db = await getDb();
  const atual = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!atual) throw new NaoEncontradoError("Usuário");
  if (id === usuario.id && (!dados.ativo || dados.perfil !== "ADMIN")) {
    throw new DomainError("Você não pode desativar ou rebaixar o próprio usuário.");
  }
  if (atual.perfil === "ADMIN" && atual.ativo && (!dados.ativo || dados.perfil !== "ADMIN")) await exigirOutroAdmin(db, id);
  if (dados.senha && dados.senha.length < 8) throw new ValidacaoError("A nova senha deve ter pelo menos 8 caracteres.", { senha: "Mínimo de 8 caracteres." });
  const patch: Partial<typeof usuarios.$inferInsert> = {
    nome: dados.nome,
    perfil: dados.perfil,
    areaId: perfilUsaArea(dados.perfil) ? dados.areaId : null,
    ativo: dados.ativo,
  };
  if (dados.senha) {
    await exigirDentroDoLimite([{ chave: `senha-admin:${usuario.id}`, maximo: LIMITE_ADMIN_POR_HORA }], HORA_MS, "Muitas redefinições de senha em pouco tempo. Aguarde alguns minutos.");
    patch.senhaHash = await hashSenha(dados.senha);
    // Senha escolhida pelo administrador é provisória: a pessoa define a própria no próximo acesso.
    patch.trocarSenha = true;
  }
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
    descricao: `Usuário ${dados.nome} alterado${mudancas.length ? ` — ${mudancas.join(", ")}` : ""}`,
    usuarioId: usuario.id,
    dadosAntes: { perfil: atual.perfil, areaId: atual.areaId, ativo: atual.ativo },
    dadosDepois: { perfil: dados.perfil, areaId: patch.areaId, ativo: dados.ativo },
  });
}

/** O sistema nunca fica sem administrador ativo (a recuperação seria só pelo terminal). */
async function exigirOutroAdmin(db: Awaited<ReturnType<typeof getDb>>, alemDe: string) {
  const outros = await db.query.usuarios.findMany({ where: and(eq(usuarios.perfil, "ADMIN"), eq(usuarios.ativo, true), ne(usuarios.id, alemDe)), columns: { id: true } });
  if (outros.length === 0) throw new DomainError("Este é o único administrador ativo. Cadastre outro administrador antes de desativar ou rebaixar este.");
}

export async function alterarAtivoUsuario(usuario: UsuarioAtual, id: string, ativo: boolean) {
  exigir(usuario, "admin.usuarios");
  if (id === usuario.id && !ativo) throw new DomainError("Você não pode desativar o próprio usuário.");
  const db = await getDb();
  const atual = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!atual) throw new NaoEncontradoError("Usuário");
  if (!ativo && atual.perfil === "ADMIN" && atual.ativo) await exigirOutroAdmin(db, id);
  await db.update(usuarios).set({ ativo }).where(eq(usuarios.id, id));
  if (!ativo) await db.delete(sessoes).where(eq(sessoes.usuarioId, id));
  await registrarHistorico(db, {
    entidade: "usuario",
    entidadeId: id,
    acao: ativo ? "REATIVADO" : "DESATIVADO",
    descricao: `Usuário ${atual.nome} ${ativo ? "reativado" : "desativado"}`,
    usuarioId: usuario.id,
  });
  return atual.nome;
}

export async function gerarNovoLinkAcesso(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "admin.usuarios");
  const db = await getDb();
  const atual = await db.query.usuarios.findFirst({ where: and(eq(usuarios.id, id), ne(usuarios.ativo, false)) });
  if (!atual) throw new DomainError("Usuário inexistente ou inativo.");
  await exigirDentroDoLimite([{ chave: `senha-admin:${usuario.id}`, maximo: LIMITE_ADMIN_POR_HORA }], HORA_MS, "Muitos links gerados em pouco tempo. Aguarde alguns minutos.");
  const link = await gerarLinkAcesso(id, VALIDADE_CONVITE_MS);
  // O link em si nunca vai para o histórico (é uma credencial).
  await registrarHistorico(db, { entidade: "usuario", entidadeId: id, acao: "LINK_ACESSO_GERADO", descricao: `Link de acesso gerado para ${atual.nome}`, usuarioId: usuario.id });
  return link;
}

const HORA_MS = 60 * 60 * 1000;
/** Redefinições de senha e links de acesso gerados por um mesmo administrador, por hora. */
const LIMITE_ADMIN_POR_HORA = 30;
/** Tentativas de troca da própria senha (senha atual errada) por usuário, a cada 15 minutos. */
const LIMITE_TROCA_PROPRIA = 5;

export async function alterarPropriaSenha(usuario: UsuarioAtual, senhaAtual: string, nova: string) {
  // Limite por usuário: uma sessão roubada não serve para testar senhas atuais à vontade.
  const reservas = await exigirDentroDoLimite([{ chave: `senha:usuario:${usuario.id}`, maximo: LIMITE_TROCA_PROPRIA }], 15 * 60_000, "Muitas tentativas de troca de senha. Aguarde 15 minutos.");
  const db = await getDb();
  const u = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuario.id) });
  if (!u || !(await verificarSenha(senhaAtual, u.senhaHash))) throw new ValidacaoError("Senha atual incorreta.", { senhaAtual: "Senha incorreta." });
  if (nova === senhaAtual) throw new ValidacaoError("A nova senha precisa ser diferente da atual.", { senha: "Escolha uma senha diferente da atual." });
  if (nova === SENHA_DEMO && !exibirDemo()) throw new ValidacaoError("Esta é a senha de demonstração. Escolha outra.", { senha: "Senha de demonstração não é permitida." });
  await db.update(usuarios).set({ senhaHash: await hashSenha(nova), trocarSenha: false }).where(eq(usuarios.id, usuario.id));
  await invalidarLinksPendentes(db, usuario.id);
  await liberarTentativas(reservas);
  await registrarHistorico(db, { entidade: "usuario", entidadeId: usuario.id, acao: "SENHA_ALTERADA", descricao: `${u.nome} alterou a própria senha`, usuarioId: usuario.id });
}

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

export async function obterConfig() {
  const db = await getDb();
  return obterConfiguracoes(db);
}

export async function salvarConfig(usuario: UsuarioAtual, valores: Partial<Record<ChaveConfig, string>>) {
  exigir(usuario, "admin.configuracoes");
  const db = await getDb();
  const antes = await obterConfiguracoes(db);
  for (const [k, v] of Object.entries(valores) as [ChaveConfig, string][]) await salvarConfiguracao(db, k, v);
  await registrarHistorico(db, { entidade: "configuracao", entidadeId: "geral", acao: "ALTERADA", descricao: "Configurações do sistema alteradas", usuarioId: usuario.id, dadosAntes: antes, dadosDepois: valores });
}
