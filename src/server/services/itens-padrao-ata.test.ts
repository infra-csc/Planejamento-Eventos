/**
 * A ata não tem mais itens padrão: evento novo nasce sem garfo/estaca/corda/quadro/grade, e as linhas
 * que a criação do evento colocava sozinha saem das atas ainda abertas (as fechadas ficam como estão).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, historico, pecas } from "@/server/db/schema";
import { fecharAta, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { transicionarEvento } from "./eventos/transicoes";
import { retirarItensPadraoDasAtasAbertas } from "./eventos/itens-padrao";
import { registrarHistorico } from "./support";

let E: Elenco;
let garfoId: string;
let estacaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const [g] = await db.insert(pecas).values({ codigo: "GARFO", nome: "Garfo de içamento", setor: "ESTRUTURA" }).returning();
  garfoId = g.id;
  const [e] = await db.insert(pecas).values({ codigo: "ESTACA", nome: "Estaca de estaiamento", setor: "ESTRUTURA" }).returning();
  estacaId = e.id;
}, 120_000);

/** Linha como a criação do evento fazia antes: sem pedido de origem e com o registro "Item padrão da ata". */
async function linhaPadraoAntiga(eventoId: string, pecaId: string, quantidade: number, conferida = false) {
  const db = await getDb();
  const [l] = await db
    .insert(eventoItens)
    .values({ eventoId, tipo: "PECA", pecaId, quantidade, origem: "AJUSTE_LOGISTICA", criadoPorId: E.logistica.id, ...(conferida ? { conferidoEm: new Date(), conferidoPorId: E.logistica.id } : {}) })
    .returning();
  await registrarHistorico(db, { eventoId, entidade: "evento_item", entidadeId: l.id, acao: "ATA_INCLUSAO", descricao: `Item padrão da ata: peça × ${quantidade || "a definir (projetista)"}`, usuarioId: E.logistica.id, dadosDepois: { pecaId, quantidade } });
  return l.id;
}

const linha = async (id: string) => (await (await getDb()).select().from(eventoItens).where(eq(eventoItens.id, id)))[0];

describe("fim dos itens padrão da ata", () => {
  it("evento novo nasce com a ata vazia", async () => {
    const ev = await novoEvento(E.logistica);
    const linhas = await (await getDb()).select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id));
    expect(linhas).toHaveLength(0);
  });

  it("tira as linhas automáticas das atas abertas (mesmo conferidas) e deixa a ata fechada como está", async () => {
    const db = await getDb();
    const preparacao = await novoEvento(E.logistica);
    const garfoPrep = await linhaPadraoAntiga(preparacao.id, garfoId, 2);
    const estacaPrep = await linhaPadraoAntiga(preparacao.id, estacaId, 0);
    // A mesma peça incluída à mão pela logística não é tocada.
    const [manual] = await db.insert(eventoItens).values({ eventoId: preparacao.id, tipo: "PECA", pecaId: garfoId, quantidade: 4, origem: "AJUSTE_LOGISTICA", criadoPorId: E.logistica.id }).returning();

    const reuniao = await novoEvento(E.logistica);
    const garfoReuniao = await linhaPadraoAntiga(reuniao.id, garfoId, 2, true);
    await transicionarEvento(E.admin, reuniao.id, "INICIAR_REUNIAO");

    const fechado = await novoEvento(E.logistica);
    const garfoFechado = await linhaPadraoAntiga(fechado.id, garfoId, 2);
    await transicionarEvento(E.admin, fechado.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, fechado.id);

    expect(await retirarItensPadraoDasAtasAbertas()).toBe(3);
    for (const id of [garfoPrep, estacaPrep, garfoReuniao]) {
      expect(await linha(id)).toMatchObject({ ativo: false, conferidoEm: null, justificativaAjuste: "Deixou de ser item padrão da ata" });
    }
    expect(await linha(manual.id)).toMatchObject({ ativo: true, quantidade: 4 });
    expect(await linha(garfoFechado)).toMatchObject({ ativo: true });

    const [reg] = await db.select().from(historico).where(and(eq(historico.entidadeId, garfoReuniao), eq(historico.acao, "ATA_REMOCAO")));
    expect(reg.descricao).toBe("Garfo de içamento: removido da ata (era 2) · deixou de ser item padrão da ata");

    // Idempotente: rodar de novo (outra instância subindo) não muda nada nem duplica histórico.
    expect(await retirarItensPadraoDasAtasAbertas()).toBe(0);
    expect(await db.select().from(historico).where(and(eq(historico.entidadeId, garfoReuniao), eq(historico.acao, "ATA_REMOCAO")))).toHaveLength(1);
  });
});
