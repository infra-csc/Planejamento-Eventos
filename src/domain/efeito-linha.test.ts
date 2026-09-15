import { describe, expect, it } from "vitest";
import { calcularEfeitoLinha, podeResponderNaFase, type EstadoItemResposta } from "./solicitacao";

const emAnalise = (operacao: EstadoItemResposta["operacao"], quantidadeAnterior: number | null = null): EstadoItemResposta => ({ operacao, status: "EM_ANALISE", quantidadeAtendida: null, quantidadeAnterior });

describe("efeito da resposta na linha da ata — ADICIONAR", () => {
  it("cria a linha na primeira resposta e não cria quando não atendido", () => {
    expect(calcularEfeitoLinha(emAnalise("ADICIONAR"), { status: "ATENDIDO", quantidadeAtendida: 4 }, null)).toEqual({ acao: "criar", quantidade: 4, quantidadeAnterior: null });
    expect(calcularEfeitoLinha(emAnalise("ADICIONAR"), { status: "NAO_ATENDIDO", quantidadeAtendida: 0 }, null).acao).toBe("nada");
  });

  it("corrigir para parcial aplica só a diferença e preserva ajuste feito depois", () => {
    const antes: EstadoItemResposta = { operacao: "ADICIONAR", status: "ATENDIDO", quantidadeAtendida: 4, quantidadeAnterior: null };
    // A logística somou +2 na linha depois da resposta (4 → 6). Corrigir para parcial 3 tira só 1.
    expect(calcularEfeitoLinha(antes, { status: "PARCIAL", quantidadeAtendida: 3 }, { ativo: true, quantidade: 6 })).toMatchObject({ acao: "atualizar", ativo: true, quantidade: 5 });
  });

  it("desfazer desativa a linha criada pela resposta", () => {
    const antes: EstadoItemResposta = { operacao: "ADICIONAR", status: "ATENDIDO", quantidadeAtendida: 4, quantidadeAnterior: null };
    expect(calcularEfeitoLinha(antes, { status: "EM_ANALISE", quantidadeAtendida: null }, { ativo: true, quantidade: 4 })).toMatchObject({ acao: "atualizar", ativo: false });
  });

  it("não ressuscita linha gerada que outra ação removeu", () => {
    const antes: EstadoItemResposta = { operacao: "ADICIONAR", status: "ATENDIDO", quantidadeAtendida: 4, quantidadeAnterior: null };
    expect(() => calcularEfeitoLinha(antes, { status: "PARCIAL", quantidadeAtendida: 2 }, { ativo: false, quantidade: 4 })).toThrow(/removida da ata/);
  });

  it("depois de desfazer, responder de novo reativa a própria linha", () => {
    expect(calcularEfeitoLinha(emAnalise("ADICIONAR"), { status: "ATENDIDO", quantidadeAtendida: 2 }, { ativo: false, quantidade: 4 })).toMatchObject({ acao: "atualizar", ativo: true, quantidade: 2 });
  });
});

describe("efeito da resposta na linha da ata — ALTERAR_QUANTIDADE", () => {
  it("primeira resposta leva a linha à quantidade atendida e guarda a anterior", () => {
    expect(calcularEfeitoLinha(emAnalise("ALTERAR_QUANTIDADE"), { status: "ATENDIDO", quantidadeAtendida: 15 }, { ativo: true, quantidade: 10 })).toEqual({ acao: "atualizar", ativo: true, quantidade: 15, quantidadeAnterior: 10 });
  });

  it("bug corrigido: corrigir SOL-A não apaga a alteração que SOL-B fez depois", () => {
    // SOL-A: 10 → 15 (atendido). SOL-B: 15 → 20 (atendido). Corrigir SOL-A para não atendido deve dar 15, não 10.
    const solA: EstadoItemResposta = { operacao: "ALTERAR_QUANTIDADE", status: "ATENDIDO", quantidadeAtendida: 15, quantidadeAnterior: 10 };
    expect(calcularEfeitoLinha(solA, { status: "NAO_ATENDIDO", quantidadeAtendida: 0 }, { ativo: true, quantidade: 20 })).toMatchObject({ acao: "atualizar", quantidade: 15, quantidadeAnterior: 10 });
  });

  it("bug corrigido: não aplica alteração sobre linha já removida", () => {
    expect(() => calcularEfeitoLinha(emAnalise("ALTERAR_QUANTIDADE"), { status: "ATENDIDO", quantidadeAtendida: 15 }, { ativo: false, quantidade: 10 })).toThrow(/removida da ata/);
    expect(calcularEfeitoLinha(emAnalise("ALTERAR_QUANTIDADE"), { status: "NAO_ATENDIDO", quantidadeAtendida: 0 }, { ativo: false, quantidade: 10 }).acao).toBe("nada");
  });

  it("recusa resultado negativo", () => {
    const antes: EstadoItemResposta = { operacao: "ALTERAR_QUANTIDADE", status: "NAO_ATENDIDO", quantidadeAtendida: 0, quantidadeAnterior: 10 };
    // Linha foi reduzida a 2 depois; aplicar "10 → 1" agora (delta -9) ficaria negativo.
    expect(() => calcularEfeitoLinha(antes, { status: "ATENDIDO", quantidadeAtendida: 1 }, { ativo: true, quantidade: 2 })).toThrow(/negativo/);
  });
});

describe("efeito da resposta na linha da ata — REMOVER", () => {
  it("atendido remove e marca que foi esta resposta", () => {
    expect(calcularEfeitoLinha(emAnalise("REMOVER"), { status: "ATENDIDO", quantidadeAtendida: 0 }, { ativo: true, quantidade: 3 })).toEqual({ acao: "atualizar", ativo: false, quantidade: 3, quantidadeAnterior: 3 });
  });

  it("bug corrigido: não atendido não ressuscita linha removida por outra ação", () => {
    expect(calcularEfeitoLinha(emAnalise("REMOVER"), { status: "NAO_ATENDIDO", quantidadeAtendida: 0 }, { ativo: false, quantidade: 3 }).acao).toBe("nada");
  });

  it("corrigir ou desfazer a própria remoção devolve a linha", () => {
    const removeu: EstadoItemResposta = { operacao: "REMOVER", status: "ATENDIDO", quantidadeAtendida: 0, quantidadeAnterior: 3 };
    expect(calcularEfeitoLinha(removeu, { status: "NAO_ATENDIDO", quantidadeAtendida: 0 }, { ativo: false, quantidade: 3 })).toMatchObject({ acao: "atualizar", ativo: true });
    expect(calcularEfeitoLinha(removeu, { status: "EM_ANALISE", quantidadeAtendida: null }, { ativo: false, quantidade: 3 })).toMatchObject({ acao: "atualizar", ativo: true });
  });

  it("atendido sobre linha que já estava fora não marca como removida por este item", () => {
    const efeito = calcularEfeitoLinha(emAnalise("REMOVER"), { status: "ATENDIDO", quantidadeAtendida: 0 }, { ativo: false, quantidade: 3 });
    expect(efeito).toEqual({ acao: "nada", quantidadeAnterior: null });
  });
});

describe("fase de resposta", () => {
  it("pré-reunião antes de fechar a ata; alteração só com evento aberto", () => {
    expect(podeResponderNaFase("PRE_REUNIAO", "EM_REUNIAO")).toBe(true);
    expect(podeResponderNaFase("PRE_REUNIAO", "ABERTO")).toBe(false);
    expect(podeResponderNaFase("ALTERACAO", "ABERTO")).toBe(true);
    expect(podeResponderNaFase("ALTERACAO", "ENCERRADO")).toBe(false);
  });
});
