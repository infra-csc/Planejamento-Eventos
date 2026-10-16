import { describe, expect, it } from "vitest";
import {
  construirOperacoes,
  FILTROS_PADRAO,
  idaVazia,
  operacaoVisivel,
  operacoesDaPlanilha,
  operacoesDoVeiculo,
  origemDaDescarga,
  segundaDe,
  semanaIso,
  separarItem,
  tagsDoTexto,
  tokens,
  validarVeiculo,
  voltaVazia,
  type DiaPlanilha,
  type EventoCarga,
  type VeiculoCarga,
} from "./carga-descarga";

const ev: EventoCarga = { id: "ev1", codigo: "EVT-0001", nome: "GIRL POWER SP", data: "2026-10-18", local: "Ibirapuera" };
// O exemplo real do briefing (exemplo-veiculo.json).
const veiculo: VeiculoCarga = {
  id: "vh1",
  eventoId: "ev1",
  tipo: "carreta",
  ident: "ABC-1234 / Zaqueu",
  ida: { ...idaVazia("Ibirapuera"), tags: ["estrutura", "ceno"], cargaTexto: "Box, pórtico, tendas", inicioCarga: "2026-10-14T08:00", fimCarga: "2026-10-14T12:30", saida: "2026-10-14T13:00", chegadaDestino: "2026-10-15T07:00", descarga: "2026-10-15T09:00" },
  volta: { ...voltaVazia(), tags: ["estrutura", "ceno"], cargaTexto: "Box, pórtico, tendas", inicioCarga: "2026-10-18T13:00", fimCarga: "2026-10-18T17:00", chegadaGalpao: "2026-10-19T07:00", descargaGalpao: "2026-10-19T08:30" },
};

describe("operações do veículo (tabela 5.1)", () => {
  it("ida e volta completas aparecem nos 4 dias certos, com o horário do card", () => {
    const ops = operacoesDoVeiculo(veiculo, ev);
    expect(ops.map((o) => [o.tipo, o.data, o.hora])).toEqual([
      ["cargaGalpao", "2026-10-14", "12:30"],
      ["descDestino", "2026-10-15", "09:00"],
      ["cargaDestino", "2026-10-18", "17:00"],
      ["descGalpao", "2026-10-19", "08:30"],
    ]);
    expect(ops[3].extra).toBe("fim carga 18/10 17:00");
  });

  it("descartar a ida ou a volta tira as operações do trecho", () => {
    expect(operacoesDoVeiculo({ ...veiculo, ida: { ...veiculo.ida, ativo: false } }, ev).map((o) => o.tipo)).toEqual(["cargaDestino", "descGalpao"]);
    expect(operacoesDoVeiculo({ ...veiculo, volta: { ...veiculo.volta, ativo: false } }, ev).map((o) => o.tipo)).toEqual(["cargaGalpao", "descDestino"]);
  });

  it("sem início da carga, a carga no galpão cai no dia do fim (ou da saída)", () => {
    const so = { ...veiculo, ida: { ...veiculo.ida, inicioCarga: "", fimCarga: "", saida: "2026-10-13T20:00" } };
    expect(operacoesDoVeiculo(so, ev)[0]).toMatchObject({ tipo: "cargaGalpao", data: "2026-10-13", hora: "" });
  });
});

