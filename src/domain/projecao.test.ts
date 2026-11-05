import { describe, expect, it } from "vitest";
import { eventosDoPeriodo, projetar, semanasDoPeriodo, type Cobertura, type Demanda, type OpcoesProjecao } from "./projecao";

const A1 = "alm-1";
const d = (parcial: Partial<Demanda> & Pick<Demanda, "eventoId" | "quantidade" | "saida" | "retorno">): Demanda => ({
  eventoCodigo: parcial.eventoId,
  eventoNome: parcial.eventoId,
  tourId: null,
  tourNome: null,
  pecaId: "box",
  almoxarifadoId: A1,
  camada: "CONFIRMADA",
  tipoItem: "RETORNAVEL",
  aDefinir: false,
  origem: "Produção",
  ...parcial,
});
const opcoes = (parcial: Partial<OpcoesProjecao> = {}): OpcoesProjecao => ({ inicio: "2026-11-02", semanas: 4, camadas: ["ESTIMADA", "CONFIRMADA", "COMPROMETIDA", "FISICA"], incluirADefinir: true, almoxarifadoId: null, ...parcial });
const rodar = (demandas: Demanda[], extra: { saldo?: number; coberturas?: Cobertura[]; opcoes?: Partial<OpcoesProjecao>; minimo?: number; contadoEm?: string } = {}) =>
  projetar({
    pecas: [{ id: "box", estoqueMinimo: extra.minimo ?? null }],
    saldos: [{ pecaId: "box", almoxarifadoId: A1, quantidade: extra.saldo ?? 100, contadoEm: extra.contadoEm ?? "2026-10-20" }],
    almoxarifados: [{ id: A1, contadoEm: extra.contadoEm ?? "2026-10-20" }],
    demandas,
    coberturas: extra.coberturas ?? [],
    opcoes: opcoes(extra.opcoes),
  });
const cobertura = (parcial: Partial<Cobertura>): Cobertura => ({ id: "c1", tipo: "LOCACAO", pecaId: "box", almoxarifadoId: A1, quantidade: 10, dataEntrada: "2026-11-01", dataDevolucao: "2026-11-20", rotulo: "Locador A", ...parcial });

