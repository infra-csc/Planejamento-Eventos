/**
 * Alteração enviada dentro da janela entra direto na OS (sem aprovação), a logística só é avisada, e
 * quem pediu pode trocar, incluir ou tirar itens enquanto a janela está aberta.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, notificacoes } from "@/server/db/schema";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { criarPeca, dia, enviarSolicitacao, eventoAberto, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { alterarQuantidadeLinha, obterLinhasAta } from "../eventos";
import { listarOsResumo } from "../os";
import { editarPreReuniaoEnviada, obterSolicitacao } from "../solicitacoes";

let E: Elenco;
let pecaBase: string;
let pecaA: string;
let pecaB: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaBase = (await criarPeca()).id;
  pecaA = (await criarPeca()).id;
  pecaB = (await criarPeca()).id;
}, 120_000);

const item = (pecaId: string, quantidade: number) => ({ operacao: "ADICIONAR" as const, pecaId, quantidadeSolicitada: quantidade, descricoes: descricoesIguais(quantidade, "Na chegada") });
const edicao = (id: string, eventoId: string, itens: ReturnType<typeof item>[]) => ({ id, eventoId, areaId: null, titulo: "Pedido editado", observacao: null, enviar: true, itens });
const qtdDe = async (eventoId: string, pecaId: string) => (await obterLinhasAta(eventoId)).filter((l) => l.registro.pecaId === pecaId).reduce((a, l) => a + l.quantidade, 0);
const versoes = async (eventoId: string) => (await listarOsResumo(eventoId)).length;
const avisosLogistica = async (titulo: RegExp) => {
  const db = await getDb();
  const ns = await db.select({ titulo: notificacoes.titulo }).from(notificacoes).where(and(eq(notificacoes.usuarioId, E.logistica.id)));
  return ns.filter((n) => titulo.test(n.titulo)).length;
};
const definirJanela = async (eventoId: string, ate: string | null) => {
  const db = await getDb();
  await db.update(eventos).set({ janelaAlteracoesAte: ate }).where(eq(eventos.id, eventoId));
};

describe("alteração dentro da janela", () => {
  it("entra direto na OS, sem aprovação, e a logística é avisada", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaBase, E.areas.a.id, { janelaAberta: true });
    const antes = await versoes(ev.id);
    const avisosAntes = await avisosLogistica(/^Alteração na OS/);
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 4)]);
    expect(s.status).toBe("RESPONDIDA");
    expect(s.itens.every((i) => i.status === "ATENDIDO" && i.respondidoPorId === null)).toBe(true);
    expect(await qtdDe(ev.id, pecaA)).toBe(4);
    expect(await versoes(ev.id)).toBe(antes + 1);
    expect(await avisosLogistica(/^Alteração na OS/)).toBe(avisosAntes + 1);
  });

  it("fora da janela continua esperando a decisão da logística", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaBase, E.areas.a.id, { janelaAberta: true });
    await definirJanela(ev.id, dia(-1));
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 2)]);
    expect(s.status).toBe("ENVIADA");
    expect(s.foraDaJanela).toBe(true);
    expect(await qtdDe(ev.id, pecaA)).toBe(0);
  });

  it("quem pediu troca, inclui e tira itens durante a janela; cada edição gera versão e avisa a logística", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaBase, E.areas.a.id, { janelaAberta: true });
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 4)]);
    const antes = await versoes(ev.id);
    const avisosAntes = await avisosLogistica(/^Alteração editada/);

    await editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaA, 6), item(pecaB, 2)]));
    expect(await qtdDe(ev.id, pecaA)).toBe(6);
    expect(await qtdDe(ev.id, pecaB)).toBe(2);
    expect(await versoes(ev.id)).toBe(antes + 1);
    expect(await avisosLogistica(/^Alteração editada/)).toBe(avisosAntes + 1);

    // Tirar um item: some da OS.
    await editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaB, 2)]));
    expect(await qtdDe(ev.id, pecaA)).toBe(0);
    expect(await qtdDe(ev.id, pecaB)).toBe(2);
    const depois = await obterSolicitacao(E.admin, s.id);
    expect(depois.status).toBe("RESPONDIDA");
    expect(depois.itens.map((i) => i.quantidadeSolicitada)).toEqual([2]);
  });

  it("depois que a janela fecha, não edita mais", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaBase, E.areas.a.id, { janelaAberta: true });
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 3)]);
    await definirJanela(ev.id, dia(-1));
    await expect(editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaA, 5)]))).rejects.toThrow(/janela/);
    expect(await qtdDe(ev.id, pecaA)).toBe(3);
  });

  it("linha que a logística ajustou na OS trava a edição (o ajuste não se perde)", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaBase, E.areas.a.id, { janelaAberta: true });
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 4)]);
    const linha = (await obterLinhasAta(ev.id)).find((l) => l.registro.pecaId === pecaA)!;
    await alterarQuantidadeLinha(E.logistica, ev.id, linha.id, 7, "Cliente pediu mais");
    await expect(editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaA, 1)]))).rejects.toThrow(/logística/);
    expect(await qtdDe(ev.id, pecaA)).toBe(7);
  });

  it("outra área não edita", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaBase, E.areas.a.id, { janelaAberta: true });
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 1)]);
    await expect(editarPreReuniaoEnviada(E.requisitanteB, edicao(s.id, ev.id, [item(pecaA, 9)]))).rejects.toThrow();
  });
});
