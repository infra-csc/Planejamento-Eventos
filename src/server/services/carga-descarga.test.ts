/**
 * Carga e descarga do galpão: só logística e administrador; cadastro com as regras da ida e da volta,
 * duplicar (o card por evento passa a ×2), excluir e histórico.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, historico } from "@/server/db/schema";
import { construirOperacoes, idaVazia, operacoesDoVeiculo, voltaVazia, type DadosVeiculo } from "@/domain/carga-descarga";
import { migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { duplicarVeiculoCarga, excluirVeiculoCarga, listarCarga, salvarVeiculoCarga } from "./carga-descarga";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

const carreta: DadosVeiculo = {
  tipo: "carreta",
  ident: "ABC-1234",
  ida: { ...idaVazia("Ibirapuera"), tags: ["estrutura"], inicioCarga: "2026-10-14T08:00", fimCarga: "2026-10-14T12:30", descarga: "2026-10-15T09:00" },
  volta: { ...voltaVazia(), tags: ["estrutura"], fimCarga: "2026-10-18T17:00", descargaGalpao: "2026-10-19T08:30" },
};

describe("carga e descarga", () => {
  it("só logística e administrador veem e cadastram", async () => {
    const ev = await novoEvento(E.logistica);
    for (const u of [E.requisitante, E.gestao, E.cenografia]) {
      await expect(listarCarga(u)).rejects.toThrow();
      await expect(salvarVeiculoCarga(u, { eventoId: ev.id, veiculo: carreta })).rejects.toThrow();
    }
    await expect(salvarVeiculoCarga(E.admin, { eventoId: ev.id, veiculo: carreta })).resolves.toHaveProperty("id");
  });

  it("cadastra, duplica (×2) e exclui, com histórico", async () => {
    const ev = await novoEvento(E.logistica);
    const { id } = await salvarVeiculoCarga(E.logistica, { eventoId: ev.id, veiculo: carreta });
    let r = await listarCarga(E.logistica, { eventoId: ev.id });
    expect(r.veiculos).toHaveLength(1);
    expect(r.veiculos[0]).toMatchObject({ tipo: "carreta", ident: "ABC-1234", criadoPor: "Logística Um", atualizadoPor: null });
    const evento = r.eventos.find((e) => e.id === ev.id)!;
    expect(operacoesDoVeiculo(r.veiculos[0], evento).map((o) => o.data)).toEqual(["2026-10-14", "2026-10-15", "2026-10-18", "2026-10-19"]);

    await duplicarVeiculoCarga(E.logistica, id);
    r = await listarCarga(E.logistica, { eventoId: ev.id });
    expect(r.veiculos).toHaveLength(2);
    expect(r.veiculos[1]).toMatchObject({ tipo: "carreta", ida: carreta.ida, volta: carreta.volta });

    // Edição troca o veículo inteiro (descartar a volta tira as operações dela).
    await salvarVeiculoCarga(E.logistica, { id, eventoId: ev.id, veiculo: { ...carreta, volta: { ...carreta.volta, ativo: false } } });
    r = await listarCarga(E.logistica, { eventoId: ev.id });
    expect(r.veiculos.find((v) => v.id === id)?.volta.ativo).toBe(false);
    expect(r.veiculos.find((v) => v.id === id)?.atualizadoPor).toBe("Logística Um");

    await excluirVeiculoCarga(E.logistica, id);
    expect((await listarCarga(E.logistica, { eventoId: ev.id })).veiculos).toHaveLength(1);

    const db = await getDb();
    const acoes = (await db.select({ acao: historico.acao }).from(historico).where(and(eq(historico.eventoId, ev.id), eq(historico.entidade, "veiculo_carga")))).map((h) => h.acao).sort();
    expect(acoes).toEqual(["CARGA_VEICULO_CRIADO", "CARGA_VEICULO_DUPLICADO", "CARGA_VEICULO_EDITADO", "CARGA_VEICULO_EXCLUIDO"]);
  });

  it("evento cancelado com veículo continua na lista geral, marcado; sem veículo, sai (auditoria 30/10, parte D N2)", async () => {
    const comVeiculo = await novoEvento(E.logistica);
    const semVeiculo = await novoEvento(E.logistica);
    await salvarVeiculoCarga(E.logistica, { eventoId: comVeiculo.id, veiculo: carreta });
    const db = await getDb();
    await db.update(eventos).set({ status: "CANCELADO" }).where(inArray(eventos.id, [comVeiculo.id, semVeiculo.id]));

    const r = await listarCarga(E.logistica);
    expect(r.eventos.find((e) => e.id === comVeiculo.id)).toMatchObject({ ativo: false, cancelado: true });
    expect(r.eventos.some((e) => e.id === semVeiculo.id)).toBe(false);
    // O veículo vira operação no calendário (antes ficava sem evento e era descartado).
    const ops = construirOperacoes(r.eventos, r.veiculos, null);
    expect(ops.some((o) => o.eventoId === comVeiculo.id && o.tipo === "cargaGalpao")).toBe(true);
  });

  it("duplicar recusa evento cancelado ou encerrado, como o salvar e a importação (auditoria 30/10, parte D N3)", async () => {
    const ev = await novoEvento(E.logistica);
    const { id } = await salvarVeiculoCarga(E.logistica, { eventoId: ev.id, veiculo: carreta });
    const db = await getDb();
    await db.update(eventos).set({ status: "ENCERRADO" }).where(eq(eventos.id, ev.id));
    await expect(duplicarVeiculoCarga(E.logistica, id)).rejects.toThrow(/encerrado/);
    await db.update(eventos).set({ status: "CANCELADO" }).where(eq(eventos.id, ev.id));
    await expect(duplicarVeiculoCarga(E.admin, id)).rejects.toThrow(/cancelado/);
    expect((await listarCarga(E.logistica, { eventoId: ev.id })).veiculos).toHaveLength(1);
    // Excluir continua valendo: é assim que a logística libera o caminhão.
    await excluirVeiculoCarga(E.logistica, id);
    expect((await listarCarga(E.logistica, { eventoId: ev.id })).veiculos).toHaveLength(0);
  });

  it("as regras da ida e da volta bloqueiam o salvamento com mensagem clara", async () => {
    const ev = await novoEvento(E.logistica);
    await expect(salvarVeiculoCarga(E.logistica, { eventoId: ev.id, veiculo: { ...carreta, ida: { ...carreta.ida, ativo: false }, volta: { ...carreta.volta, ativo: false } } })).rejects.toThrow(/ao menos um trecho/);
    await expect(salvarVeiculoCarga(E.logistica, { eventoId: ev.id, veiculo: { ...carreta, ida: { ...carreta.ida, fimCarga: "2026-10-14T07:00" } } })).rejects.toThrow(/fim da carga não pode ser antes/);
  });
});
