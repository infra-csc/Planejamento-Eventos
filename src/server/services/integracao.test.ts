/**
 * Testes de integração das regras de negócio contra um PostgreSQL de verdade (PGlite em memória),
 * com as migrações reais. Cobrem o que o domínio puro não alcança: efeito das respostas na ata,
 * concorrência, fases do evento, permissões chamadas direto no service e escopo do histórico.
 */
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
});

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, osVersoes, pecas, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { alterarQuantidadeLinha, criarEvento, editarEvento, incluirLinhaAta, linhasAtaResumidas, obterHistoricoEvento, resumoAbasEvento, transicionarEvento, conferirTodasLinhas, salvarDadosReuniao } from "./eventos";
import { atenderTudo, desfazerResposta, devolverSolicitacao, obterSolicitacao, paginarSolicitacoes, primeiraDaFila, responderItem, salvarSolicitacaoCompleta } from "./solicitacoes";
import { listarOsResumo, obterConteudosOs } from "./os";
import { buscar } from "./busca";
import { salvarConfiguracao } from "./support";

let logistica: UsuarioAtual;
let logistica2: UsuarioAtual;
let producao: UsuarioAtual;
let grafica: UsuarioAtual;
let pecaId: string;
let seq = 0;

async function criarUsuario(nome: string, perfil: Perfil, areaId: string, areaNome: string): Promise<UsuarioAtual> {
  const db = await getDb();
  const email = `${nome.toLowerCase().replace(/\s/g, ".")}@teste.local`;
  const [u] = await db.insert(usuarios).values({ nome, email, perfil, areaId, senhaHash: "x" }).returning();
  return { id: u.id, nome, email, perfil, areaId, areaNome };
}

const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function novoEvento() {
  return criarEvento(logistica, {
    nome: `Evento de teste ${++seq}`,
    cliente: "Cliente",
    local: "Local",
    dataMontagem: dia(10),
    dataInicio: dia(11),
    dataFim: dia(12),
    dataDesmontagem: dia(13),
    dataReuniao: new Date(Date.now() + 2 * 86_400_000),
    dataCarga: null,
    responsavelId: logistica.id,
  });
}

/** Evento com a ata fechada (aberto a alterações) e uma linha de 10 peças da Produção. */
async function eventoAberto() {
  const ev = await novoEvento();
  const linha = await incluirLinhaAta(logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade: 10, destino: null, areaId: producao.areaId, justificativa: null });
  await transicionarEvento(logistica, ev.id, "INICIAR_REUNIAO");
  await conferirTodasLinhas(logistica, ev.id);
  await salvarDadosReuniao(logistica, ev.id, { reuniaoPresentes: "Logística, Produção", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
  await transicionarEvento(logistica, ev.id, "FECHAR_ATA");
  return { ev, linhaId: linha.id };
}

async function enviar(eventoId: string, itens: Parameters<typeof salvarSolicitacaoCompleta>[1]["itens"], quem = producao) {
  const r = await salvarSolicitacaoCompleta(quem, { eventoId, titulo: "Teste", observacao: null, enviar: true, itens });
  expect(r.erroEnvio).toBeNull();
  return obterSolicitacao(logistica, r.id);
}

async function linha(id: string) {
  const db = await getDb();
  const l = await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, id) });
  if (!l) throw new Error("linha não encontrada");
  return l;
}

beforeAll(async () => {
  const db = await getDb();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const [aLog, aProd, aGraf] = await db.insert(areas).values([{ nome: "Logística" }, { nome: "Produção" }, { nome: "Gráfica" }]).returning();
  logistica = await criarUsuario("Log Um", "LOGISTICA", aLog.id, aLog.nome);
  logistica2 = await criarUsuario("Log Dois", "LOGISTICA", aLog.id, aLog.nome);
  producao = await criarUsuario("Req Producao", "REQUISITANTE", aProd.id, aProd.nome);
  grafica = await criarUsuario("Req Grafica", "REQUISITANTE", aGraf.id, aGraf.nome);
  const [p] = await db.insert(pecas).values({ codigo: "BOX-T", nome: "Box de teste", setor: "ESTRUTURA" }).returning();
  pecaId = p.id;
}, 60_000);

