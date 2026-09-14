import { describe, expect, it } from "vitest";
import { acoesDisponiveis, aceitaSolicitacao, janelaPreReuniaoAberta, statusExibicao, transicaoPermitida } from "./evento";
import { classificarHistorico } from "./historico";
import { prazoInfo } from "@/lib/prazo";
import { estaAtrasada, podeCancelar, statusAposResposta, validarItem, validarResposta } from "./solicitacao";
import { pode, podeEditarSolicitacao, podeVerSolicitacao } from "./permissions";
import { consolidar } from "./consolidacao";
import { calcularOS } from "./os";

describe("máquina de estados do evento", () => {
  it("segue Preparação → Em reunião → Aberto → Encerrado", () => {
    expect(transicaoPermitida("PREPARACAO", "INICIAR_REUNIAO")).toBe(true);
    expect(transicaoPermitida("EM_REUNIAO", "FECHAR_ATA")).toBe(true);
    expect(transicaoPermitida("ABERTO", "ENCERRAR")).toBe(true);
    expect(transicaoPermitida("PREPARACAO", "ENCERRAR")).toBe(false);
    expect(transicaoPermitida("ENCERRADO", "CANCELAR")).toBe(false);
  });
  it("só a gestão reabre; só a logística encerra", () => {
    expect(acoesDisponiveis("ENCERRADO", "GESTAO")).toEqual(["REABRIR"]);
    expect(acoesDisponiveis("ENCERRADO", "LOGISTICA")).toEqual([]);
    expect(acoesDisponiveis("ABERTO", "LOGISTICA")).toEqual(["ENCERRAR", "CANCELAR"]);
    expect(acoesDisponiveis("ABERTO", "REQUISITANTE")).toEqual([]);
  });
  it("aceita cada tipo de solicitação só no estado certo", () => {
    expect(aceitaSolicitacao("PREPARACAO", "PRE_REUNIAO")).toBe(true);
    expect(aceitaSolicitacao("EM_REUNIAO", "PRE_REUNIAO")).toBe(false);
    expect(aceitaSolicitacao("ABERTO", "ALTERACAO")).toBe(true);
    expect(aceitaSolicitacao("ENCERRADO", "ALTERACAO")).toBe(false);
  });
  it("deriva 'Realizado' para encerrados com data passada", () => {
    expect(statusExibicao("ENCERRADO", "2026-01-10", "2026-02-01")).toBe("REALIZADO");
    expect(statusExibicao("ENCERRADO", "2026-03-10", "2026-02-01")).toBe("ENCERRADO");
    expect(statusExibicao("ABERTO", "2026-01-10", "2026-02-01")).toBe("ABERTO");
  });
});

