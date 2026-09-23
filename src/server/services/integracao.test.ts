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

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, historico, notificacoes, osVersoes, pecas, projetoItens, projetoVersoes, projetos, solicitacaoItens, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { alterarQuantidadeLinha, criarEvento, editarEvento, incluirLinhaAta, linhasAtaResumidas, obterHistoricoEvento, resumoAbasEvento, transicionarEvento, conferirTodasLinhas, salvarDadosReuniao } from "./eventos";
import {
  atenderTudo,
  cancelarSolicitacao,
  desfazerResposta,
  devolverSolicitacao,
  listarPendenciasCompra,
  listarPendenciasResolvidas,
  obterSolicitacao,
  paginarSolicitacoes,
  primeiraDaFila,
  resolverPendenciaCompra,
  responderItem,
  salvarSolicitacaoCompleta,
} from "./solicitacoes";
import { ajustarLinhaNaConferencia } from "./conferencia";
import { alterarAtivoPeca, impactoInativacaoPeca } from "./catalogo";
import { vincularAoCatalogo } from "./fora-catalogo";
import { listarNotificacoesComTotal } from "./notificacoes";
import { executarVerificacoesSeNecessario } from "@/server/jobs/verificacoes";
import { complementoOs, listarOsResumo, marcarOsEnviada, obterConteudosOs } from "./os";
import { buscar } from "./busca";
import { salvarConfiguracao } from "./support";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { detectarMimeAnexo } from "./projetos";

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

describe("OS enviada ao carregamento e complemento", { timeout: 30_000 }, () => {
  it("marca a versão atual como enviada e o que muda depois vira complemento", async () => {
    const { ev, linhaId } = await eventoAberto();
    expect(await complementoOs(ev.id)).toBeNull();
    const r = await marcarOsEnviada(logistica, ev.id);
    expect(r.incorporou).toBe(false);
    expect((await complementoOs(ev.id))?.diff).toHaveLength(0);
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 14, "Cliente pediu mais");
    const c = await complementoOs(ev.id);
    expect(c?.numero).toBe(r.numero);
    expect(c?.diff).toEqual([expect.objectContaining({ codigo: "BOX-T", antes: 10, depois: 14 })]);
    // Incorporar: a OS nova passa a ser a enviada e o complemento zera.
    const r2 = await marcarOsEnviada(logistica, ev.id);
    expect(r2.incorporou).toBe(true);
    expect(r2.numero).toBeGreaterThan(r.numero);
    expect((await complementoOs(ev.id))?.diff).toHaveLength(0);
  });

  it("marcar de novo sem mudança é recusado; requisitante não marca", async () => {
    const { ev } = await eventoAberto();
    await marcarOsEnviada(logistica, ev.id);
    await expect(marcarOsEnviada(logistica, ev.id)).rejects.toThrow(/já é a versão enviada/);
    await expect(marcarOsEnviada(producao, ev.id)).rejects.toThrow();
  });
});

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
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Gerador extra", quantidadeSolicitada: 2, descricoes: descricoesIguais(2, "Conforme combinado") }]);
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
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Tenda 5x5", quantidadeSolicitada: 3, descricoes: descricoesIguais(3, "Conforme combinado") }]);
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
      { operacao: "ADICIONAR", descricaoLivre: "Item A", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") },
      { operacao: "ADICIONAR", descricaoLivre: "Item B", quantidadeSolicitada: 2, descricoes: descricoesIguais(2, "Conforme combinado") },
      { operacao: "ADICIONAR", descricaoLivre: "Item C", quantidadeSolicitada: 3, descricoes: descricoesIguais(3, "Conforme combinado") },
    ]);
    const db = await getDb();
    const antes = (await db.query.osVersoes.findMany({ where: eq(osVersoes.eventoId, ev.id) })).length;
    expect(await atenderTudo(logistica, s.id)).toBe(3);
    expect((await db.query.osVersoes.findMany({ where: eq(osVersoes.eventoId, ev.id) })).length).toBe(antes + 1);
    expect((await obterSolicitacao(logistica, s.id)).status).toBe("RESPONDIDA");
  });
});