describe("efeito das respostas na ata", { timeout: 30_000 }, () => {
  it("REMOVER não atendido não ressuscita linha que a logística já removeu", async () => {
    const { ev, linhaId } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "REMOVER", eventoItemId: linhaId, quantidadeSolicitada: 0 }]);
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 0, "Peça cancelada pelo cliente");
    await responderItem(logistica, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "Já não estava na ata" });
    expect((await linha(linhaId)).ativo).toBe(false);
  });

  it("corrigir a primeira alteração não apaga a segunda", async () => {
    const { ev, linhaId } = await eventoAberto();
    const a = await enviar(ev.id, [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 15 }]);
    await responderItem(logistica, a.itens[0].id, { status: "ATENDIDO" });
    const b = await enviar(ev.id, [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 20 }]);
    await responderItem(logistica, b.itens[0].id, { status: "ATENDIDO" });
    expect((await linha(linhaId)).quantidade).toBe(20);
    await responderItem(logistica, a.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "Sem estoque" }, "Respondi errado");
    expect((await linha(linhaId)).quantidade).toBe(15);
  });

  it("alteração de quantidade sobre linha já removida é recusada", async () => {
    const { ev, linhaId } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 12 }]);
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 0, "Removida");
    await expect(responderItem(logistica, s.itens[0].id, { status: "ATENDIDO" })).rejects.toThrow(/removida da ata/);
  });

  it("desfazer uma inclusão tira a linha; responder de novo reaproveita a mesma linha", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Gerador extra", quantidadeSolicitada: 2 }]);
    const r1 = await responderItem(logistica, s.itens[0].id, { status: "ATENDIDO" });
    expect(r1.podeDesfazer).toBe(true);
    await desfazerResposta(logistica, s.itens[0].id);
    await responderItem(logistica, s.itens[0].id, { status: "PARCIAL", quantidadeAtendida: 1, observacaoLogistica: "Só um disponível" });
    const db = await getDb();
    const linhas = await db.query.eventoItens.findMany({ where: eq(eventoItens.solicitacaoItemId, s.itens[0].id) });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ ativo: true, quantidade: 1 });
  });
});

describe("concorrência e atomicidade", { timeout: 30_000 }, () => {
  it("duas respostas ao mesmo item ao mesmo tempo geram uma linha só", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Tenda 5x5", quantidadeSolicitada: 3 }]);
    const resultados = await Promise.allSettled([
      responderItem(logistica, s.itens[0].id, { status: "ATENDIDO" }),
      responderItem(logistica2, s.itens[0].id, { status: "ATENDIDO" }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const db = await getDb();
    expect(await db.query.eventoItens.findMany({ where: eq(eventoItens.solicitacaoItemId, s.itens[0].id) })).toHaveLength(1);
  });

  it("atender tudo gera uma única versão de OS", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [
      { operacao: "ADICIONAR", descricaoLivre: "Item A", quantidadeSolicitada: 1 },
      { operacao: "ADICIONAR", descricaoLivre: "Item B", quantidadeSolicitada: 2 },
      { operacao: "ADICIONAR", descricaoLivre: "Item C", quantidadeSolicitada: 3 },
    ]);
    const db = await getDb();
    const antes = (await db.query.osVersoes.findMany({ where: eq(osVersoes.eventoId, ev.id) })).length;
    expect(await atenderTudo(logistica, s.id)).toBe(3);
    expect((await db.query.osVersoes.findMany({ where: eq(osVersoes.eventoId, ev.id) })).length).toBe(antes + 1);
    expect((await obterSolicitacao(logistica, s.id)).status).toBe("RESPONDIDA");
  });
});

