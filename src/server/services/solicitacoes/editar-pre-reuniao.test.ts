/**
 * Editar necessidade pré-reunião já enviada (antes da reunião) sem perder nada, e rascunho de
 * pré-reunião que não se perde quando a ata fecha.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { DomainError, ValidacaoError } from "@/domain/errors";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { criarPeca, enviarSolicitacao, fecharAta, migrarBanco, montarElenco, novoEvento, rascunho, type Elenco } from "@/test/apoio";
import { alterarQuantidadeLinha, obterLinhasAta, transicionarEvento } from "../eventos";
import { editarPreReuniaoEnviada, obterSolicitacao } from "../solicitacoes";

let E: Elenco;
let pecaA: string;
let pecaB: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaA = (await criarPeca()).id;
  pecaB = (await criarPeca()).id;
}, 120_000);

const item = (pecaId: string, quantidade: number) => ({ operacao: "ADICIONAR" as const, pecaId, quantidadeSolicitada: quantidade, descricoes: descricoesIguais(quantidade, "Na chegada") });
const edicao = (id: string, eventoId: string, itens: ReturnType<typeof item>[], titulo: string | null = "Pedido editado") => ({ id, eventoId, areaId: null, titulo, observacao: null, enviar: true, itens });
const linhasAtivas = async (eventoId: string) => (await obterLinhasAta(eventoId)).map((l) => ({ pecaId: l.registro.pecaId, quantidade: l.quantidade }));

describe("editar pedido pré-reunião já enviado", () => {
  it("troca itens e linhas da ata de uma vez", async () => {
    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 4)]);
    expect(await linhasAtivas(ev.id)).toEqual([{ pecaId: pecaA, quantidade: 4 }]);

    await editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaA, 6), item(pecaB, 2)]));
    const linhas = await linhasAtivas(ev.id);
    expect(linhas).toHaveLength(2);
    expect(linhas).toEqual(expect.arrayContaining([{ pecaId: pecaA, quantidade: 6 }, { pecaId: pecaB, quantidade: 2 }]));
    const depois = await obterSolicitacao(E.admin, s.id);
    expect(depois.itens.map((i) => i.quantidadeSolicitada).sort()).toEqual([2, 6]);
    expect(depois.titulo).toBe("Pedido editado");
  });

  it("se a edição não passa na validação, o pedido e a ata ficam como estavam", async () => {
    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 3)]);
    await expect(editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaB, 1)], null))).rejects.toBeInstanceOf(ValidacaoError);
    expect(await linhasAtivas(ev.id)).toEqual([{ pecaId: pecaA, quantidade: 3 }]);
    expect((await obterSolicitacao(E.admin, s.id)).itens).toHaveLength(1);
  });

  it("depois que a reunião começa, não edita mais", async () => {
    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 2)]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await expect(editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaA, 5)]))).rejects.toBeInstanceOf(DomainError);
    expect(await linhasAtivas(ev.id)).toEqual([{ pecaId: pecaA, quantidade: 2 }]);
  });

  it("linha que a logística já ajustou trava a edição (o ajuste não se perde)", async () => {
    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 4)]);
    const [linha] = await obterLinhasAta(ev.id);
    await alterarQuantidadeLinha(E.logistica, ev.id, linha.id, 7, "Cliente pediu mais");
    await expect(editarPreReuniaoEnviada(E.requisitante, edicao(s.id, ev.id, [item(pecaA, 1)]))).rejects.toThrow(/logística já ajustou/);
    expect(await linhasAtivas(ev.id)).toEqual([{ pecaId: pecaA, quantidade: 7 }]);
  });

  it("outra área não edita", async () => {
    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 1)]);
    await expect(editarPreReuniaoEnviada(E.requisitanteB, edicao(s.id, ev.id, [item(pecaA, 9)]))).rejects.toThrow();
  });
});

describe("rascunho de pré-reunião quando a ata fecha", () => {
  it("vira rascunho de alteração com tudo que foi preenchido, em vez de ser cancelado", async () => {
    const ev = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.admin, ev.id, [item(pecaA, 1)]);
    const r = await rascunho(E.requisitanteB, ev.id, [item(pecaB, 3)]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.logistica, ev.id);
    const depois = await obterSolicitacao(E.admin, r.id);
    expect(depois.status).toBe("RASCUNHO");
    expect(depois.tipo).toBe("ALTERACAO");
    expect(depois.itens.map((i) => i.quantidadeSolicitada)).toEqual([3]);
  });
});
