/**
 * Aviso "já pedido neste evento": o que entra (pedidos enviados, linhas da logística) e o que não
 * entra (rascunhos, a própria solicitação em edição).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { resumoJaPedido } from "@/domain/ja-pedido";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { criarPeca, enviarSolicitacao, incluirPeca, migrarBanco, montarElenco, novoEvento, rascunho, type Elenco } from "@/test/apoio";
import { pedidosAnterioresPorEvento } from "../solicitacoes";

let E: Elenco;
let pecaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaId = (await criarPeca()).id;
}, 120_000);

const itemPeca = (quantidade: number) => ({ operacao: "ADICIONAR" as const, pecaId, quantidadeSolicitada: quantidade, descricoes: descricoesIguais(quantidade, "Na chegada") });

describe("já pedido neste evento", () => {
  it("mostra o pedido enviado com área, pessoa e código; rascunho não conta", async () => {
    const ev = await novoEvento(E.logistica);
    const enviada = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [itemPeca(4)]);
    await rascunho(E.requisitanteB, ev.id, [itemPeca(2)]);
    const r = (await pedidosAnterioresPorEvento([ev.id]))[ev.id][pecaId];
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ quantidade: 4, area: E.areas.a.nome, pessoa: E.requisitante.nome, codigo: enviada.codigo, situacao: "na ata" });
    // Editando a própria solicitação, ela não se avisa.
    expect((await pedidosAnterioresPorEvento([ev.id], enviada.id))[ev.id][pecaId]).toBeUndefined();
  });

  it("linha incluída direto pela logística aparece como tal", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pecaId, 3, null);
    const r = (await pedidosAnterioresPorEvento([ev.id]))[ev.id][pecaId];
    expect(r).toEqual([expect.objectContaining({ quantidade: 3, situacao: "incluído pela logística", pessoa: E.logistica.nome })]);
    expect(resumoJaPedido(r)?.quem).toContain("Logística");
  });
});
