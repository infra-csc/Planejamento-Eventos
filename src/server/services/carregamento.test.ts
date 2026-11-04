/** Carregamento: logística altera com observação opcional, quem pediu é avisado e a OS não muda. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, notificacoes, osVersoes } from "@/server/db/schema";
import { aplicarCarregamento } from "@/domain/carregamento";
import { calcularOsAtual } from "./os";
import { criarPeca, eventoAberto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { obterCarregamento, salvarCarregamento } from "./carregamento";

let E: Elenco;
let peca: Awaited<ReturnType<typeof criarPeca>>;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  peca = await criarPeca();
}, 120_000);

const avisos = async (usuarioId: string) => (await getDb()).select().from(notificacoes).where(and(eq(notificacoes.usuarioId, usuarioId), eq(notificacoes.tipo, "CARREGAMENTO_AJUSTE")));

describe("salvarCarregamento", () => {
  it("só logística e administrador alteram", async () => {
    const { ev } = await eventoAberto(E.logistica, peca.id, null);
    for (const u of [E.requisitante, E.gestao, E.cenografia]) await expect(salvarCarregamento(u, ev.id, [{ chave: peca.codigo, carregado: 1, motivo: "x" }])).rejects.toThrow();
  });

  it("antes de a ata fechar, recusa", async () => {
    const ev = await novoEvento(E.logistica);
    await expect(salvarCarregamento(E.logistica, ev.id, [{ chave: peca.codigo, carregado: 1, motivo: "x" }])).rejects.toThrow(/ata fecha/);
  });

  it("a observação é opcional", async () => {
    const { ev } = await eventoAberto(E.logistica, peca.id, E.areas.a.id);
    await salvarCarregamento(E.logistica, ev.id, [{ chave: peca.codigo, carregado: 7, motivo: "  " }]);
    expect((await obterCarregamento(ev.id))[peca.codigo]).toMatchObject({ carregado: 7, motivo: "" });
  });

  it("grava o carregado com o motivo, não gera versão da OS nem muda a ata", async () => {
    const { ev } = await eventoAberto(E.logistica, peca.id, E.areas.a.id);
    const db = await getDb();
    const versoes = async () => (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
    const antes = await versoes();
    const linhasAntes = await db.select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id));
    await salvarCarregamento(E.logistica, ev.id, [{ chave: peca.codigo, carregado: 7, motivo: "Faltou no galpão" }]);
    const c = await obterCarregamento(ev.id);
    expect(c[peca.codigo]).toMatchObject({ carregado: 7, pedidoNaHora: 10, motivo: "Faltou no galpão", porNome: E.logistica.nome });
    expect(await versoes()).toBe(antes);
    expect((await db.select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id))).map((l) => l.quantidade)).toEqual(linhasAntes.map((l) => l.quantidade));
    const os = await calcularOsAtual(db, ev.id);
    expect(os.setores[0].linhas[0].total).toBe(10);
    expect(aplicarCarregamento(os, c).setores[0].linhas[0].total).toBe(7);
  });

  it("voltar ao número do pedido apaga o ajuste", async () => {
    const { ev } = await eventoAberto(E.logistica, peca.id, null);
    await salvarCarregamento(E.logistica, ev.id, [{ chave: peca.codigo, carregado: 3, motivo: "Faltou" }]);
    await salvarCarregamento(E.logistica, ev.id, [{ chave: peca.codigo, carregado: 10, motivo: "" }]);
    expect(await obterCarregamento(ev.id)).toEqual({});
  });

  it("item a mais: peça que a OS não tem, por id", async () => {
    const { ev } = await eventoAberto(E.logistica, peca.id, null);
    const outra = await criarPeca();
    await salvarCarregamento(E.logistica, ev.id, [{ pecaId: outra.id, carregado: 5, motivo: "Pediram no galpão" }]);
    expect((await obterCarregamento(ev.id))[outra.codigo]).toMatchObject({ carregado: 5, pedidoNaHora: 0 });
  });

  it("avisa quem pediu no evento, com o que mudou; nunca quem alterou", async () => {
    const { enviarSolicitacao, fecharAta, itemAvulso } = await import("@/test/apoio");
    const { transicionarEvento } = await import("./eventos/transicoes");
    const ev = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Lona especial", 5)]);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const { chaveFora } = await import("@/domain/carregamento");
    const antesDele = (await avisos(E.requisitante.id)).length;
    await salvarCarregamento(E.logistica, ev.id, [{ chave: chaveFora("Lona especial", null), carregado: 2, motivo: "Rasgou" }]);
    const dele = await avisos(E.requisitante.id);
    expect(dele.length).toBe(antesDele + 1);
    const ultimo = dele.find((n) => n.link === `/eventos/${ev.id}/carregamento`)!;
    expect(ultimo.mensagem).toContain("5 → 2");
    expect(ultimo.mensagem).toContain("Rasgou");
    expect(ultimo.titulo).toContain("Carregamento mudou");
    expect((await avisos(E.logistica.id)).some((n) => n.link === `/eventos/${ev.id}/carregamento`)).toBe(false);
  });
});