describe("resposta por item", () => {
  const item = { operacao: "ADICIONAR" as const, quantidadeSolicitada: 10 };
  it("atendido usa a quantidade solicitada e ignora pendência", () => {
    expect(validarResposta(item, { status: "ATENDIDO", pendenciaCompra: true })).toMatchObject({ quantidadeAtendida: 10, pendenciaCompra: false });
  });
  it("parcial exige observação e quantidade entre 1 e solicitada-1", () => {
    expect(() => validarResposta(item, { status: "PARCIAL", quantidadeAtendida: 4 })).toThrow(/observação/);
    expect(() => validarResposta(item, { status: "PARCIAL", quantidadeAtendida: 10, observacaoLogistica: "x" })).toThrow(/menor que a solicitada/);
    expect(() => validarResposta(item, { status: "PARCIAL", quantidadeAtendida: 0, observacaoLogistica: "x" })).toThrow();
    expect(validarResposta(item, { status: "PARCIAL", quantidadeAtendida: 4, observacaoLogistica: "Só 4 em estoque", pendenciaCompra: true })).toMatchObject({
      quantidadeAtendida: 4,
      pendenciaCompra: true,
    });
  });
  it("não atendido exige observação e zera a quantidade", () => {
    expect(() => validarResposta(item, { status: "NAO_ATENDIDO" })).toThrow();
    expect(validarResposta(item, { status: "NAO_ATENDIDO", observacaoLogistica: "Sem peça" }).quantidadeAtendida).toBe(0);
  });
  it("remoção não admite parcial", () => {
    expect(() => validarResposta({ operacao: "REMOVER", quantidadeSolicitada: 1 }, { status: "PARCIAL", quantidadeAtendida: 1, observacaoLogistica: "x" })).toThrow(/remoção/i);
  });
  it("status da solicitação deriva dos itens", () => {
    expect(statusAposResposta([{ status: "EM_ANALISE" }, { status: "EM_ANALISE" }])).toBe("ENVIADA");
    expect(statusAposResposta([{ status: "ATENDIDO" }, { status: "EM_ANALISE" }])).toBe("EM_ANALISE");
    expect(statusAposResposta([{ status: "ATENDIDO" }, { status: "NAO_ATENDIDO" }])).toBe("RESPONDIDA");
  });
  it("cancelamento só antes de qualquer resposta", () => {
    expect(podeCancelar("ENVIADA", false)).toBe(true);
    expect(podeCancelar("ENVIADA", true)).toBe(false);
    expect(podeCancelar("EM_ANALISE", true)).toBe(false);
  });
  it("atraso só para solicitações abertas", () => {
    const prazo = new Date("2026-09-10T10:00:00Z");
    expect(estaAtrasada("ENVIADA", prazo, new Date("2026-09-11T10:00:00Z"))).toBe(true);
    expect(estaAtrasada("RESPONDIDA", prazo, new Date("2026-09-11T10:00:00Z"))).toBe(false);
    expect(estaAtrasada("ENVIADA", prazo, new Date("2026-09-09T10:00:00Z"))).toBe(false);
  });
  it("item precisa de exatamente uma referência", () => {
    expect(() => validarItem({ operacao: "ADICIONAR", quantidadeSolicitada: 1 })).toThrow();
    expect(() => validarItem({ operacao: "ADICIONAR", quantidadeSolicitada: 1, projetoId: "a", pecaId: "b" })).toThrow();
    expect(() => validarItem({ operacao: "ADICIONAR", quantidadeSolicitada: 0, projetoId: "a" })).toThrow(/maior que zero/);
    expect(() => validarItem({ operacao: "REMOVER", quantidadeSolicitada: 0 })).toThrow(/linha da ata/);
    expect(() => validarItem({ operacao: "REMOVER", quantidadeSolicitada: 0, eventoItemId: "x" })).not.toThrow();
  });
});

describe("permissões", () => {
  it("matriz básica", () => {
    expect(pode({ perfil: "REQUISITANTE", areaId: "a" }, "os.ver")).toBe(false);
    expect(pode({ perfil: "CENOGRAFIA", areaId: "a" }, "projeto.gerenciar")).toBe(true);
    expect(pode({ perfil: "LOGISTICA", areaId: null }, "projeto.gerenciar")).toBe(false);
    expect(pode({ perfil: "GESTAO", areaId: null }, "evento.reabrir")).toBe(true);
    expect(pode({ perfil: "ADMIN", areaId: null }, "admin.usuarios")).toBe(true);
  });
  it("requisitante só vê e edita solicitações da própria área", () => {
    expect(podeVerSolicitacao({ perfil: "REQUISITANTE", areaId: "a" }, { areaId: "a" })).toBe(true);
    expect(podeVerSolicitacao({ perfil: "REQUISITANTE", areaId: "a" }, { areaId: "b" })).toBe(false);
    expect(podeVerSolicitacao({ perfil: "LOGISTICA", areaId: null }, { areaId: "b" })).toBe(true);
    expect(podeEditarSolicitacao({ perfil: "LOGISTICA", areaId: null }, { areaId: "b" })).toBe(false);
  });
});

describe("consolidação por período", () => {
  const peca = { id: "p1", codigo: "BOX-600", nome: "Box 600", setor: "ESTRUTURA" as const, unidade: "un", estoqueProprio: 12 };
  const os = (qtd: number) =>
    calcularOS([{ id: "x", tipo: "PECA", quantidade: qtd, destino: null, areaNome: null, peca: { id: "p1", codigo: "BOX-600", nome: "Box 600", setor: "ESTRUTURA", unidade: "un" } }]);
  it("eventos que não se sobrepõem não competem", () => {
    const r = consolidar(
      [
        { id: "e1", codigo: "EV-1", nome: "A", dataMontagem: "2026-09-01", dataDesmontagem: "2026-09-03", os: os(10) },
        { id: "e2", codigo: "EV-2", nome: "B", dataMontagem: "2026-09-05", dataDesmontagem: "2026-09-06", os: os(8) },
      ],
      [peca],
      { inicio: "2026-09-01", fim: "2026-09-30" },
    );
    expect(r[0]).toMatchObject({ pico: 10, saldo: 2, totalPeriodo: 18 });
  });
  it("eventos sobrepostos somam e geram déficit", () => {
    const r = consolidar(
      [
        { id: "e1", codigo: "EV-1", nome: "A", dataMontagem: "2026-09-01", dataDesmontagem: "2026-09-05", os: os(10) },
        { id: "e2", codigo: "EV-2", nome: "B", dataMontagem: "2026-09-04", dataDesmontagem: "2026-09-06", os: os(8) },
      ],
      [peca],
      { inicio: "2026-09-01", fim: "2026-09-30" },
    );
    expect(r[0]).toMatchObject({ pico: 18, diaPico: "2026-09-04", saldo: -6 });
    expect(r[0].eventosNoPico).toHaveLength(2);
  });
  it("ignora eventos fora do período", () => {
    const r = consolidar([{ id: "e1", codigo: "EV-1", nome: "A", dataMontagem: "2026-10-01", dataDesmontagem: "2026-10-03", os: os(10) }], [peca], {
      inicio: "2026-09-01",
      fim: "2026-09-30",
    });
    expect(r).toEqual([]);
  });
});

