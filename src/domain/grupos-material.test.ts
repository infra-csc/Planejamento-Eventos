import { describe, expect, it } from "vitest";
import { grupoDoProjeto } from "./grupos-material";

describe("grupoDoProjeto", () => {
  it("separa pela categoria do projeto", () => {
    expect(grupoDoProjeto({ categoria: "Tendas", nome: "Tenda 5×5 m" })).toBe("TENDAS");
    expect(grupoDoProjeto({ categoria: "Ativação", nome: "Balcão" })).toBe("ATIVACAO");
    expect(grupoDoProjeto({ categoria: "Pórtico", nome: "Pórtico boca de 6 m" })).toBe("ESTRUTURA");
  });

  it("trimandala vai com as estruturas, mesmo cadastrada como ativação", () => {
    expect(grupoDoProjeto({ categoria: "Ativação", nome: "Trimandala" })).toBe("ESTRUTURA");
    expect(grupoDoProjeto({ categoria: "Ativação", nome: "Trimandala — modelo Graac (4 diferenças)" })).toBe("ESTRUTURA");
  });

  it("grade de merchandising fica na Arena", () => {
    expect(grupoDoProjeto({ categoria: "Percurso", nome: "Grade de merchandising com pés" })).toBe("ARENA");
  });
});
