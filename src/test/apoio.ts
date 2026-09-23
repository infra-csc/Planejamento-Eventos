/**
 * Apoio dos testes de integração (só testes importam este módulo).
 *
 * Banco: cada arquivo de teste escolhe o banco num `vi.hoisted` ANTES de importar qualquer coisa
 * de `@/server/db` (PGLITE_DATA_DIR="memory://" para o PGlite em memória, ou DATABASE_URL para um
 * Postgres descartável). `migrarBanco()` aplica as migrações reais de ./drizzle.
 *
 * Os fixtures chamam os services de verdade (criarEvento, incluirLinhaAta, transicionarEvento…),
 * então o estado montado é o mesmo que a aplicação produz.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getConnection, getDb } from "@/server/db";
import { areas, pecas, projetoItens, projetoVersoes, projetos, sessoes, usuarios, type Perfil } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { gerarToken, hashToken } from "@/server/auth/password";
import { expiracaoInicial } from "@/server/auth/politica-sessao";
import { conferirTodasLinhas, criarEvento, incluirLinhaAta, salvarDadosReuniao, transicionarEvento } from "@/server/services/eventos";
import { obterSolicitacao, salvarSolicitacaoCompleta } from "@/server/services/solicitacoes";
import { descricoesIguais } from "@/domain/descricoes-itens";

/** Aplica as migrações reais no banco escolhido pelo arquivo de teste (PGlite ou Postgres). */
export async function migrarBanco() {
  const conn = await getConnection();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (conn.kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(conn.db as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(conn.db as any, { migrationsFolder });
  }
}

let seq = 0;
/** Texto único por execução: o Postgres de teste pode ser reaproveitado entre rodadas. */
export const unico = (prefixo: string) => `${prefixo}-${++seq}-${randomUUID().slice(0, 8)}`;

export const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export async function criarArea(nome: string) {
  const db = await getDb();
  const [a] = await db.insert(areas).values({ nome: unico(nome) }).returning();
  return a;
}

export async function criarUsuario(nome: string, perfil: Perfil, area: { id: string; nome: string } | null): Promise<UsuarioAtual> {
  const db = await getDb();
  const email = `${unico(nome.toLowerCase().replace(/\W+/g, "."))}@teste.local`;
  const [u] = await db.insert(usuarios).values({ nome, email, perfil, areaId: area?.id ?? null, senhaHash: "x" }).returning();
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: area?.nome ?? null };
}

export async function criarPeca(setor: "ESTRUTURA" | "MARCENARIA" = "ESTRUTURA") {
  const db = await getDb();
  const [p] = await db.insert(pecas).values({ codigo: unico("PC").toUpperCase(), nome: "Peça de teste", setor }).returning();
  return p;
}

/** Projeto padrão ativo, versão 1, com `quantidade` da peça por unidade. */
export async function criarProjeto(pecaId: string, quantidade = 4) {
  const db = await getDb();
  const [pr] = await db.insert(projetos).values({ codigo: unico("PRJ").toUpperCase(), nome: unico("Projeto de teste") }).returning();
  const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
  await db.insert(projetoItens).values({ versaoId: v.id, pecaId, quantidade });
  return pr;
}

/** Evento em preparação, reunião daqui a 2 dias (aceita necessidades pré-reunião). */
export async function novoEvento(por: UsuarioAtual) {
  return criarEvento(por, {
    nome: unico("Evento de teste"),
    cliente: "Cliente",
    local: "Local",
    dataMontagem: dia(10),
    dataInicio: dia(11),
    dataFim: dia(12),
    dataDesmontagem: dia(13),
    dataReuniao: new Date(Date.now() + 2 * 86_400_000),
    dataCarga: null,
    responsavelId: por.id,
  });
}

export async function incluirPeca(por: UsuarioAtual, eventoId: string, pecaId: string, quantidade: number, areaId: string | null) {
  return incluirLinhaAta(por, eventoId, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade, destino: null, areaId, justificativa: null });
}

export async function incluirProjeto(por: UsuarioAtual, eventoId: string, projetoId: string, quantidade: number, areaId: string | null) {
  return incluirLinhaAta(por, eventoId, { referenciaTipo: "PROJETO", projetoId, pecaId: null, descricaoLivre: null, quantidade, destino: null, areaId, justificativa: null });
}