describe("fases do evento e permissões no service", { timeout: 30_000 }, () => {
  it("enviar exige a descrição de cada unidade adicionada (rascunho salva sem)", async () => {
    const { ev } = await eventoAberto();
    const sem = [{ operacao: "ADICIONAR" as const, descricaoLivre: "Banner", quantidadeSolicitada: 3, descricoes: ["Logo azul", "", "Logo branco"] }];
    await expect(salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Banners", observacao: null, enviar: true, itens: sem })).rejects.toThrow(/descri/);
    const r = await salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Banners", observacao: null, enviar: false, itens: sem });
    expect(r.enviada).toBe(false);
    const ok = await salvarSolicitacaoCompleta(producao, { id: r.id, eventoId: ev.id, titulo: "Banners", observacao: null, enviar: true, itens: [{ ...sem[0], descricoes: ["Logo azul", "Logo preto", "Logo branco"] }] });
    expect(ok.enviada).toBe(true);
    const s = await obterSolicitacao(logistica, r.id);
    expect(s.itens[0].descricoes).toEqual(["Logo azul", "Logo preto", "Logo branco"]);
  });

  it("requisitante chamando o service de resposta é barrado", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Palco", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    await expect(responderItem(producao, s.itens[0].id, { status: "ATENDIDO" })).rejects.toThrow(/permissão/);
  });

  it("fechar a ata cancela necessidade pré-reunião que ficou em rascunho", async () => {
    const ev = await novoEvento();
    const r = await salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Rascunho", observacao: null, enviar: false, itens: [{ operacao: "ADICIONAR", descricaoLivre: "Totem", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }] });
    await incluirLinhaAta(logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade: 1, destino: null, areaId: producao.areaId, justificativa: null });
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
      const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Banheiro", quantidadeSolicitada: 2, descricoes: descricoesIguais(2, "Conforme combinado") }]);
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
    // O rascunho de alteração não fica preso: é cancelado com o motivo.
    const db = await getDb();
    expect(await db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, r.id) })).toMatchObject({ status: "CANCELADA", canceladaMotivo: "Evento encerrado antes do reenvio" });
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
    const r = await salvarSolicitacaoCompleta(admin, { eventoId: ev.id, areaId: producao.areaId, titulo: "Pedido do admin", observacao: null, enviar: true, itens: [{ operacao: "ADICIONAR", descricaoLivre: "Tenda extra", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }] });
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
    await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Da Produção", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Da Gráfica", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }], grafica);
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
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Iluminação", quantidadeSolicitada: 4, descricoes: descricoesIguais(4, "Conforme combinado") }]);
    await devolverSolicitacao(logistica, s.id, "Motivo sigiloso da Produção");
    const daGrafica = await obterHistoricoEvento(grafica, ev.id);
    const daProducao = await obterHistoricoEvento(producao, ev.id);
    expect(daGrafica.some((h) => h.descricao.includes("Motivo sigiloso"))).toBe(false);
    expect(daProducao.some((h) => h.descricao.includes("Motivo sigiloso"))).toBe(true);
    expect(daGrafica.some((h) => h.entidade === "evento")).toBe(true);
  });
});

