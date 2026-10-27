import { describe, expect, it } from "vitest";
import { montarFolhaSeparacao, standsDaOs, type PecaDaFolha } from "./folha-separacao";
import { grupoDaPeca } from "./grupos-material";

const peca = (codigo: string, nome: string, total: number, setor = "ARENA", familia: string | null = null): PecaDaFolha => ({ pecaId: `id-${codigo}`, codigo, nome, unidade: "un", total, setor, grupo: grupoDaPeca({ codigo, setor, familia }) });

describe("folha de separação na ordem da lista de carregamento", () => {
  const pecas = [
    peca("MRC-CASEMARCENARIA", "Case Marcenaria", 1, "MARCENARIA"),
    peca("TINA-500", "Tina 500 l", 2),
    peca("CAV-RETO", "Cavalete reto", 12, "ARENA", "Arena"),
    peca("GRADE-2X1", "Grade 2×1", 40, "ARENA", "Percurso"),
    peca("CORDA", "Corda de estaiamento", 3, "ESTRUTURA"),
    peca("MALOTE", "Malote de areia", 8, "ESTRUTURA"),
    peca("ESTACA", "Estaca", 8, "ESTRUTURA"),
    peca("PALLET-FE", "Pallet de ferro", 4, "ESTRUTURA"),
    peca("TINA-1000", "Tina 1000 l", 4, "ARENA"),
    peca("PARAF", "Q30 - PARAFUSOS", 160, "ESTRUTURA"),
    peca("BOX-3000", "Q30 - 3000", 10, "ESTRUTURA"),
    peca("BOX-400", "Q30 - 400", 2, "ESTRUTURA"),
    peca("BOX-300", "Q30 - 300", 1, "ESTRUTURA"),
    peca("TND5-CANT", "Cantoneira universal", 28, "TENDA", "Tenda"),
    peca("TND5-PE", "Pé de tenda 5×5", 16, "TENDA", "Tenda 5×5"),
    peca("TND3-PE", "Pé de tenda 3×3", 12, "TENDA", "Tenda 3×3"),
    peca("TND3-LONA", "Teto 3×3", 3, "TENDA", "Tenda 3×3"),
    peca("CONE-G", "Cone grande", 30, "ARENA", "Percurso"),
    peca("CAV-TRANSITO", "Cavalete de trânsito", 10, "ARENA", "Percurso"),
    peca("LONA-9X6", "Lona 9×6", 2, "ESTRUTURA"),
    peca("MRC-BACKDROPEMCOMPENSADO6MMREV", "Backdrop em Compensado 6mm - Dupla Face", 1, "MARCENARIA"),
    peca("PRANCHÃO-220", "Pranchão de madeira", 6, "MARCENARIA"),
    peca("TESTEIRA-9M", "Testeira de stand 9 m", 2, "MARCENARIA"),
    peca("MACO-SARRAFO", "Maço de sarrafo", 1, "MARCENARIA"),
  ];
  const folha = montarFolhaSeparacao(pecas, { stands: 2 });
  const nomes = (id: string) => folha.find((s) => s.id === id)?.linhas.map((l) => l.nome);

  it("seções na ordem da lista; peças na ordem dela dentro de cada uma; o resto no fim do bloco", () => {
    expect(folha.map((s) => s.id)).toEqual(["percurso", "tendas-3x3", "tendas-5x5", "q30", "estaio", "arena", "outros", "mrc-estandes", "mrc-mesas", "mrc-prova", "mrc-geral"]);
    expect(nomes("percurso")).toEqual(["Cavalete de trânsito", "Cone grande"]);
    expect(nomes("tendas-3x3")).toEqual(["Teto 3×3", "Pé de tenda 3×3"]);
    expect(nomes("tendas-5x5")).toEqual(["Pé de tenda 5×5", "Cantoneira universal"]);
    expect(nomes("q30")).toEqual(["Q30 - 400", "Q30 - 3000", "Q30 - PARAFUSOS", "Q30 - 300"]);
    expect(nomes("arena")).toEqual(["Grade 2×1", "Cavalete reto", "Tina 500 l"]);
    expect(nomes("outros")).toEqual(["Lona 9×6"]);
    expect(folha.find((s) => s.id === "mrc-estandes")?.bloco).toBe("Marcenaria");
    expect(nomes("mrc-mesas")).toEqual(["Pranchão de madeira"]);
    expect(nomes("mrc-prova")).toEqual(["Backdrop em Compensado 6mm - Dupla Face"]);
    expect(nomes("mrc-geral")).toEqual(["Maço de sarrafo", "Case Marcenaria"]);
  });

  it("estaio: cinta catraca 4 por stand depois do pallet; corda igual aos malotes", () => {
    const estaio = folha.find((s) => s.id === "estaio")!.linhas;
    expect(estaio.map((l) => [l.nome, l.total])).toEqual([
      ["Tina 1000 l", 4],
      ["Pallet de ferro", 4],
      ["Cinta catraca", 8],
      ["Malote de areia", 8],
      ["Estaca", 8],
      ["Corda de estaiamento", 8],
    ]);
    expect(estaio.find((l) => l.nome === "Cinta catraca")?.nota).toBe("8 dos 2 stands (4 por stand)");
    expect(estaio.find((l) => l.nome.startsWith("Corda"))?.nota).toBe("= malotes");
  });

  it("cinta pedida no catálogo soma com a dos stands numa linha só, no estaio", () => {
    const f = montarFolhaSeparacao([peca("PALLET-FE", "Pallet de ferro", 4, "ESTRUTURA"), peca("CINTA-X", "Cinta Catraca 5 m", 6, "ARENA")], { stands: 2 });
    const cintas = f.flatMap((s) => s.linhas).filter((l) => /cinta/i.test(l.nome));
    expect(cintas).toEqual([expect.objectContaining({ nome: "Cinta Catraca 5 m", total: 14, nota: "8 dos 2 stands (4 por stand) + 6 pedidas" })]);
    expect(f.find((s) => s.id === "estaio")!.linhas.map((l) => l.nome)).toEqual(["Pallet de ferro", "Cinta Catraca 5 m"]);
    // Sem stand: só as pedidas, sem nota.
    const g = montarFolhaSeparacao([peca("CINTA-X", "Cinta Catraca 5 m", 6, "ARENA")], { stands: 0 });
    expect(g.find((s) => s.id === "estaio")!.linhas).toEqual([expect.objectContaining({ total: 6, nota: undefined })]);
  });

  it("sem stand não sai cinta; malote sem corda na OS ganha a linha da corda", () => {
    const f = montarFolhaSeparacao([peca("MALOTE", "Malote", 5, "ESTRUTURA"), peca("ESTACA", "Estaca", 5, "ESTRUTURA")], { stands: 0 });
    expect(f.find((s) => s.id === "estaio")!.linhas.map((l) => [l.nome, l.total])).toEqual([
      ["Malote", 5],
      ["Estaca", 5],
      ["Corda", 5],
    ]);
  });

  it("stands pela visão por projeto", () => {
    expect(standsDaOs([{ nome: "Stand 9×6 m", quantidade: 2 }, { nome: "Estande 11x6", quantidade: 1 }, { nome: "Palco show", quantidade: 1 }])).toBe(3);
    expect(standsDaOs(undefined)).toBeNull();
  });
});
