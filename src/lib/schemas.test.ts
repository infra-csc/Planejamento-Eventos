import { describe, expect, it } from "vitest";
import { configuracoesSchema, eventoSchema, pecaSchema } from "./schemas";

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

  it("configurações: campo apagado pede um número e não vira 0; fora da faixa diz a faixa (auditoria 30/10, parte D N7 e N8)", () => {
    const base = { sla_resposta_horas: "48", aviso_prazo_horas: "12", antecedencia_reuniao_horas: "0", lembrete_reuniao_dias: "1", bloquear_encerramento_com_pendentes: true };
    expect(mensagens(configuracoesSchema.safeParse({ ...base, aviso_prazo_horas: "" }), "aviso_prazo_horas")).toEqual(["Informe um número."]);
    expect(mensagens(configuracoesSchema.safeParse({ ...base, aviso_prazo_horas: "  " }), "aviso_prazo_horas")).toEqual(["Informe um número."]);
    for (const v of ["1.5", "999", "-3", "abc"]) {
      expect(mensagens(configuracoesSchema.safeParse({ ...base, aviso_prazo_horas: v }), "aviso_prazo_horas"), v).toEqual(["Use um número inteiro de 0 a 168 horas."]);
    }
    expect(mensagens(configuracoesSchema.safeParse({ ...base, lembrete_reuniao_dias: "31" }), "lembrete_reuniao_dias")).toEqual(["Use um número inteiro de 0 a 30 dias."]);
    expect(mensagens(configuracoesSchema.safeParse({ ...base, sla_resposta_horas: "0" }), "sla_resposta_horas")).toEqual(["Use um número inteiro de 1 a 720 horas."]);
    // 0 digitado continua valendo onde é permitido; número (não texto) também passa.
    expect(configuracoesSchema.parse({ ...base, antecedencia_reuniao_horas: "0", aviso_prazo_horas: 24 })).toMatchObject({ antecedencia_reuniao_horas: 0, aviso_prazo_horas: 24 });
  });
});