describe("correções da auditoria", { timeout: 30_000 }, () => {
  it("conferir as restantes marca só as linhas que estavam na tela", async () => {
    const ev = await novoEvento();
    const base = { referenciaTipo: "PECA" as const, projetoId: null, pecaId, descricaoLivre: null, destino: null, areaId: producao.areaId, justificativa: null };
    const a = await incluirLinhaAta(logistica, ev.id, { ...base, quantidade: 1 });
    const b = await incluirLinhaAta(logistica, ev.id, { ...base, quantidade: 2 });
    const r = await conferirTodasLinhas(logistica, ev.id, [a.id]);
    expect(r).toEqual({ marcadas: 1, novas: 1 });
    const db = await getDb();
    const lb = await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, b.id) });
    expect(lb?.conferidoEm).toBeNull();
  });

  it("motivo de ajuste pós-ata vai só para a área dona da linha", async () => {
    const { ev, linhaId } = await eventoAberto();
    await salvarSolicitacaoCompleta(grafica, { eventoId: ev.id, titulo: "Da gráfica", observacao: null, enviar: true, itens: [{ operacao: "ADICIONAR", descricaoLivre: "Banner", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Logo") }] });
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 12, "Motivo interno da produção");
    const db = await getDb();
    const daGrafica = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, grafica.id), eq(notificacoes.tipo, "ATA_AJUSTE")));
    expect(daGrafica.length).toBeGreaterThan(0);
    expect(daGrafica.some((n) => n.mensagem.includes("Motivo interno"))).toBe(false);
    const daProducao = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, producao.id), eq(notificacoes.tipo, "ATA_AJUSTE")));
    expect(daProducao.some((n) => n.mensagem.includes("Motivo interno"))).toBe(true);
  });

  it("logística não vê rascunho de outra área na busca nem na lista do evento", async () => {
    const ev = await novoEvento();
    const r = await salvarSolicitacaoCompleta(producao, { eventoId: ev.id, titulo: "Rascunho secreto xyz", observacao: null, enviar: false, itens: [] });
    const achados = await buscar(logistica, "secreto xyz");
    expect(achados.some((x) => x.href.includes(r.id))).toBe(false);
  });

  it("anexo: o tipo vem dos bytes, não do nome", () => {
    expect(detectarMimeAnexo(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe("application/pdf");
    expect(detectarMimeAnexo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectarMimeAnexo(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]))).toBeNull();
  });
});

/** Evento em reunião com uma necessidade pré-reunião da Produção (peça × `qtd`) já na ata. */
async function eventoEmReuniaoComPedido(qtd: number) {
  const ev = await novoEvento();
  const s = await enviar(ev.id, [{ operacao: "ADICIONAR", pecaId, quantidadeSolicitada: qtd, descricoes: descricoesIguais(qtd, "Conforme combinado") }]);
  await transicionarEvento(logistica, ev.id, "INICIAR_REUNIAO");
  const linhaId = s.itens[0].eventoItemGeradoId!;
  return { ev, s, item: s.itens[0], linhaId };
}

