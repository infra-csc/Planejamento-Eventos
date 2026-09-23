/**
 * Notificações do evento: quem pediu alguma coisa num evento precisa ficar sabendo de toda
 * adição ou ajuste de itens naquele evento — inclusive de itens de outra área.
 */
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
});

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, notificacoes, pecas, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { alterarQuantidadeLinha, conferirTodasLinhas, criarEvento, incluirLinhaAta, obterLinhasAta, salvarDadosReuniao, transicionarEvento } from "./eventos";
import { responderItem, salvarSolicitacaoCompleta } from "./solicitacoes";
import { descricoesIguais } from "@/domain/descricoes-itens";

let logistica: UsuarioAtual;
let producao: UsuarioAtual;
let ativacao: UsuarioAtual;
let pecaId: string;

async function criarUsuario(nome: string, perfil: Perfil, areaId: string | null, areaNome: string | null): Promise<UsuarioAtual> {
  const db = await getDb();
  const [u] = await db
    .insert(usuarios)
    .values({ nome, email: `${nome.toLowerCase().replace(/\W+/g, ".")}@t.com`, perfil, areaId, senhaHash: "x" })
    .returning();
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome };
}

const notificacoesDe = async (usuarioId: string) => {
  const db = await getDb();
  return db.query.notificacoes.findMany({ where: eq(notificacoes.usuarioId, usuarioId) });
};

beforeAll(async () => {
  const db = await getDb();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const [aLog, aProd, aAtiv] = await db
    .insert(areas)
    .values([{ nome: "Logística" }, { nome: "Produção" }, { nome: "Ativação" }])
    .returning();
  logistica = await criarUsuario("Marina", "LOGISTICA", aLog.id, aLog.nome);
  producao = await criarUsuario("Paulo", "REQUISITANTE", aProd.id, aProd.nome);
  ativacao = await criarUsuario("Julia", "REQUISITANTE", aAtiv.id, aAtiv.nome);
  const [p] = await db.insert(pecas).values({ codigo: "TENDA", nome: "Tenda 3×3", setor: "ESTRUTURA" }).returning();
  pecaId = p.id;
}, 60_000);

/** Evento com pedido das duas áreas, ata fechada e a caixa de notificações limpa. */
async function eventoComPedidos() {
  const db = await getDb();
  const ev = await criarEvento(logistica, {
    nome: `Evento ${Math.random().toString(36).slice(2, 7)}`,
    cliente: null,
    local: null,
    dataInicio: "2026-12-01",
    dataReuniao: new Date("2026-11-20T14:00:00-03:00"),
    janelaAlteracoesAte: null,
  });
  for (const u of [producao, ativacao]) {
    await salvarSolicitacaoCompleta(u, { eventoId: ev.id, titulo: `Pedido ${u.nome}`, observacao: null, enviar: true, itens: [{ operacao: "ADICIONAR", pecaId, quantidadeSolicitada: 2, descricoes: descricoesIguais(2, "Conforme combinado") }] });
  }
  await transicionarEvento(logistica, ev.id, "INICIAR_REUNIAO");
  await conferirTodasLinhas(logistica, ev.id);
  await salvarDadosReuniao(logistica, ev.id, { reuniaoPresentes: "Logística", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
  await transicionarEvento(logistica, ev.id, "FECHAR_ATA");
  await db.delete(notificacoes);
  return ev;
}

describe("notificações do evento", { timeout: 30_000 }, () => {
  it("item incluído depois da ata avisa quem pediu, inclusive de outra área", async () => {
    const ev = await eventoComPedidos();
    await incluirLinhaAta(logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade: 3, destino: "Praça", areaId: producao.areaId, justificativa: "Decisão do cliente" });
    expect((await notificacoesDe(producao.id)).some((n) => n.tipo === "ATA_AJUSTE")).toBe(true);
    expect((await notificacoesDe(ativacao.id)).some((n) => n.tipo === "ATA_AJUSTE")).toBe(true);
  });

  it("ajuste de quantidade depois da ata avisa as duas áreas e leva ao item", async () => {
    const ev = await eventoComPedidos();
    const linha = (await obterLinhasAta(ev.id))[0];
    await alterarQuantidadeLinha(logistica, ev.id, linha.id, linha.quantidade + 1, "Sobrou espaço no caminhão");
    const daAtivacao = (await notificacoesDe(ativacao.id)).filter((n) => n.tipo === "ATA_AJUSTE");
    expect(daAtivacao.length).toBeGreaterThan(0);
    expect(daAtivacao[0].link).toContain(`/eventos/${ev.id}/itens/`);
  });

  it("quem fez o ajuste não recebe notificação do próprio ajuste", async () => {
    const ev = await eventoComPedidos();
    const linha = (await obterLinhasAta(ev.id))[0];
    await alterarQuantidadeLinha(logistica, ev.id, linha.id, linha.quantidade + 2, "Ajuste");
    expect((await notificacoesDe(logistica.id)).filter((n) => n.tipo === "ATA_AJUSTE")).toHaveLength(0);
  });

  it("resposta a uma alteração avisa quem pediu", async () => {
    const ev = await eventoComPedidos();
    const s = await salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Mais uma tenda", observacao: null, enviar: true, itens: [{ operacao: "ADICIONAR", pecaId, quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }] });
    const db = await getDb();
    await db.delete(notificacoes);
    const sol = await db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, s.id), with: { itens: true } });
    await responderItem(logistica, sol!.itens[0].id, { status: "ATENDIDO" });
    expect((await notificacoesDe(producao.id)).length).toBeGreaterThan(0);
  });
});