describe("validação (4.3)", () => {
  it("aceita o veículo do exemplo", () => expect(validarVeiculo(veiculo)).toBeNull());
  it("precisa de ao menos um trecho", () => expect(validarVeiculo({ ...veiculo, ida: { ...veiculo.ida, ativo: false }, volta: { ...veiculo.volta, ativo: false } })?.campo).toBe("trechos"));
  it("ida ativa exige início ou fim da carga", () => expect(validarVeiculo({ ...veiculo, ida: { ...veiculo.ida, inicioCarga: "", fimCarga: "" } })?.campo).toBe("ida.inicioCarga"));
  it("volta ativa exige fim/início da carga, chegada ou descarga no galpão", () =>
    expect(validarVeiculo({ ...veiculo, volta: { ...veiculo.volta, inicioCarga: "", fimCarga: "", chegadaGalpao: "", descargaGalpao: "" } })?.campo).toBe("volta.fimCarga"));
  it("fim da carga não pode ser antes do início", () => {
    expect(validarVeiculo({ ...veiculo, ida: { ...veiculo.ida, fimCarga: "2026-10-14T07:00" } })?.campo).toBe("ida.fimCarga");
    expect(validarVeiculo({ ...veiculo, volta: { ...veiculo.volta, fimCarga: "2026-10-18T12:00" } })?.campo).toBe("volta.fimCarga");
  });
});

describe("filtros (5.3)", () => {
  const ops = construirOperacoes([ev], [veiculo], null);
  const n = (f: Partial<typeof FILTROS_PADRAO>) => ops.filter((o) => operacaoVisivel(o, { ...FILTROS_PADRAO, ...f })).map((o) => o.tipo);
  it("direção, só galpão, eventos e tags", () => {
    expect(n({ direcao: "carga" })).toEqual(expect.arrayContaining(["evento", "cargaGalpao", "cargaDestino"]));
    expect(n({ direcao: "carga" })).not.toContain("descGalpao");
    expect(n({ soGalpao: true, eventos: false })).toEqual(["cargaGalpao", "descGalpao"]);
    expect(n({ tags: ["kit"], eventos: false })).toEqual([]);
    expect(n({ tags: ["kit", "ceno"], eventos: false })).toHaveLength(4);
  });
});

describe("planilha 2026", () => {
  const dias: DiaPlanilha[] = [
    { date: "2026-10-14", load: ["GIRL POWER SP (BOX, TENDA)"], kit: ["GIRL POWER SP"], unload: [], events: [], turnos: "1 turno", holiday: null },
    { date: "2026-10-18", load: [], kit: [], unload: [], events: ["GIRL POWER SP"], turnos: null, holiday: null },
    { date: "2026-10-19", load: [], kit: [], unload: ["GIRL POWER SP"], events: [], turnos: null, holiday: null },
    { date: "2026-10-20", load: ["OUTONO BSB (CENO)"], kit: [], unload: [], events: [], turnos: null, holiday: null },
  ];
  it("separa nome e materiais e infere as tags", () => {
    expect(separarItem("OUTONO RJ (BOX, TENDA)")).toEqual({ nome: "OUTONO RJ", materiais: ["BOX", "TENDA"] });
    expect(tagsDoTexto("OUTONO RJ (KIT, ATIVAÇÃO)", "load").sort()).toEqual(["ativacao", "kit"]);
    expect(tagsDoTexto("BRAVUS (1 BOX)", "load")).toEqual(["estrutura"]);
  });
  it("abreviações contam como o nome por extenso", () => {
    expect([...tokens("OUTONO BSB")]).toEqual(["OUTONO", "BRASILIA"]);
  });
  it("evento cadastrado substitui os itens da planilha com o mesmo nome (±30 dias)", () => {
    const plan = operacoesDaPlanilha(dias);
    const ops = construirOperacoes([ev], [veiculo], plan);
    expect(ops.filter((o) => o.origem === "planilha").map((o) => o.nome)).toEqual(["OUTONO BSB"]);
    // Sem veículo, o evento não substitui nada.
    expect(construirOperacoes([ev], [], plan).filter((o) => o.origem === "planilha")).toHaveLength(5);
  });
  it("descarga da planilha acha o evento de origem", () => {
    expect(origemDaDescarga("GIRL POWER SP", "2026-10-19", dias)).toBe("2026-10-18");
  });
});

describe("semanas", () => {
  it("segunda-feira e número da semana", () => {
    expect(segundaDe("2026-10-18")).toBe("2026-10-12");
    expect(semanaIso("2026-10-12")).toBe(42);
  });
});
