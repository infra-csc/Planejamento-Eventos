import { describe, expect, it } from "vitest";
import { grupoDoEvento } from "./grupo-do-evento";

const GRUPOS = ["Blue Line", "Blue Run", "Bota pra correr", "Circuito Banco do Brasil", "Circuito das Estações", "Eco Run", "Eco Run Special", "Juntos Bota pra Correr", "Makai", "Night Run", "SRun", "Viva Esporte", "Pão de Açúcar"].map((nome) => ({ id: nome, nome }));
const de = (evento: string) => grupoDoEvento(evento, GRUPOS)?.nome ?? null;

describe("grupo da biblioteca pelo nome do evento", () => {
  it("acha o grupo pelo nome do evento", () => {
    expect(de("BLUE RUN - SANTOS")).toBe("Blue Run");
    expect(de("NIGHT RUN - ETAPA 2 - SÃO PAULO")).toBe("Night Run");
    expect(de("NIGHT FOZ DO IGUAÇU")).toBe("Night Run");
    expect(de("CIRCUITO DAS ESTAÇÕES - BELO HORIZONTE")).toBe("Circuito das Estações");
    expect(de("BANCO DO BRASIL - MACEIÓ")).toBe("Circuito Banco do Brasil");
    expect(de("MAKAI JOÃO PESSOA")).toBe("Makai");
    expect(de("VIVA ESPORTE - FUNDÃO")).toBe("Viva Esporte");
  });

  it("prefere o grupo mais específico", () => {
    expect(de("ECO RUN SPECIAL EDITION - SÃO PAULO")).toBe("Eco Run Special");
    expect(de("ECO SPECIAL RJ")).toBe("Eco Run Special");
    expect(de("ECO RUN - SALVADOR")).toBe("Eco Run");
    expect(de("S RUN RIO BRANCO")).toBe("SRun");
    expect(de("CIRCUITO S RUN - NOVO HAMBURGO")).toBe("SRun");
  });

  it("sem grupo parecido, nenhum", () => {
    expect(de("MEIA DE SAMPA")).toBeNull();
    expect(de("FUGA DAS ILHAS")).toBeNull();
    expect(de("RUNNING HOUR SÃO PAULO")).toBeNull();
  });
});
