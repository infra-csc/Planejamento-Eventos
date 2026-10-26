/** Cantoneira universal (26/10): a da tenda 3×3 entra na da 5×5 em projetos, atas, solicitações e OS antigas. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, pecas, projetoItens, projetoVersoes, projetos, solicitacaoItens, type OsConteudo } from "@/server/db/schema";
import { incluirPeca, incluirProjeto, migrarBanco, montarElenco, novoEvento, rascunho, type Elenco } from "@/test/apoio";
import { osParaLeitura } from "@/domain/os";
import { kitDaTenda } from "@/domain/tendas";
import { unificarCantoneiras } from "./cantoneira-universal";

let E: Elenco;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("cantoneira universal", () => {
  it("a da 3×3 entra na universal em todo lugar, somando, uma vez só; rascunho não perde nada", async () => {
    const db = await getDb();
    const [c5, c3, pe3] = await db
      .insert(pecas)
      .values([
        { codigo: "TND5-CANT", nome: "Cantoneira de tenda 5×5", setor: "TENDA", familia: "Tenda 5×5" },
        { codigo: "TND3-CANT", nome: "Cantoneira de tenda 3×3", setor: "TENDA", familia: "Tenda 3×3" },
        { codigo: "TND3-PE", nome: "Pé de tenda 3×3", setor: "TENDA", familia: "Tenda 3×3" },
      ])
      .returning();
    // Tenda 3×3 (cantoneira 3×3) e um projeto que levava as duas cantoneiras.
    const [tenda3] = await db.insert(projetos).values({ codigo: "PRJ-T3", nome: "Tenda 3×3 m", categoria: "Tenda" }).returning();
    const [v3] = await db.insert(projetoVersoes).values({ projetoId: tenda3.id, numero: 1 }).returning();
    await db.insert(projetoItens).values([
      { versaoId: v3.id, pecaId: c3.id, quantidade: 4 },
      { versaoId: v3.id, pecaId: pe3.id, quantidade: 4 },
    ]);
    const [misto] = await db.insert(projetos).values({ codigo: "PRJ-MIX", nome: "Projeto com as duas" }).returning();
    const [vm] = await db.insert(projetoVersoes).values({ projetoId: misto.id, numero: 1 }).returning();
    await db.insert(projetoItens).values([
      { versaoId: vm.id, pecaId: c3.id, quantidade: 2 },
      { versaoId: vm.id, pecaId: c5.id, quantidade: 3 },
    ]);

    const ev = await novoEvento(E.logistica);
    const linhaTenda = await incluirProjeto(E.logistica, ev.id, tenda3.id, 2, null);
    const linhaSolta = await incluirPeca(E.logistica, ev.id, c3.id, 6, null);
    const r = await rascunho(E.requisitante, ev.id);
    await db.insert(solicitacaoItens).values([
      { solicitacaoId: r.id, pecaId: c3.id, quantidadeSolicitada: 3 },
      { solicitacaoId: r.id, projetoId: tenda3.id, quantidadeSolicitada: 1, ajustesBom: [{ pecaId: c3.id, codigo: "TND3-CANT", nome: "Cantoneira de tenda 3×3", quantidade: 2 }] },
    ]);

    const feito = await unificarCantoneiras("teste:cantoneira:1");
    expect(feito).toMatchObject({ feito: true });

    const [u, antiga] = await Promise.all([db.query.pecas.findFirst({ where: eq(pecas.id, c5.id) }), db.query.pecas.findFirst({ where: eq(pecas.id, c3.id) })]);
    expect(u).toMatchObject({ nome: "Cantoneira universal", familia: "Tenda", ativo: true });
    expect(antiga).toMatchObject({ ativo: false });

    const itens = async (versaoId: string) => (await db.select().from(projetoItens).where(eq(projetoItens.versaoId, versaoId))).map((i) => [i.pecaId, i.quantidade]);
    expect(await itens(v3.id)).toEqual(expect.arrayContaining([[c5.id, 4], [pe3.id, 4]]));
    expect(await itens(vm.id)).toEqual([[c5.id, 5]]);

    const linhas = await db.select().from(eventoItens).where(inArray(eventoItens.id, [linhaTenda.id, linhaSolta.id]));
    const tenda = linhas.find((l) => l.id === linhaTenda.id)!;
    expect(tenda.bomSnapshot?.map((b) => [b.codigo, b.quantidade])).toEqual(expect.arrayContaining([["TND5-CANT", 4], ["TND3-PE", 4]]));
    expect(tenda.bomSnapshot?.some((b) => b.pecaId === c3.id)).toBe(false);
    // Continua reconhecida como tenda 3×3 (pelo pé).
    expect(kitDaTenda(tenda.bomSnapshot!.map((b) => b.codigo))?.tamanho).toBe("3×3");
    expect(linhas.find((l) => l.id === linhaSolta.id)!.pecaId).toBe(c5.id);

    const doRascunho = await db.select().from(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, r.id));
    expect(doRascunho).toHaveLength(3);
    expect(doRascunho.find((i) => i.quantidadeSolicitada === 3)!.pecaId).toBe(c5.id);
    expect(doRascunho.find((i) => i.projetoId === tenda3.id)!.ajustesBom).toEqual([{ pecaId: c5.id, codigo: "TND5-CANT", nome: "Cantoneira universal", quantidade: 2 }]);

    expect(await unificarCantoneiras("teste:cantoneira:1")).toEqual({ feito: false });
  });

  it("OS gravada antes: as duas cantoneiras saem numa linha só, somada", () => {
    const linha = (codigo: string, nome: string, total: number) => ({ pecaId: codigo, codigo, nome, unidade: "un", total, origens: [{ descricao: nome, quantidade: total }] });
    const os: OsConteudo = {
      setores: [{ setor: "TENDA", linhas: [linha("TND3-CANT", "Cantoneira de tenda 3×3", 8), linha("TND5-CANT", "Cantoneira de tenda 5×5", 12), linha("TND3-PE", "Pé", 8)], avulsos: [] }],
      semSetor: [],
      projetos: [{ codigo: "PRJ-T3", nome: "Tenda 3×3", versao: 1, quantidade: 2, destino: null, area: null, pecas: [{ codigo: "TND3-CANT", nome: "Cantoneira de tenda 3×3", setor: "TENDA", unidade: "un", porUnidade: 4, total: 8 }] }],
      individuais: [{ codigo: "TND3-CANT", nome: "Cantoneira de tenda 3×3", setor: "TENDA", unidade: "un", quantidade: 2, destino: null, area: null }],
    };
    const lida = osParaLeitura(os);
    expect(lida.setores[0].linhas.map((l) => [l.codigo, l.nome, l.total])).toEqual([
      ["TND5-CANT", "Cantoneira universal", 20],
      ["TND3-PE", "Pé", 8],
    ]);
    expect(lida.projetos![0].pecas[0]).toMatchObject({ codigo: "TND5-CANT", nome: "Cantoneira universal", total: 8 });
    expect(lida.individuais![0]).toMatchObject({ codigo: "TND5-CANT", nome: "Cantoneira universal" });
  });
});