describe("consolidação com demanda projetada", () => {
  const peca = { id: "p1", codigo: "BOX-3000", nome: "Box 3000", setor: "ESTRUTURA" as const, unidade: "un", estoqueProprio: 40 };
  it("soma itens em análise de eventos sem ata e marca como projetado", () => {
    const os = calcularOS([{ id: "x", tipo: "PECA", quantidade: 30, destino: null, areaNome: null, peca: { id: "p1", codigo: "BOX-3000", nome: "Box 3000", setor: "ESTRUTURA", unidade: "un" } }]);
    const r = consolidar(
      [
        { id: "e1", codigo: "EVT-0001", nome: "A", dataMontagem: "2026-09-20", dataDesmontagem: "2026-09-25", os },
        { id: "e3", codigo: "EVT-0003", nome: "B", dataMontagem: "2026-09-22", dataDesmontagem: "2026-09-24", os: { setores: [], semSetor: [] }, projetado: { p1: 20 } },
      ],
      [peca],
      { inicio: "2026-09-14", fim: "2026-10-14" },
    );
    expect(r[0]).toMatchObject({ pico: 50, diaPico: "2026-09-22", saldo: -10, temProjecao: true });
    expect(r[0].eventosNoPico).toEqual([
      { codigo: "EVT-0001", nome: "A", quantidade: 30, projetado: false },
      { codigo: "EVT-0003", nome: "B", quantidade: 20, projetado: true },
    ]);
  });
});

describe("histórico, prazo e janela pré-reunião", () => {
  it("classifica e separa título e detalhe", () => {
    expect(classificarHistorico({ entidade: "evento_item", acao: "ATA_QUANTIDADE", descricao: "Quantidade alterada: Tenda 1 → 2 — Cliente aprovou" })).toEqual({
      tipo: "ajuste",
      titulo: "Quantidade alterada: Tenda 1 → 2",
      detalhe: "Cliente aprovou",
    });
    expect(classificarHistorico({ entidade: "evento", acao: "FECHAR_ATA", descricao: "Fechar ata" }).tipo).toBe("marco");
  });
  it("prazo só vence em solicitação aberta", () => {
    const agora = new Date("2026-09-14T15:00:00Z");
    expect(prazoInfo({ status: "ENVIADA", prazoRespostaEm: new Date("2026-09-12T12:00:00Z") }, agora)).toMatchObject({ label: "vencido", sub: "há 2 dias", vencido: true });
    expect(prazoInfo({ status: "RESPONDIDA", prazoRespostaEm: new Date("2026-09-12T12:00:00Z") }, agora).vencido).toBe(false);
    expect(prazoInfo({ status: "EM_ANALISE", prazoRespostaEm: new Date("2026-09-14T20:00:00Z") }, agora)).toMatchObject({ label: "em 5h", tom: "warning" });
    expect(prazoInfo({ status: "ENVIADA", prazoRespostaEm: new Date("2026-09-17T15:00:00Z") }, agora)).toMatchObject({ label: "em 3d", tom: "neutral" });
  });
  it("janela pré-reunião respeita a antecedência", () => {
    const reuniao = new Date("2026-09-16T17:00:00Z");
    expect(janelaPreReuniaoAberta(reuniao, 0, new Date("2026-09-16T18:00:00Z"))).toBe(true);
    expect(janelaPreReuniaoAberta(reuniao, 24, new Date("2026-09-15T18:00:00Z"))).toBe(false);
    expect(janelaPreReuniaoAberta(reuniao, 24, new Date("2026-09-15T16:00:00Z"))).toBe(true);
  });
});
