/**
 * Auditoria de 30/10 (2ª rodada, parte A): resposta da logística a uma solicitação de alteração.
 * N2 desfazer não deixa duas versões da OS nem dois avisos; N4 alteração de quantidade não atendida não vira
 * "0 de 3"; N9 a recusa de quem respondeu numa aba desatualizada diz o que aconteceu.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { historico, notificacoes, osVersoes } from "@/server/db/schema";
import { criarPeca, enviarSolicitacao, eventoAberto, itemAvulso, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { desfazerResposta, responderItem } from "./solicitacoes";

let E: Elenco;
let pecaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaId = (await criarPeca()).id;
}, 120_000);

const versoesOs = async (eventoId: string) => (await (await getDb()).select({ numero: osVersoes.numero }).from(osVersoes).where(eq(osVersoes.eventoId, eventoId))).length;
const avisosDe = async (usuarioId: string, link: string) => (await getDb()).select({ titulo: notificacoes.titulo, mensagem: notificacoes.mensagem }).from(notificacoes).where(and(eq(notificacoes.usuarioId, usuarioId), eq(notificacoes.link, link)));

describe("desfazer uma resposta de alteração (N2)", { timeout: 120_000 }, () => {
  it("apaga a versão da OS e o aviso que a resposta gerou, em vez de criar outros", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaId, E.requisitante.areaId);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Gerador extra", 2)]);
    const antes = await versoesOs(ev.id);

    await responderItem(E.logistica, s.itens[0].id, { status: "ATENDIDO" });
    expect(await versoesOs(ev.id)).toBe(antes + 1);
    expect(await avisosDe(E.requisitante.id, `/solicitacoes/${s.id}`)).toHaveLength(1);

    await desfazerResposta(E.logistica, s.itens[0].id);
    expect(await versoesOs(ev.id)).toBe(antes);
    // Ninguém tinha lido o "atendido": some, e não chega um "voltou para análise" no lugar.
    expect(await avisosDe(E.requisitante.id, `/solicitacoes/${s.id}`)).toEqual([]);
  });

  it("quem já leu o aviso da resposta recebe o “voltou para análise”", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaId, E.requisitante.areaId);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Mesa extra", 1)]);
    await responderItem(E.logistica, s.itens[0].id, { status: "ATENDIDO" });
    const link = `/solicitacoes/${s.id}`;
    await (await getDb()).update(notificacoes).set({ lidaEm: new Date() }).where(and(eq(notificacoes.usuarioId, E.requisitante.id), eq(notificacoes.link, link)));

    await desfazerResposta(E.logistica, s.itens[0].id);
    const avisos = await avisosDe(E.requisitante.id, link);
    expect(avisos.map((a) => a.titulo)).toEqual([expect.stringMatching(/atendido$/), expect.stringMatching(/voltou para análise$/)]);
  });
});

describe("alteração de quantidade não atendida (N4)", { timeout: 120_000 }, () => {
  it("o aviso e o histórico dizem que fica como estava, não “0 de 3”", async () => {
    const { ev, linhaId } = await eventoAberto(E.logistica, pecaId, E.requisitante.areaId);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 12 }]);
    await responderItem(E.logistica, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "Não há mais peças livres." });

    const [aviso] = await avisosDe(E.requisitante.id, `/solicitacoes/${s.id}`);
    expect(aviso.mensagem).toBe("Fica 10 (sem mudança). Não há mais peças livres.");
    const [h] = await (await getDb()).select({ descricao: historico.descricao }).from(historico).where(and(eq(historico.entidadeId, s.itens[0].id), eq(historico.acao, "RESPONDIDO")));
    expect(h.descricao).toContain("não atendido (fica 10, pedido 12)");
    expect(h.descricao).not.toContain("0 de 12");
  });
});

describe("aba desatualizada (N9)", { timeout: 120_000 }, () => {
  it("responder um item que outra aba já respondeu diz quem respondeu e pede para atualizar", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaId, E.requisitante.areaId);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Palco", 1)]);
    await responderItem(E.logistica, s.itens[0].id, { status: "ATENDIDO" });
    const erro = await responderItem(E.logistica2, s.itens[0].id, { status: "NAO_ATENDIDO", observacaoLogistica: "Sem palco" }).catch((e: Error) => e);
    expect((erro as Error).message).toMatch(/^Este item já foi respondido por Logística Um às \d{2}:\d{2}\. Atualize a página para ver a resposta\.$/);
  });
});