describe("fases do evento e permissões no service", { timeout: 30_000 }, () => {
  it("requisitante chamando o service de resposta é barrado", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Palco", quantidadeSolicitada: 1 }]);
    await expect(responderItem(producao, s.itens[0].id, { status: "ATENDIDO" })).rejects.toThrow(/permissão/);
  });

  it("fechar a ata cancela necessidade pré-reunião que ficou em rascunho", async () => {
    const ev = await novoEvento();
    const r = await salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Rascunho", observacao: null, enviar: false, itens: [{ operacao: "ADICIONAR", descricaoLivre: "Totem", quantidadeSolicitada: 1 }] });
    await transicionarEvento(logistica, ev.id, "INICIAR_REUNIAO");
    await conferirTodasLinhas(logistica, ev.id);
    await salvarDadosReuniao(logistica, ev.id, { reuniaoPresentes: "Logística", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
    const t = await transicionarEvento(logistica, ev.id, "FECHAR_ATA");
    expect(t.canceladasAuto).toBe(1);
    const db = await getDb();
    expect((await db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, r.id) }))?.status).toBe("CANCELADA");
  });

  it("encerrar sem bloqueio cancela solicitações pendentes em vez de deixá-las órfãs", async () => {
    const db = await getDb();
    await salvarConfiguracao(db, "bloquear_encerramento_com_pendentes", "false");
    try {
      const { ev } = await eventoAberto();
      const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Banheiro", quantidadeSolicitada: 2 }]);
      await transicionarEvento(logistica, ev.id, "ENCERRAR");
      expect((await db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, s.id) }))?.status).toBe("CANCELADA");
    } finally {
      await salvarConfiguracao(db, "bloquear_encerramento_com_pendentes", "true");
    }
  });

  it("rascunho de evento encerrado não pode ser editado", async () => {
    const { ev } = await eventoAberto();
    const r = await salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Depois", observacao: null, enviar: false, itens: [] });
    await transicionarEvento(logistica, ev.id, "ENCERRAR");
    await expect(salvarSolicitacaoCompleta(producao, { id: r.id, eventoId: ev.id, titulo: "Mudou", observacao: null, enviar: false, itens: [] })).rejects.toThrow(/encerrado/);
  });

  it("data da reunião não muda depois da ata fechada", async () => {
    const { ev } = await eventoAberto();
    const dados = { nome: ev.nome, cliente: ev.cliente, local: ev.local, dataMontagem: ev.dataMontagem, dataInicio: ev.dataInicio, dataFim: ev.dataFim, dataDesmontagem: ev.dataDesmontagem, dataCarga: null, responsavelId: ev.responsavelId };
    await expect(editarEvento(logistica, ev.id, { ...dados, dataReuniao: new Date(ev.dataReuniao.getTime() + 86_400_000) })).rejects.toThrow(/reunião/);
    await expect(editarEvento(logistica, ev.id, { ...dados, nome: "Nome novo", dataReuniao: ev.dataReuniao })).resolves.toBeTruthy();
  });
});

describe("administrador com acesso total", { timeout: 30_000 }, () => {
  it("cria solicitação em nome de uma área, responde e reabre evento encerrado", async () => {
    const db = await getDb();
    const [u] = await db.insert(usuarios).values({ nome: "Admin Teste", email: "admin.teste@teste.local", perfil: "ADMIN", areaId: null, senhaHash: "x" }).returning();
    const admin: UsuarioAtual = { id: u.id, nome: u.nome, email: u.email, perfil: "ADMIN", areaId: null, areaNome: null };
    const { ev } = await eventoAberto();
    await expect(salvarSolicitacaoCompleta(admin, { eventoId: ev.id, titulo: "Sem área", observacao: null, enviar: false, itens: [] })).rejects.toThrow(/área/);
    const r = await salvarSolicitacaoCompleta(admin, { eventoId: ev.id, areaId: producao.areaId, titulo: "Pedido do admin", observacao: null, enviar: true, itens: [{ operacao: "ADICIONAR", descricaoLivre: "Tenda extra", quantidadeSolicitada: 1 }] });
    expect(r.enviada).toBe(true);
    const s = await obterSolicitacao(admin, r.id);
    expect(s.areaId).toBe(producao.areaId);
    await responderItem(admin, s.itens[0].id, { status: "ATENDIDO" });
    await transicionarEvento(admin, ev.id, "ENCERRAR");
    await expect(transicionarEvento(admin, ev.id, "REABRIR", "Exceção aprovada")).resolves.toBeTruthy();
  });
});