async function fecharAta(eventoId: string) {
  await conferirTodasLinhas(logistica, eventoId);
  await salvarDadosReuniao(logistica, eventoId, { reuniaoPresentes: "Logística", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
  await transicionarEvento(logistica, eventoId, "FECHAR_ATA");
}

async function historicoDoItem(itemId: string) {
  const db = await getDb();
  return db.query.historico.findMany({ where: and(eq(historico.entidade, "solicitacao_item"), eq(historico.entidadeId, itemId)), orderBy: [desc(historico.criadoEm)] });
}

describe("caminho único para mudar a quantidade de uma linha da ata", { timeout: 60_000 }, () => {
  it("conferência e aba Ata passam pela resposta do item, com motivo e quantidade esperada", async () => {
    const { ev, s, item, linhaId } = await eventoEmReuniaoComPedido(5);
    // Conferência: abaixo do pedido vira parcial; a linha fica conferida.
    await ajustarLinhaNaConferencia(logistica, ev.id, linhaId, 4, "Uma reservada para outro evento", { quantidadeEsperada: 5 });
    let sol = await obterSolicitacao(logistica, s.id);
    expect(sol.itens[0]).toMatchObject({ status: "PARCIAL", quantidadeAtendida: 4 });
    expect(sol.status).toBe("RESPONDIDA");
    expect((await linha(linhaId)).conferidoEm).not.toBeNull();
    expect((await historicoDoItem(item.id))[0].acao).toBe("RESPOSTA_CORRIGIDA");
    // A tela ainda mostrava 5: recusa em vez de sobrescrever.
    await expect(ajustarLinhaNaConferencia(logistica, ev.id, linhaId, 3, "Outro motivo", { quantidadeEsperada: 5 })).rejects.toThrow("Outra pessoa mudou esta linha para 4 enquanto você editava. Confira e tente de novo.");

    await fecharAta(ev.id);
    const db = await getDb();
    await db.delete(notificacoes);
    const versoesAntes = (await listarOsResumo(ev.id)).length;
    // Aba Ata depois do fechamento: motivo obrigatório, mesma regra (pré-reunião também é corrigida aqui).
    await expect(alterarQuantidadeLinha(logistica, ev.id, linhaId, 5, null)).rejects.toThrow(/motivo/i);
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 5, "Chegou a unidade reservada", { quantidadeEsperada: 4 });
    sol = await obterSolicitacao(logistica, s.id);
    expect(sol.itens[0]).toMatchObject({ status: "ATENDIDO", quantidadeAtendida: 5, pendenciaCompra: false });
    expect((await linha(linhaId)).quantidade).toBe(5);
    expect((await listarOsResumo(ev.id)).length).toBe(versoesAntes + 1);
    const avisos = await db.select().from(notificacoes).where(eq(notificacoes.usuarioId, producao.id));
    expect(avisos.some((n) => n.tipo === "ITEM_RESPONDIDO" && n.mensagem.includes("Atendido integralmente"))).toBe(true);
    // Linha removida por outra pessoa enquanto a tela estava aberta.
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 0, "Cliente desistiu", { quantidadeEsperada: 5 });
    expect((await obterSolicitacao(logistica, s.id)).itens[0]).toMatchObject({ status: "NAO_ATENDIDO", quantidadeAtendida: 0 });
    await expect(alterarQuantidadeLinha(logistica, ev.id, linhaId, 2, "Voltou", { quantidadeEsperada: 5 })).rejects.toThrow(/removeu esta linha/);
  });

  it("atendido integralmente pela aba Ata zera a pendência de compra", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [
      { operacao: "ADICIONAR", pecaId, quantidadeSolicitada: 4, descricoes: descricoesIguais(4, "Conforme combinado") },
      { operacao: "ADICIONAR", descricaoLivre: "Extintor", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") },
    ]);
    await responderItem(logistica, s.itens[0].id, { status: "PARCIAL", quantidadeAtendida: 2, observacaoLogistica: "Só 2 agora", pendenciaCompra: true });
    const linhaId = (await obterSolicitacao(logistica, s.id)).itens[0].eventoItemGeradoId!;
    expect((await obterSolicitacao(logistica, s.id)).status).toBe("EM_ANALISE");
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 3, "Mais uma locada", { quantidadeEsperada: 2 });
    expect((await obterSolicitacao(logistica, s.id)).itens[0]).toMatchObject({ status: "PARCIAL", quantidadeAtendida: 3, pendenciaCompra: true });
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 4, "Locação completa", { quantidadeEsperada: 3 });
    const sol = await obterSolicitacao(logistica, s.id);
    expect(sol.itens[0]).toMatchObject({ status: "ATENDIDO", quantidadeAtendida: 4, pendenciaCompra: false });
    // O outro item continua em análise: a solicitação segue aguardando.
    expect(sol.status).toBe("EM_ANALISE");
  });

  it("desfazer é recusado se a linha da ata foi mexida depois da resposta", async () => {
    const { ev, linhaId } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", pecaId, quantidadeSolicitada: 2, descricoes: descricoesIguais(2, "Conforme combinado") }]);
    await responderItem(logistica, s.itens[0].id, { status: "ATENDIDO" });
    const gerada = (await obterSolicitacao(logistica, s.id)).itens[0].eventoItemGeradoId!;
    await alterarQuantidadeLinha(logistica, ev.id, gerada, 3, "Uma a mais por decisão do cliente");
    await expect(desfazerResposta(logistica, s.itens[0].id)).rejects.toThrow(/alterada ou removida depois da resposta/);

    const alt = await enviar(ev.id, [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 15 }]);
    await responderItem(logistica, alt.itens[0].id, { status: "ATENDIDO" });
    await alterarQuantidadeLinha(logistica, ev.id, linhaId, 12, "Espaço menor");
    await expect(desfazerResposta(logistica, alt.itens[0].id)).rejects.toThrow(/alterada ou removida/);
    expect((await linha(linhaId)).quantidade).toBe(12);
  });
});

