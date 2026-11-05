import { describe, expect, it } from "vitest";
import { atendimentoDaLinha, atendimentoDaPeca, datasPrevistas, estimarVeiculos, inconsistenciasDoEvento, volumePerfil } from "./logistica";

const ev = { dataInicio: "2026-11-10", dataFim: "2026-11-11" };
const dias = { antes: 3, depois: 2 };
const veiculo = (ida: string, volta: string, ativo = true) => ({ ida: { ativo, inicioCarga: ida }, volta: { ativo, descargaGalpao: volta } });

describe("datas previstas", () => {
  it("sem nada informado: data do evento menos X e fim mais Y", () => {
    expect(datasPrevistas(ev, dias)).toEqual({ saida: "2026-11-07", retorno: "2026-11-13", origemSaida: "calculada", origemRetorno: "calculada" });
  });
  it("editada no evento vale mais que a calculada", () => {
    expect(datasPrevistas({ ...ev, saidaPrevista: "2026-11-01", retornoPrevisto: "2026-11-20" }, dias)).toMatchObject({ saida: "2026-11-01", retorno: "2026-11-20", origemSaida: "editada" });
  });
  it("com veículo: o início da primeira carga e a última descarga da volta", () => {
    const r = datasPrevistas({ ...ev, saidaPrevista: "2026-11-01" }, dias, [veiculo("2026-11-08T07:00", "2026-11-14T10:00"), veiculo("2026-11-06T07:00", "2026-11-15T08:00")]);
    expect(r).toMatchObject({ saida: "2026-11-06", retorno: "2026-11-15", origemSaida: "veiculo", origemRetorno: "veiculo" });
  });
  it("trecho descartado ou vazio não conta", () => {
    expect(datasPrevistas(ev, dias, [veiculo("2026-11-08T07:00", "2026-11-14T10:00", false), veiculo("", "")])).toMatchObject({ origemSaida: "calculada", origemRetorno: "calculada" });
  });
});

describe("Atende por", () => {
  it("critério: mudar a Estrutura muda as linhas de estrutura e tendas que ninguém editou", () => {
    const estrutura = { atendePor: null, grupo: "ESTRUTURA" as const };
    const tenda = { atendePor: null, grupo: "TENDAS" as const };
    expect(atendimentoDaLinha(estrutura, "PROPRIA").atendePor).toBe("GALPAO_NORTE");
    expect(atendimentoDaLinha(estrutura, "TERCEIRIZADA").atendePor).toBe("FORNECEDOR_EXTERNO");
    expect(atendimentoDaLinha(tenda, "TERCEIRIZADA").atendePor).toBe("FORNECEDOR_EXTERNO");
  });
  it("o resto vai do galpão, e a linha editada fica como a cenografia deixou", () => {
    expect(atendimentoDaLinha({ atendePor: null, grupo: "ARENA" }, "TERCEIRIZADA").atendePor).toBe("GALPAO_NORTE");
    expect(atendimentoDaLinha({ atendePor: "GALPAO_NORTE", grupo: "ESTRUTURA" }, "TERCEIRIZADA")).toEqual({ atendePor: "GALPAO_NORTE", aDefinir: false, herdado: false });
  });
  it("a definir continua do galpão, com a marca", () => {
    expect(atendimentoDaLinha({ atendePor: null, grupo: "ESTRUTURA" }, "A_DEFINIR")).toEqual({ atendePor: "GALPAO_NORTE", aDefinir: true, herdado: true });
  });
  it("no projeto terceirizado, só box truss e tendas ficam com o fornecedor", () => {
    const a = atendimentoDaLinha({ atendePor: null, grupo: "ESTRUTURA" }, "TERCEIRIZADA");
    expect(atendimentoDaPeca(a, "ESTRUTURA").atendePor).toBe("FORNECEDOR_EXTERNO");
    expect(atendimentoDaPeca(a, "TENDA").atendePor).toBe("FORNECEDOR_EXTERNO");
    expect(atendimentoDaPeca(a, "MARCENARIA").atendePor).toBe("GALPAO_NORTE");
    const manual = atendimentoDaLinha({ atendePor: "FORNECEDOR_EXTERNO", grupo: "ARENA" }, "PROPRIA");
    expect(atendimentoDaPeca(manual, "MARCENARIA").atendePor).toBe("FORNECEDOR_EXTERNO");
  });
});

describe("cubagem", () => {
  const carreta = { tipo: "carreta" as const, nome: "Carreta 15,3", comprimentoM: 15.3, larguraM: 2.5, alturaM: 3, redutorPct: 15 };
  it("volume do perfil e veículos arredondados para cima, com o redutor", () => {
    expect(volumePerfil(carreta)).toBeCloseTo(114.75);
    const r = estimarVeiculos([{ pecaId: "a", quantidade: 100, volumeM3: 2 }], [carreta]);
    expect(r.volumeTotal).toBe(200);
    expect(r.porPerfil[0].veiculos).toBe(3);
  });
  it("peça sem m³ não some: a estimativa diz que está incompleta", () => {
    const r = estimarVeiculos([{ pecaId: "a", quantidade: 1, volumeM3: null }, { pecaId: "a", quantidade: 2, volumeM3: null }, { pecaId: "b", quantidade: 1, volumeM3: 1 }], [carreta]);
    expect(r.pecasSemVolume).toBe(1);
    expect(r.porPerfil[0].veiculos).toBe(1);
  });
  it("volume exato não pede um veículo a mais", () => {
    expect(estimarVeiculos([{ pecaId: "a", quantidade: 1, volumeM3: 97.5375 }], [carreta]).porPerfil[0].veiculos).toBe(1);
  });
});

describe("saneamento", () => {
  it("EVT-0269: evento antes da reunião, e reunião que passou sem começar", () => {
    const e = { dataInicio: "2026-10-08", diaReuniao: "2026-10-20", status: "PREPARACAO", saida: "2026-10-05", retorno: "2026-10-10" };
    expect(inconsistenciasDoEvento(e, "2026-11-04")).toEqual(["EVENTO_ANTES_DA_REUNIAO", "REUNIAO_PASSOU"]);
    expect(inconsistenciasDoEvento({ ...e, dataInicio: "2026-11-08", status: "ABERTO" }, "2026-11-04")).toEqual([]);
    expect(inconsistenciasDoEvento({ ...e, dataInicio: "2026-11-08", status: "ABERTO", retorno: "2026-10-01" }, "2026-11-04")).toEqual(["RETORNO_ANTES_DA_SAIDA"]);
  });
});
