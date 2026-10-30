import { describe, expect, it } from "vitest";
import { eventoSchema, pecaSchema } from "./schemas";

const mensagens = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }, campo: string) => (r.error?.issues ?? []).filter((i) => i.path[0] === campo).map((i) => i.message);

describe("mensagens de validação em português", () => {
  it("estoque próprio da peça: negativo, fracionado ou texto dizem o que usar (auditoria 30/10, parte C N11)", () => {
    const peca = { codigo: "QA-1", nome: "Peça", setor: "ESTRUTURA", unidade: "un" };
    for (const estoqueProprio of ["-3", "2.5", "abc"]) {
      expect(mensagens(pecaSchema.safeParse({ ...peca, estoqueProprio }), "estoqueProprio")).toEqual(["Use um número inteiro, 0 ou mais."]);
    }
    expect(pecaSchema.parse({ ...peca, estoqueProprio: "4" }).estoqueProprio).toBe(4);
  });

  it("data do evento vazia pede a data; preenchida errada continua inválida (auditoria 30/10, B-08)", () => {
    const evento = { nome: "Evento", dataReuniao: "2026-12-01T14:00" };
    expect(mensagens(eventoSchema.safeParse({ ...evento, dataInicio: "" }), "dataInicio")).toEqual(["Informe a data do evento"]);
    expect(mensagens(eventoSchema.safeParse({ ...evento, dataInicio: "2026-02-30" }), "dataInicio")).toEqual(["Data inválida"]);
    expect(eventoSchema.safeParse({ ...evento, dataInicio: "2026-12-10" }).success).toBe(true);
  });
});