/** Evento EM_REUNIAO → ata fechada (ABERTO). Confere tudo e preenche os dados obrigatórios. */
export async function fecharAta(por: UsuarioAtual, eventoId: string) {
  await conferirTodasLinhas(por, eventoId);
  await salvarDadosReuniao(por, eventoId, { reuniaoPresentes: "Logística", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
  await transicionarEvento(por, eventoId, "FECHAR_ATA");
}

/** Evento com a ata fechada (aberto a alterações) e uma linha de 10 peças da área informada. */
export async function eventoAberto(por: UsuarioAtual, pecaId: string, areaId: string | null) {
  const ev = await novoEvento(por);
  const linha = await incluirPeca(por, ev.id, pecaId, 10, areaId);
  await transicionarEvento(por, ev.id, "INICIAR_REUNIAO");
  await fecharAta(por, ev.id);
  return { ev, linhaId: linha.id };
}

type ItensSolicitacao = Parameters<typeof salvarSolicitacaoCompleta>[1]["itens"];

export const itemAvulso = (descricao: string, quantidade = 1): ItensSolicitacao[number] => ({
  operacao: "ADICIONAR",
  descricaoLivre: descricao,
  quantidadeSolicitada: quantidade,
  descricoes: descricoesIguais(quantidade, "Conforme combinado"),
});

/** Cria e envia uma solicitação; devolve o detalhe (lido pela logística/admin `leitor`). */
export async function enviarSolicitacao(quem: UsuarioAtual, leitor: UsuarioAtual, eventoId: string, itens: ItensSolicitacao) {
  const r = await salvarSolicitacaoCompleta(quem, { eventoId, areaId: quem.areaId, titulo: "Teste", observacao: null, enviar: true, itens });
  if (r.erroEnvio) throw new Error(`envio recusado: ${r.erroEnvio}`);
  return obterSolicitacao(leitor, r.id);
}

export async function rascunho(quem: UsuarioAtual, eventoId: string, itens: ItensSolicitacao = [itemAvulso("Rascunho")]) {
  return salvarSolicitacaoCompleta(quem, { eventoId, areaId: quem.areaId, titulo: "Rascunho de teste", observacao: null, enviar: false, itens });
}

/** PNG de verdade (8×8), para anexos, planta e miniatura (o sharp precisa conseguir ler). */
export async function pngMinimo(largura = 8, altura = 8): Promise<Buffer> {
  return sharp({ create: { width: largura, height: altura, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .png()
    .toBuffer();
}

/** Sessão válida no banco para o usuário; devolve o token que vai no cookie. */
export async function abrirSessao(usuarioId: string) {
  const db = await getDb();
  const token = gerarToken();
  await db.insert(sessoes).values({ usuarioId, tokenHash: hashToken(token), expiraEm: expiracaoInicial(), userAgent: "vitest" });
  return token;
}

/** Um usuário de cada perfil (requisitante na área A, cenografia na área Cenografia) + requisitante da área B. */
export async function montarElenco() {
  const [aLog, aA, aB, aCen] = await Promise.all([criarArea("Logística"), criarArea("Produção"), criarArea("Gráfica"), criarArea("Cenografia")]);
  const admin = await criarUsuario("Admin", "ADMIN", null);
  const logistica = await criarUsuario("Logística Um", "LOGISTICA", aLog);
  const logistica2 = await criarUsuario("Logística Dois", "LOGISTICA", aLog);
  const gestao = await criarUsuario("Gestão", "GESTAO", null);
  const cenografia = await criarUsuario("Cenógrafo", "CENOGRAFIA", aCen);
  const requisitante = await criarUsuario("Requisitante A", "REQUISITANTE", aA);
  const requisitanteB = await criarUsuario("Requisitante B", "REQUISITANTE", aB);
  const porPerfil: Record<Perfil, UsuarioAtual> = { ADMIN: admin, LOGISTICA: logistica, GESTAO: gestao, CENOGRAFIA: cenografia, REQUISITANTE: requisitante };
  return { areas: { logistica: aLog, a: aA, b: aB, cenografia: aCen }, admin, logistica, logistica2, gestao, cenografia, requisitante, requisitanteB, porPerfil };
}

export type Elenco = Awaited<ReturnType<typeof montarElenco>>;