describe("atender tudo em lote", { timeout: 60_000 }, () => {
  it("dá o mesmo resultado que responder item a item", async () => {
    const cenario = async () => {
      const { ev, linhaId } = await eventoAberto();
      const outra = await incluirLinhaAta(logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade: 3, destino: "Palco", areaId: producao.areaId, justificativa: "Pedido do cliente" });
      const s = await enviar(ev.id, [
        { operacao: "ADICIONAR", pecaId, quantidadeSolicitada: 2, destino: "Foyer", descricoes: descricoesIguais(2, "Conforme combinado") },
        { operacao: "ADICIONAR", descricaoLivre: "Gerador", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") },
        { operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 12 },
        { operacao: "REMOVER", eventoItemId: outra.id, quantidadeSolicitada: 0 },
      ]);
      return { ev, s };
    };
    const retrato = async (c: Awaited<ReturnType<typeof cenario>>) => {
      const db = await getDb();
      const s = await obterSolicitacao(logistica, c.s.id);
      const ids = s.itens.map((i) => i.id);
      const linhas = await db.query.eventoItens.findMany({ where: eq(eventoItens.eventoId, c.ev.id) });
      const hist = await db.query.historico.findMany({ where: and(eq(historico.entidade, "solicitacao_item"), inArray(historico.entidadeId, ids)) });
      const [os] = await db.select({ conteudo: osVersoes.conteudo }).from(osVersoes).where(eq(osVersoes.eventoId, c.ev.id)).orderBy(desc(osVersoes.numero)).limit(1);
      return {
        status: s.status,
        itens: s.itens.map((i) => ({ status: i.status, atendida: i.quantidadeAtendida, anterior: i.quantidadeAnterior, obs: i.observacaoLogistica, pendencia: i.pendenciaCompra, linha: Boolean(i.eventoItemGeradoId), por: i.respondidoPorId })),
        linhas: linhas
          .map((l) => JSON.stringify({ tipo: l.tipo, quantidade: l.quantidade, ativo: l.ativo, origem: l.origem, destino: l.destino, item: l.solicitacaoItemId ? ids.indexOf(l.solicitacaoItemId) : -1 }))
          .sort(),
        historico: hist.map((h) => JSON.stringify({ acao: h.acao, descricao: h.descricao.replace(s.codigo, "SOL"), depois: h.dadosDepois, item: ids.indexOf(h.entidadeId) })).sort(),
        os: os.conteudo,
      };
    };
    const a = await cenario();
    for (const i of a.s.itens) await responderItem(logistica, i.id, { status: "ATENDIDO" });
    const b = await cenario();
    expect(await atenderTudo(logistica, b.s.id)).toBe(4);
    const ra = await retrato(a);
    expect(ra.status).toBe("RESPONDIDA");
    expect(await retrato(b)).toEqual(ra);
  });
});

describe("becos sem saída do evento", { timeout: 60_000 }, () => {
  it("encerrar cancela devolvidas e rascunhos de alteração; o bloqueio não sugere devolver", async () => {
    const { ev } = await eventoAberto();
    const devolvida = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Palco", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    await devolverSolicitacao(logistica, devolvida.id, "Falta o destino");
    const rascunho = await salvarSolicitacaoCompleta(grafica, { eventoId: ev.id, titulo: "Depois", observacao: null, enviar: false, itens: [] });
    const pendente = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Som", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    const erro = await transicionarEvento(logistica, ev.id, "ENCERRAR").catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toMatch(/sem resposta/);
    expect((erro as Error).message).not.toMatch(/devolv/i);
    await responderItem(logistica, pendente.itens[0].id, { status: "ATENDIDO" });
    const t = await transicionarEvento(logistica, ev.id, "ENCERRAR");
    expect(t.canceladasAuto).toBe(2);
    const db = await getDb();
    for (const id of [devolvida.id, rascunho.id]) {
      expect(await db.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id) })).toMatchObject({ status: "CANCELADA", canceladaMotivo: "Evento encerrado antes do reenvio" });
    }
  });

  it("cancelar o evento não deixa solicitação respondida em parte como cancelada", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [
      { operacao: "ADICIONAR", descricaoLivre: "Tenda", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") },
      { operacao: "ADICIONAR", descricaoLivre: "Mesa", quantidadeSolicitada: 2, descricoes: descricoesIguais(2, "Conforme combinado") },
    ]);
    await responderItem(logistica, s.itens[0].id, { status: "ATENDIDO" });
    const semResposta = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Cadeira", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    await transicionarEvento(logistica, ev.id, "CANCELAR", "Cliente desistiu");
    const depois = await obterSolicitacao(logistica, s.id);
    expect(depois.status).toBe("RESPONDIDA");
    expect(depois.itens.map((i) => i.status)).toEqual(["ATENDIDO", "NAO_ATENDIDO"]);
    expect(depois.itens[1].observacaoLogistica).toBe("Evento cancelado antes da resposta.");
    expect((await obterSolicitacao(logistica, semResposta.id)).status).toBe("CANCELADA");
  });
});