describe("critérios de aceite do briefing", () => {
  it("1. conflito simples: 100 em estoque, 60 e 50 sobrepostos, faltam 10 entre 08 e 10/11", () => {
    const r = rodar([d({ eventoId: "A", quantidade: 60, saida: "2026-11-05", retorno: "2026-11-10" }), d({ eventoId: "B", quantidade: 50, saida: "2026-11-08", retorno: "2026-11-12" })]);
    expect(r.linhas[0].celulas[0]).toMatchObject({ inicio: "2026-11-02", minimo: -10, dia: "2026-11-08", tom: "falta" });
    expect(r.faltas).toHaveLength(2);
    expect(r.faltas[0]).toMatchObject({ pecaId: "box", faltam: 10, dia: "2026-11-08" });
    // Na semana seguinte, A voltou em 10/11: o menor dia é com B fora.
    expect(r.linhas[0].celulas[1].minimo).toBe(-10);
    expect(r.linhas[0].celulas[2].minimo).toBe(100);
  });

  it("2. tour: retornável fica fora pelo maior valor, da primeira saída ao último retorno", () => {
    const tour = { tourId: "t", tourNome: "CDE" };
    const r = rodar(
      [
        d({ eventoId: "FOR", quantidade: 30, saida: "2026-11-03", retorno: "2026-11-06", ...tour }),
        d({ eventoId: "REC", quantidade: 40, saida: "2026-11-07", retorno: "2026-11-10", ...tour }),
        d({ eventoId: "SSA", quantidade: 35, saida: "2026-11-11", retorno: "2026-11-15", ...tour }),
      ],
    );
    expect(r.linhas[0].celulas.map((c) => c.minimo)).toEqual([60, 60, 100, 100]);
    expect(r.avisos).toEqual([]);
  });

  it("2. tour: consumível soma tudo e não volta", () => {
    const tour = { tourId: "t", tourNome: "CDE", tipoItem: "CONSUMIVEL" as const };
    const r = rodar(
      [
        d({ eventoId: "FOR", quantidade: 100, saida: "2026-11-03", retorno: "2026-11-06", ...tour }),
        d({ eventoId: "REC", quantidade: 120, saida: "2026-11-07", retorno: "2026-11-10", ...tour }),
        d({ eventoId: "SSA", quantidade: 90, saida: "2026-11-11", retorno: "2026-11-15", ...tour }),
      ],
      { saldo: 500 },
    );
    expect(r.linhas[0].celulas.map((c) => c.minimo)).toEqual([190, 190, 190, 190]);
  });

  it("dois eventos do tour ao mesmo tempo: avisa que o maior não basta", () => {
    const tour = { tourId: "t", tourNome: "CDE" };
    const r = rodar([d({ eventoId: "A", quantidade: 30, saida: "2026-11-03", retorno: "2026-11-10", ...tour }), d({ eventoId: "B", quantidade: 40, saida: "2026-11-05", retorno: "2026-11-12", ...tour })]);
    expect(r.avisos).toEqual([{ tourId: "t", tourNome: "CDE", pecaId: "box", pedido: 70, maior: 40 }]);
  });

  it("3. cenário: tirar a camada estimada tira da conta o que ainda não foi aceito", () => {
    const ds = [d({ eventoId: "A", quantidade: 60, saida: "2026-11-05", retorno: "2026-11-10" }), d({ eventoId: "B", quantidade: 50, saida: "2026-11-05", retorno: "2026-11-10", camada: "ESTIMADA" })];
    expect(rodar(ds).linhas[0].celulas[0].minimo).toBe(-10);
    expect(rodar(ds, { opcoes: { camadas: ["CONFIRMADA"] } }).linhas[0].celulas[0].minimo).toBe(40);
  });

  it("6. rastreio: toda célula vermelha tem os eventos que a causam", () => {
    const ds = [d({ eventoId: "A", quantidade: 60, saida: "2026-11-05", retorno: "2026-11-10" }), d({ eventoId: "B", quantidade: 50, saida: "2026-11-08", retorno: "2026-11-12" })];
    const r = rodar(ds);
    for (const f of r.faltas) expect(eventosDoPeriodo(ds, f.pecaId, f.dia, f.dia).map((x) => x.eventoId)).toEqual(["A", "B"]);
  });
});

