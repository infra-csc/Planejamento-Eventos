import { describe, expect, it } from "vitest";
import { colunaDoTitulo, interpretarLinha, lerDataHora, lerEvento, lerTags, lerTipo, planejarImportacao, rotuloEventoModelo, type LinhaPlanilha } from "./carga-importacao";

const eventos = [
  { id: "e1", codigo: "EVT-0195", nome: "Bota Pra Correr RJ", data: "2026-10-18", local: "Aterro do Flamengo", ativo: true },
  { id: "e2", codigo: "EVT-0201", nome: "Night Run Salvador", data: "2026-10-17", local: null, ativo: true },
  { id: "e3", codigo: "EVT-0100", nome: "Circuito Antigo", data: "2026-03-01", local: null, ativo: false },
];

// A célula de data do Excel chega como Date com a hora "de parede" em UTC.
const dt = (s: string) => new Date(`${s}:00Z`);

const completa: LinhaPlanilha = {
  evento: rotuloEventoModelo(eventos[0]),
  tipo: "Carreta",
  ident: "ABC-1234",
  idaTags: "Kit, Estrutura",
  idaCarga: "box e pórtico",
  idaInicioCarga: dt("2026-10-16T08:00"),
  idaFimCarga: "16/10/2026 12:30",
  idaDescarga: 46313.25, // série do Excel = 18/10/2026 06:00
  voltaFimCarga: "18/10/26 20:00",
  voltaDescarga: dt("2026-10-19T09:00"),
};

describe("leitura das células", () => {
  it("data e hora: célula do Excel, série, dd/mm/aaaa hh:mm e ISO; data sem hora é erro", () => {
    expect(lerDataHora(dt("2026-10-16T08:00"))).toEqual({ valor: "2026-10-16T08:00" });
    expect(lerDataHora(46313.25)).toEqual({ valor: "2026-10-18T06:00" });
    expect(lerDataHora("16/10/2026 8:05")).toEqual({ valor: "2026-10-16T08:05" });
    expect(lerDataHora("2026-10-16 08:00")).toEqual({ valor: "2026-10-16T08:00" });
    expect(lerDataHora("")).toEqual({ valor: "" });
    expect(lerDataHora("16/10/2026")).toEqual({ erro: "falta a hora" });
    expect(lerDataHora(dt("2026-10-16T00:00"))).toEqual({ erro: "falta a hora" });
    expect(lerDataHora("31/02/2026 10:00")).toHaveProperty("erro");
    expect(lerDataHora("amanhã")).toHaveProperty("erro");
  });

  it("tags com sinônimos e acentos; termo desconhecido é erro", () => {
    expect(lerTags("Kit; cenografia e Ativação")).toEqual({ valor: ["kit", "ceno", "ativacao"] });
    expect(lerTags("tendas, BOX")).toEqual({ valor: ["estrutura"] });
    expect(lerTags("bebidas")).toHaveProperty("erro");
  });

  it("tipo e evento (código, rótulo da lista ou nome exato)", () => {
    expect(lerTipo("Caminhão Truck")).toEqual({ valor: "truck" });
    expect(lerTipo("van")).toHaveProperty("erro");
    expect(lerEvento("evt-0201", eventos)).toMatchObject({ valor: { id: "e2" } });
    expect(lerEvento(rotuloEventoModelo(eventos[0]), eventos)).toMatchObject({ valor: { id: "e1" } });
    expect(lerEvento("night run salvador", eventos)).toMatchObject({ valor: { id: "e2" } });
    expect(lerEvento("EVT-9999", eventos)).toHaveProperty("erro");
  });

  it("acha as colunas pelo título, com ou sem asterisco e acento", () => {
    expect(colunaDoTitulo("Evento *")).toBe("evento");
    expect(colunaDoTitulo("VOLTA: DESCARGA NO GALPAO")).toBe("voltaDescarga");
    expect(colunaDoTitulo("Coluna inventada")).toBeNull();
  });
});

describe("linha → veículo", () => {
  it("monta ida e volta; destino da ida = local do evento; volta herda a carga da ida", () => {
    const r = interpretarLinha(3, completa, eventos);
    expect(r.erros).toEqual([]);
    expect(r.evento?.id).toBe("e1");
    expect(r.veiculo).toMatchObject({
      tipo: "carreta",
      ident: "ABC-1234",
      ida: { ativo: true, tags: ["kit", "estrutura"], destino: "Aterro do Flamengo", inicioCarga: "2026-10-16T08:00", fimCarga: "2026-10-16T12:30", descarga: "2026-10-18T06:00" },
      volta: { ativo: true, tags: ["kit", "estrutura"], cargaTexto: "box e pórtico", destino: "Galpão", fimCarga: "2026-10-18T20:00", descargaGalpao: "2026-10-19T09:00" },
    });
  });

  it("aplica as regras do formulário e junta todos os erros da linha", () => {
    expect(interpretarLinha(4, { ...completa, idaFimCarga: "16/10/2026 07:00" }, eventos).erros).toEqual(["Na ida, o fim da carga não pode ser antes do início."]);
    expect(interpretarLinha(5, { ...completa, idaDescartar: "sim", voltaDescartar: "SIM" }, eventos).erros[0]).toMatch(/ao menos um trecho/);
    const varios = interpretarLinha(6, { ...completa, evento: "EVT-0100", tipo: "van", idaTags: "bebida", quantidade: 50 }, eventos).erros;
    expect(varios).toHaveLength(4);
    expect(varios.join(" ")).toMatch(/encerrado.*Tipo.*Quantidade.*Ida: tipo de carga/);
  });
});

describe("planejamento: não duplica o que já existe", () => {
  const r = interpretarLinha(3, completa, eventos);
  const v = r.veiculo!;
  it("quantidade cria vários; reimportar não duplica; acrescentar cria só o novo", () => {
    expect(planejarImportacao([{ linha: 3, eventoId: "e1", veiculo: v, quantidade: 2 }], [])).toEqual([{ linha: 3, novos: 2, jaExistiam: 0 }]);
    // jsonb devolve as chaves em outra ordem: continua sendo o mesmo veículo.
    const doBanco = JSON.parse(JSON.stringify({ volta: v.volta, ida: v.ida, ident: v.ident, tipo: v.tipo }));
    expect(
      planejarImportacao(
        [{ linha: 3, eventoId: "e1", veiculo: v, quantidade: 2 }],
        [
          { eventoId: "e1", veiculo: doBanco },
          { eventoId: "e1", veiculo: doBanco },
        ],
      ),
    ).toEqual([{ linha: 3, novos: 0, jaExistiam: 2 }]);
    expect(planejarImportacao([{ linha: 3, eventoId: "e1", veiculo: v, quantidade: 3 }], [{ eventoId: "e1", veiculo: v }])).toEqual([{ linha: 3, novos: 2, jaExistiam: 1 }]);
    // Mesmo veículo em outro evento é outro veículo.
    expect(planejarImportacao([{ linha: 3, eventoId: "e2", veiculo: v, quantidade: 1 }], [{ eventoId: "e1", veiculo: v }])[0].novos).toBe(1);
  });
});