describe("avisos", { timeout: 60_000 }, () => {
  it("área que cancela uma solicitação enviada avisa a logística", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", descricaoLivre: "Painel", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    await cancelarSolicitacao(producao, s.id, "Mudou o plano");
    const db = await getDb();
    const avisos = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, logistica.id), eq(notificacoes.tipo, "SOLICITACAO_CANCELADA")));
    expect(avisos.some((n) => n.link === `/solicitacoes/${s.id}` && n.mensagem.includes("Mudou o plano"))).toBe(true);
  });

  it("reunião remarcada avisa as áreas e o lembrete volta a valer para a nova data", async () => {
    const db = await getDb();
    const ev = await criarEvento(logistica, { nome: "Evento do lembrete", cliente: null, local: null, dataInicio: dia(20), dataReuniao: new Date(Date.now() + 6 * 3_600_000) });
    const estado = globalThis as unknown as { __npeUltimaVerificacao?: number };
    const lembretes = async () => (await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, producao.id), eq(notificacoes.tipo, "LEMBRETE_REUNIAO"), eq(notificacoes.link, `/eventos/${ev.id}`)))).length;
    estado.__npeUltimaVerificacao = undefined;
    await executarVerificacoesSeNecessario();
    expect(await lembretes()).toBe(1);
    estado.__npeUltimaVerificacao = undefined;
    await executarVerificacoesSeNecessario();
    expect(await lembretes()).toBe(1);
    await editarEvento(logistica, ev.id, { nome: ev.nome, cliente: null, local: null, dataInicio: ev.dataInicio, dataReuniao: new Date(Date.now() + 10 * 3_600_000) });
    const remarcada = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, producao.id), eq(notificacoes.tipo, "REUNIAO_REMARCADA"), eq(notificacoes.link, `/eventos/${ev.id}`)));
    expect(remarcada).toHaveLength(1);
    estado.__npeUltimaVerificacao = undefined;
    await executarVerificacoesSeNecessario();
    expect(await lembretes()).toBe(2);
  });

  it("lista de notificações expõe o total para dizer quantas ficaram de fora", async () => {
    const r = await listarNotificacoesComTotal(producao, 1);
    expect(r.itens).toHaveLength(1);
    expect(r.total).toBeGreaterThan(1);
    expect(r.truncada).toBe(true);
  });
});

describe("pendências de compra", { timeout: 60_000 }, () => {
  it("logística marca como resolvida com observação; sai da lista e fica no histórico", async () => {
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", pecaId, quantidadeSolicitada: 5, descricoes: descricoesIguais(5, "Conforme combinado") }]);
    await responderItem(logistica, s.itens[0].id, { status: "PARCIAL", quantidadeAtendida: 3, observacaoLogistica: "Só 3 em estoque", pendenciaCompra: true });
    const lista = await listarPendenciasCompra(logistica, { eventoId: ev.id });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ faltante: 2, respondidoPor: { nome: logistica.nome } });
    await expect(listarPendenciasCompra(producao)).rejects.toThrow(/permissão/);
    await expect(resolverPendenciaCompra(producao, s.itens[0].id, "x")).rejects.toThrow(/permissão/);
    await expect(resolverPendenciaCompra(logistica, s.itens[0].id, "  ")).rejects.toThrow(/resolvida/);
    await resolverPendenciaCompra(logistica, s.itens[0].id, "2 locadas na Tendas Sul");
    expect(await listarPendenciasCompra(logistica, { eventoId: ev.id })).toHaveLength(0);
    const item = (await obterSolicitacao(logistica, s.id)).itens[0];
    expect(item).toMatchObject({ pendenciaCompra: false, status: "PARCIAL" });
    expect(item.observacaoLogistica).toBe("Só 3 em estoque · Compra resolvida: 2 locadas na Tendas Sul");
    expect((await historicoDoItem(item.id))[0].acao).toBe("PENDENCIA_RESOLVIDA");
    const resolvidas = await listarPendenciasResolvidas(logistica, { eventoId: ev.id });
    expect(resolvidas[0]).toMatchObject({ resolucao: "2 locadas na Tendas Sul", faltante: 2, por: logistica.nome });
    await expect(resolverPendenciaCompra(logistica, s.itens[0].id, "de novo")).rejects.toThrow(/já foi resolvida/);
  });
});

