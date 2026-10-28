/**
 * Auditoria de lógica (28/10) — ajustes depois da ata (versões da OS, avisos, justificativa) e repetição de ações.
 * Cada `it` descreve o resultado ESPERADO; os que falham comprovam um achado do relatório
 * docs/auditoria/2026-10-28-logic-auditor.md (o número do achado está no título).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, notificacoes, osVersoes, pecas, projetoItens, projetoVersoes, projetos } from "@/server/db/schema";
import { criarPeca, enviarSolicitacao, fecharAta, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { incluirLinhaAta, transicionarEvento } from "./eventos";
import { acompanhantesDaAta, ajustarTendasDoLocal, completarAcompanhante, definirExtraDaRegra, obterConferencia } from "./conferencia";
import { editarProjeto } from "./projetos";

let E: Elenco;
let tendaId: string;
let cocho: string;
let prisma: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const codigos = ["TND5-CANT", "TND5-TRAV", "TND5-PE", "TND5-MASTRO", "TND5-CABO", "TND5-CALHA", "TND5-FECH"];
  const criadas = await db.insert(pecas).values(codigos.map((codigo) => ({ codigo, nome: codigo, setor: "ESTRUTURA" as const }))).returning();
  const id = (c: string) => criadas.find((p) => p.codigo === c)!.id;
  const [pr] = await db.insert(projetos).values({ codigo: "PRJ-TENDA5-AUD2", nome: "Tenda 5×5 m" }).returning();
  const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
  await db.insert(projetoItens).values([
    { versaoId: v.id, pecaId: id("TND5-CANT"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-PE"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-CALHA"), quantidade: 1 },
  ]);
  tendaId = pr.id;
  const outras = await db
    .insert(pecas)
    .values([
      { codigo: "COCHO", nome: "Cocho", setor: "ARENA" as const },
      { codigo: "CAV-COCHO", nome: "Cavalete de ferro p/ cocho", setor: "ARENA" as const },
      { codigo: "PRISMA", nome: "Prisma", setor: "ARENA" as const },
      { codigo: "GRADE-2X1", nome: "Grade 2×1 m", setor: "ARENA" as const },
    ])
    .returning();
  cocho = outras.find((p) => p.codigo === "COCHO")!.id;
  prisma = outras.find((p) => p.codigo === "PRISMA")!.id;
}, 180_000);

const versoes = async (eventoId: string) => (await (await getDb()).select({ n: osVersoes.numero }).from(osVersoes).where(eq(osVersoes.eventoId, eventoId))).length;

describe("auditoria · depois da ata", () => {
  it("P2-4b · um salvamento do quadro de tendas com a ata fechada avisa a área UMA vez", async () => {
    const ev = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.admin, ev.id, [{ operacao: "ADICIONAR", projetoId: tendaId, quantidadeSolicitada: 2, destino: "GV", descricoes: descricoesIguais(2, "Tenda") }]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const db = await getDb();
    const inicio = new Date(Date.now() - 1);
    const ls = (await obterConferencia(ev.id)).filter((l) => l.tenda && l.destino === "GV");
    await ajustarTendasDoLocal(E.admin, ev.id, { linhaIds: ls.map((l) => l.id), tendas: 3, totais: { fechamento: 5, calha: 4 }, motivo: "Cliente pediu mais uma tenda" });
    const avisos = await db.select({ titulo: notificacoes.titulo, mensagem: notificacoes.mensagem }).from(notificacoes).where(and(eq(notificacoes.usuarioId, E.requisitante.id), gt(notificacoes.criadoEm, inicio)));
    expect(avisos.length, avisos.map((a) => `${a.titulo} | ${a.mensagem}`).join("\n")).toBe(1);
  });

  it("P3-8 · completar acompanhante clicado duas vezes (ou por duas pessoas) não duplica os cavaletes", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId: (await criarPeca()).id, descricaoLivre: null, quantidade: 1, destino: null, areaId: null, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    // Depois da ata a regra não acompanha mais: 3 cochos entram e faltam 6 cavaletes.
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId: cocho, descricaoLivre: null, quantidade: 3, destino: null, areaId: null, justificativa: "Posto extra" });
    const antes = (await acompanhantesDaAta(ev.id)).find((n) => n.codigo === "CAV-COCHO")!;
    expect(antes).toMatchObject({ precisa: 6, naAta: 0 });
    await Promise.allSettled([completarAcompanhante(E.logistica, ev.id, "CAV-COCHO"), completarAcompanhante(E.logistica2, ev.id, "CAV-COCHO")]);
    const depois = (await acompanhantesDaAta(ev.id)).find((n) => n.codigo === "CAV-COCHO")!;
    expect(depois.naAta).toBe(6);
  });

  it("P3-9 · grades a mais do prisma (ajuste da conferência) não entram na OS depois da ata sem justificativa", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId: prisma, descricaoLivre: null, quantidade: 2, destino: null, areaId: null, justificativa: null });
    const db = await getDb();
    const regra = await db.query.eventoItens.findFirst({ where: and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "grade-prisma")) });
    expect(regra?.quantidade).toBe(4);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const antesV = await versoes(ev.id);
    // Com a ata fechada, a "conferência" não deveria mais mexer (o ajuste da linha recusa: "A conferência acontece antes de fechar a ata").
    const r = await definirExtraDaRegra(E.logistica, ev.id, regra!.id, 3, "").then(() => "aceitou", (e: Error) => `recusou: ${e.message}`);
    expect({ r, versoes: (await versoes(ev.id)) - antesV }).toMatchObject({ versoes: 0 });
  });

  it("P2-6 · projeto editado na Biblioteca muda a OS de evento com ata fechada: a área que pediu fica sabendo", async () => {
    const ev = await novoEvento(E.logistica);
    const db = await getDb();
    const peca = await criarPeca();
    const [pr] = await db.insert(projetos).values({ codigo: "PRJ-STAND-AUD", nome: "Stand de auditoria" }).returning();
    const [v1] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
    await db.insert(projetoItens).values({ versaoId: v1.id, pecaId: peca.id, quantidade: 4 });
    await enviarSolicitacao(E.requisitante, E.admin, ev.id, [{ operacao: "ADICIONAR", projetoId: pr.id, quantidadeSolicitada: 2, destino: null, descricoes: descricoesIguais(2, "Stand") }]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const antesV = await versoes(ev.id);
    const inicio = new Date(Date.now() - 1);
    // A Cenografia (sem ata.ajustar) troca a lista de peças: 4 → 1 por stand.
    await editarProjeto(E.cenografia, pr.id, { nome: pr.nome, categoria: "Estrutura", descricao: null, observacaoVersao: "Stand mais leve", itens: [{ pecaId: peca.id, quantidade: 1 }] });
    expect(await versoes(ev.id)).toBe(antesV + 1);
    const avisosArea = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, E.requisitante.id), gt(notificacoes.criadoEm, inicio)));
    expect(avisosArea.length).toBeGreaterThan(0);
  });
});