describe("consultas otimizadas", { timeout: 30_000 }, () => {
  it("lista de solicitações pagina e conta no banco, respeitando a área", async () => {
    const { ev } = await eventoAberto();
    await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Da Produção", quantidadeSolicitada: 1 }]);
    await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Da Gráfica", quantidadeSolicitada: 1 }], grafica);
    const daLogistica = await paginarSolicitacoes(logistica, { filtro: "ABERTAS", ordem: "codigo", dir: "desc", porPagina: 1 });
    expect(daLogistica.itens).toHaveLength(1);
    expect(daLogistica.contagens.ABERTAS).toBeGreaterThanOrEqual(2);
    expect(daLogistica.paginas).toBe(daLogistica.contagens.ABERTAS);
    const daGrafica = await paginarSolicitacoes(grafica, { filtro: "TODAS", ordem: "itens", porPagina: 50 });
    expect(daGrafica.itens.every((s) => s.areaId === grafica.areaId)).toBe(true);
    for (const ordem of ["titulo", "status", "prazo", undefined]) {
      await expect(paginarSolicitacoes(logistica, { filtro: "ATRASADAS", ordem, porPagina: 8 })).resolves.toBeTruthy();
    }
    expect(await primeiraDaFila(logistica)).toBeTruthy();
    expect(await primeiraDaFila(producao)).toBeNull();
  });

  it("contadores das abas e resumo das versões de OS sem carregar o JSON", async () => {
    const { ev, linhaId } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 14 }]);
    await responderItem(logistica, s.itens[0].id, { status: "ATENDIDO" });
    const resumo = await resumoAbasEvento(logistica, ev.id);
    expect(resumo).toMatchObject({ linhas: 1, solicitacoes: 1, versaoOs: 2 });
    expect((await resumoAbasEvento(grafica, ev.id)).solicitacoes).toBe(0);
    const versoes = await listarOsResumo(ev.id);
    expect(versoes.map((v) => v.numero)).toEqual([2, 1]);
    expect(versoes[0].resumo).toBe("BOX-T +4");
    expect("conteudo" in versoes[0]).toBe(false);
    const conteudos = await obterConteudosOs(ev.id, [2]);
    expect(conteudos.get(2)?.setores[0].linhas[0].total).toBe(14);
    const linhas = await linhasAtaResumidas([ev.id]);
    expect(linhas[ev.id]).toEqual([expect.objectContaining({ id: linhaId, nome: "BOX-T · Box de teste", quantidade: 14 })]);
  });

  it("busca global roda as consultas em paralelo e respeita a área", async () => {
    const r = await buscar(grafica, "Evento de teste");
    expect(r.some((x) => x.tag === "evento")).toBe(true);
    expect(r.filter((x) => x.tag === "solic.").every((x) => x.sub.startsWith("Gráfica"))).toBe(true);
  });
});

describe("histórico do evento por área", { timeout: 30_000 }, () => {
  it("outra área não lê o motivo de devolução; a própria área lê", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Iluminação", quantidadeSolicitada: 4 }]);
    await devolverSolicitacao(logistica, s.id, "Motivo sigiloso da Produção");
    const daGrafica = await obterHistoricoEvento(grafica, ev.id);
    const daProducao = await obterHistoricoEvento(producao, ev.id);
    expect(daGrafica.some((h) => h.descricao.includes("Motivo sigiloso"))).toBe(false);
    expect(daProducao.some((h) => h.descricao.includes("Motivo sigiloso"))).toBe(true);
    expect(daGrafica.some((h) => h.entidade === "evento")).toBe(true);
  });
});