describe("catálogo: peça e itens fora do catálogo", { timeout: 60_000 }, () => {
  it("inativar peça usada em pedido aberto avisa com a lista; em projeto ativo bloqueia", async () => {
    const db = await getDb();
    const [p] = await db.insert(pecas).values({ codigo: `PC-IMP-${++seq}`, nome: "Peça do impacto", setor: "ESTRUTURA" }).returning();
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [{ operacao: "ADICIONAR", pecaId: p.id, quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") }]);
    const imp = await impactoInativacaoPeca(logistica, p.id);
    expect(imp.projetos).toHaveLength(0);
    expect(imp.pedidos.some((x) => x.href === `/solicitacoes/${s.id}`)).toBe(true);
    await alterarAtivoPeca(logistica, p.id, false);
    const [pr] = await db.insert(projetos).values({ codigo: `PRJ-IMP-${seq}`, nome: "Projeto do impacto" }).returning();
    const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
    await db.insert(projetoItens).values({ versaoId: v.id, pecaId, quantidade: 2 });
    expect((await impactoInativacaoPeca(logistica, pecaId)).projetos.map((x) => x.rotulo)).toContain(`${pr.codigo} · ${pr.nome}`);
    await expect(alterarAtivoPeca(logistica, pecaId, false)).rejects.toThrow(/projeto/);
  });

  it("vincular item descrito à mão a um projeto grava a versão; peça nova entra na mesma transação", async () => {
    const db = await getDb();
    const [pr] = await db.insert(projetos).values({ codigo: `PRJ-VIN-${++seq}`, nome: "Palco modular" }).returning();
    const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
    await db.insert(projetoItens).values({ versaoId: v.id, pecaId, quantidade: 4 });
    const { ev } = await eventoAberto();
    const s = await enviar(ev.id, [
      { operacao: "ADICIONAR", descricaoLivre: "Palco pequeno", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") },
      { operacao: "ADICIONAR", descricaoLivre: "Totem", quantidadeSolicitada: 1, descricoes: descricoesIguais(1, "Conforme combinado") },
    ]);
    await vincularAoCatalogo(logistica, { solicitacaoItemId: s.itens[0].id }, { tipo: "PROJETO", projetoId: pr.id });
    const item = await db.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, s.itens[0].id) });
    expect(item).toMatchObject({ projetoId: pr.id, projetoVersaoId: v.id });
    const codigo = `TOTEM-${seq}`;
    const peca = (c: string) => ({ codigo: c, nome: "Totem", setor: "MARCENARIA" as const, familia: "", unidade: "un", descricao: null, estoqueProprio: 0, permiteEmProjeto: true });
    await expect(vincularAoCatalogo(logistica, { solicitacaoItemId: s.itens[1].id }, { tipo: "NOVA_PECA", peca: peca("BOX-T") })).rejects.toThrow(/código/);
    await vincularAoCatalogo(logistica, { solicitacaoItemId: s.itens[1].id }, { tipo: "NOVA_PECA", peca: peca(codigo) });
    const nova = await db.query.pecas.findFirst({ where: eq(pecas.codigo, codigo) });
    expect(nova?.ativo).toBe(true);
    expect((await db.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, s.itens[1].id) }))?.pecaId).toBe(nova?.id);
  });
});
