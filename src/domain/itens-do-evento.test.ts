import { describe, expect, it } from "vitest";
import { agruparItensDoEvento } from "./itens-do-evento";
import type { BomSnapshotLinha } from "@/server/db/schema";

const bom = (codigo: string, setor: BomSnapshotLinha["setor"], quantidade: number): BomSnapshotLinha =>
  ({ pecaId: codigo, codigo, nome: `Peça ${codigo}`, setor, unidade: "un", quantidade }) as BomSnapshotLinha;

describe("todos os itens do evento, por projeto (18/09)", () => {
  const linhas = [
    { id: "a", tipo: "PECA" as const, quantidade: 3, nome: "Tenda 10×10 m", areaNome: "Ativação", projeto: null },
    {
      id: "p", tipo: "PROJETO" as const, quantidade: 2, nome: "Palco 8×6 m", areaNome: "Produção",
      projeto: { bom: [bom("MAR-02", "MARCENARIA", 4), bom("EST-01", "ESTRUTURA", 6)] },
    },
    { id: "x", tipo: "AVULSO" as const, quantidade: 1, nome: "Gerador extra", areaNome: null, projeto: null },
  ];

  it("cada projeto traz as peças com por unidade e total no evento, na ordem da OS", () => {
    const r = agruparItensDoEvento(linhas);
    expect(r.projetos).toHaveLength(1);
    expect(r.projetos[0].linha.id).toBe("p");
    expect(r.projetos[0].pecas).toEqual([
      { codigo: "EST-01", nome: "Peça EST-01", setor: "ESTRUTURA", unidade: "un", porUnidade: 6, total: 12 },
      { codigo: "MAR-02", nome: "Peça MAR-02", setor: "MARCENARIA", unidade: "un", porUnidade: 4, total: 8 },
    ]);
    expect(r.totalPecasNosProjetos).toBe(2);
  });

  it("peças do catálogo e fora do catálogo vão para os avulsos, por área e nome", () => {
    expect(agruparItensDoEvento(linhas).avulsos.map((l) => l.id)).toEqual(["a", "x"]);
  });

  it("projeto sem composição não quebra", () => {
    const r = agruparItensDoEvento([{ id: "p", tipo: "PROJETO" as const, quantidade: 1, nome: "P", areaNome: null, projeto: null }]);
    expect(r.projetos[0].pecas).toEqual([]);
  });
});