describe("saldo contado, cobertura e filtros", () => {
  it("evento que saiu antes da contagem: a peça não estava lá, então só a volta soma", () => {
    const r = rodar([d({ eventoId: "A", quantidade: 30, saida: "2026-10-15", retorno: "2026-11-04" })], { saldo: 70 });
    expect(r.linhas[0].celulas[0].minimo).toBe(70);
    expect(r.linhas[0].celulas[1].minimo).toBe(100);
  });

  it("evento que voltou antes da contagem não mexe mais no saldo", () => {
    expect(rodar([d({ eventoId: "A", quantidade: 30, saida: "2026-10-01", retorno: "2026-10-10" })]).linhas[0].celulas[0].minimo).toBe(100);
  });

  it("locação prevista cobre a falta e a falta some; na devolução o saldo desce", () => {
    const ds = [d({ eventoId: "A", quantidade: 110, saida: "2026-11-05", retorno: "2026-11-30" })];
    expect(rodar(ds).faltas).toHaveLength(4);
    const coberto = rodar(ds, { coberturas: [cobertura({ quantidade: 10, dataEntrada: "2026-11-01", dataDevolucao: "2026-11-30" })] });
    expect(coberto.faltas).toEqual([]);
    const devolveCedo = rodar(ds, { coberturas: [cobertura({ quantidade: 10, dataEntrada: "2026-11-01", dataDevolucao: "2026-11-20" })] });
    expect(devolveCedo.faltas.map((f) => f.inicio)).toEqual(["2026-11-16", "2026-11-23"]);
  });

  it("compra prevista fica: não tem devolução", () => {
    const r = rodar([d({ eventoId: "A", quantidade: 110, saida: "2026-11-05", retorno: "2026-11-30" })], { coberturas: [cobertura({ tipo: "COMPRA", quantidade: 20, dataEntrada: "2026-11-01", dataDevolucao: null })] });
    expect(r.faltas).toEqual([]);
    expect(r.linhas[0].celulas[0].minimo).toBe(10);
  });

  it("abaixo do mínimo fica amarelo; negativo fica vermelho", () => {
    const r = rodar([d({ eventoId: "A", quantidade: 95, saida: "2026-11-05", retorno: "2026-11-10" })], { minimo: 10 });
    expect(r.linhas[0].celulas[0]).toMatchObject({ minimo: 5, tom: "atencao" });
    expect(r.linhas[0].celulas[2]).toMatchObject({ minimo: 100, tom: "ok" });
  });

  it("a definir só entra com o filtro marcado", () => {
    const ds = [d({ eventoId: "A", quantidade: 60, saida: "2026-11-05", retorno: "2026-11-10", aDefinir: true })];
    expect(rodar(ds).linhas[0].celulas[0].minimo).toBe(40);
    expect(rodar(ds, { opcoes: { incluirADefinir: false } }).linhas).toEqual([]);
  });

  it("consolidado soma os almoxarifados; o separado olha um só; o não liberado fica de fora", () => {
    const r = projetar({
      pecas: [{ id: "box", estoqueMinimo: null }],
      saldos: [
        { pecaId: "box", almoxarifadoId: "a", quantidade: 50, contadoEm: "2026-10-20" },
        { pecaId: "box", almoxarifadoId: "b", quantidade: 30, contadoEm: "2026-10-20" },
      ],
      almoxarifados: [
        { id: "a", contadoEm: "2026-10-20" },
        { id: "b", contadoEm: "2026-10-20" },
      ],
      demandas: [d({ eventoId: "E", quantidade: 60, saida: "2026-11-03", retorno: "2026-11-05", almoxarifadoId: "a" }), d({ eventoId: "X", quantidade: 999, saida: "2026-11-03", retorno: "2026-11-05", almoxarifadoId: "nao-contado" })],
      coberturas: [],
      opcoes: opcoes(),
    });
    expect(r.linhas[0].celulas[0].minimo).toBe(20);
    expect(r.faltas).toEqual([]);
    const soA = projetar({
      pecas: [{ id: "box", estoqueMinimo: null }],
      saldos: [{ pecaId: "box", almoxarifadoId: "a", quantidade: 50, contadoEm: "2026-10-20" }],
      almoxarifados: [{ id: "a", contadoEm: "2026-10-20" }],
      demandas: [d({ eventoId: "E", quantidade: 60, saida: "2026-11-03", retorno: "2026-11-05", almoxarifadoId: "a" })],
      coberturas: [],
      opcoes: opcoes({ almoxarifadoId: "a" }),
    });
    expect(soA.faltas[0].faltam).toBe(10);
  });

  it("peça que a contagem não citou: saldo zero e marcada como não conferida", () => {
    const r = projetar({
      pecas: [{ id: "cone", estoqueMinimo: null }],
      saldos: [],
      almoxarifados: [{ id: A1, contadoEm: "2026-10-20" }],
      demandas: [d({ eventoId: "E", pecaId: "cone", quantidade: 5, saida: "2026-11-03", retorno: "2026-11-05" })],
      coberturas: [],
      opcoes: opcoes(),
    });
    expect(r.linhas[0].naoConferida).toBe(true);
    expect(r.faltas[0].faltam).toBe(5);
  });

  it("a semana começa na segunda", () => {
    expect(semanasDoPeriodo("2026-11-04", 2)).toEqual([
      { inicio: "2026-11-02", fim: "2026-11-08" },
      { inicio: "2026-11-09", fim: "2026-11-15" },
    ]);
  });
});
