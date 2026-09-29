/** Conferência: o administrador corrige a descrição das unidades que veio do pedido. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { historico } from "@/server/db/schema";
import { SemPermissaoError } from "@/domain/errors";
import { enviarSolicitacao, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { editarDescricoesLinha, obterConferencia } from "./conferencia";
import { incluirLinhaAta } from "./eventos/ata";

let E: Elenco;
let eventoId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  eventoId = (await novoEvento(E.logistica)).id;
  await enviarSolicitacao(E.requisitante, E.logistica, eventoId, [itemAvulso("Placa de balcão", 3)]);
}, 120_000);

const linhaDaPlaca = async () => (await obterConferencia(eventoId)).find((l) => l.nome === "Placa de balcão")!;

describe("editar descrição na conferência", () => {
  it("o administrador troca a descrição por unidade; quem pediu vê a nova e o histórico guarda a antiga", async () => {
    const l = await linhaDaPlaca();
    expect(l.origem?.descricoes).toEqual([{ texto: "Conforme combinado", unidades: 3 }]);
    await editarDescricoesLinha(E.admin, eventoId, l.id, [
      { texto: "PALCO", unidades: 2 },
      { texto: "KIT", unidades: 1 },
    ]);
    expect((await linhaDaPlaca()).origem?.descricoes).toEqual([
      { texto: "PALCO", unidades: 2 },
      { texto: "KIT", unidades: 1 },
    ]);
    const [h] = await (await getDb()).select().from(historico).where(and(eq(historico.entidadeId, l.id), eq(historico.acao, "DESCRICAO_EDITADA")));
    expect(h.descricao).toContain("Conforme combinado");
    // Um texto só vale para todas as unidades.
    await editarDescricoesLinha(E.admin, eventoId, l.id, [{ texto: "Arte única", unidades: 3 }]);
    expect((await linhaDaPlaca()).origem?.descricoes).toEqual([{ texto: "Arte única", unidades: 3 }]);
  });

  it("só o administrador; e linha sem pedido não tem descrição para editar", async () => {
    const l = await linhaDaPlaca();
    await expect(editarDescricoesLinha(E.logistica, eventoId, l.id, [{ texto: "X", unidades: 3 }])).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(editarDescricoesLinha(E.requisitante, eventoId, l.id, [{ texto: "X", unidades: 3 }])).rejects.toBeInstanceOf(SemPermissaoError);
    const avulsa = await incluirLinhaAta(E.logistica, eventoId, { referenciaTipo: "AVULSO", projetoId: null, pecaId: null, descricaoLivre: "Item da reunião", quantidade: 1, destino: null, areaId: null, justificativa: null });
    await expect(editarDescricoesLinha(E.admin, eventoId, avulsa.id, [{ texto: "X", unidades: 1 }])).rejects.toThrow("não veio de um pedido");
  });
});
