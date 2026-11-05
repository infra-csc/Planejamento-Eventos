import { describe, expect, it } from "vitest";
import { calcularOS, type LinhaAta } from "@/domain/os";
import { pastaMateriaisKit } from "./os-kit-xlsx";

const solta = (id: string, codigo: string, nome: string, quantidade: number, destino: string | null): LinhaAta => ({ id, tipo: "PECA", quantidade, destino, areaNome: "Kit", peca: { id: `p-${codigo}`, codigo, nome, setor: "ARENA", unidade: "un" } });
const stand: LinhaAta = {
  id: "s",
  tipo: "PROJETO",
  quantidade: 2,
  destino: "Expo",
  areaNome: "Kit",
  projeto: { codigo: "PRJ-S", nome: "Stand 9×6 m", versao: 1, bom: [{ pecaId: "p-box", codigo: "BOX-1000", nome: "Box truss 1 m", setor: "ESTRUTURA", unidade: "un", quantidade: 4 }] },
};
const ev = { codigo: "EVT-0001", nome: "Corrida", dataInicio: "2026-11-10", dataFim: "2026-11-11" };

function planilha(linhas: LinhaAta[], opcoes = {}) {
  const os = calcularOS(linhas);
  const ws = pastaMateriaisKit(ev, os.kit!, {}, "v1", "Marina", "04/11/2026", opcoes).getWorksheet("Materiais KIT")!;
  const valores: Array<Array<unknown>> = [];
  ws.eachRow((r) => valores.push((r.values as unknown[]).slice(1)));
  return { valores, localDe: (nome: RegExp) => valores.find((v) => nome.test(String(v[1])))?.[4] };
}

describe("Materiais KIT em Excel", () => {
  it("as linhas que a folha soma por conta própria saem com o local", () => {
    const { localDe } = planilha([stand, solta("c", "CINTA-CATRACA", "Cinta catraca", 3, "Retirada"), solta("m", "MALOTE", "Malote", 5, "Largada")]);
    expect(localDe(/^Cinta catraca/)).toBe("Retirada / Expo");
    expect(localDe(/^Corda/)).toBe("Largada");
    expect(localDe(/^Box truss/)).toBe("Expo");
  });

  it("sem local informado, continua o traço", () => {
    expect(planilha([solta("c", "CINTA-CATRACA", "Cinta catraca", 3, null)]).localDe(/^Cinta catraca/)).toBe("—");
  });

  it("estrutura locada: não desconta, mas a lista avisa", () => {
    const comAviso = planilha([stand], { locada: true });
    expect(String(comAviso.valores[2][0])).toContain("estrutura locada");
    expect(comAviso.localDe(/^Box truss/)).toBe("Expo");
    expect(String(planilha([stand]).valores[2][0])).not.toContain("locada");
  });
});
