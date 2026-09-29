/**
 * O solicitante escolhe a área em cada pedido (não há área fixa obrigatória no cadastro) e passa a
 * enxergar as áreas pelas quais já pediu — mais nenhuma.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { podeEditarSolicitacao } from "@/domain/permissions";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { criarUsuario, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { listarSolicitacoes, obterSolicitacao, salvarSolicitacaoCompleta } from "../solicitacoes";

let E: Elenco;
let semArea: UsuarioAtual;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  semArea = await criarUsuario("Solicitante sem área", "REQUISITANTE", null);
}, 120_000);

const pedido = (u: UsuarioAtual, eventoId: string, areaId: string | null) => salvarSolicitacaoCompleta(u, { eventoId, areaId, titulo: "Pedido", observacao: null, enviar: false, itens: [itemAvulso("Tenda extra")] });

describe("área escolhida no pedido", () => {
  it("sem área escolhida (e sem área no cadastro) não cria e aponta o campo", async () => {
    const ev = await novoEvento(E.logistica);
    const erro = await pedido(semArea, ev.id, null).catch((e) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos?.areaId).toBeTruthy();
  });

  it("escolhendo a área, cria em nome dela e já grava os itens na mesma operação", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await pedido(semArea, ev.id, E.areas.a.id);
    const s = await obterSolicitacao(E.admin, r.id);
    expect(s.areaId).toBe(E.areas.a.id);
    expect(s.itens).toHaveLength(1);
  });

  it("quem tem área no cadastro também pode pedir por outra", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await pedido(E.requisitante, ev.id, E.areas.b.id);
    expect((await obterSolicitacao(E.admin, r.id)).areaId).toBe(E.areas.b.id);
  });

  it("enxerga só as áreas pelas quais já pediu", async () => {
    const ev = await novoEvento(E.logistica);
    const daA = await pedido(semArea, ev.id, E.areas.a.id);
    const daB = await pedido(E.requisitanteB, ev.id, E.areas.b.id);
    // A sessão carrega as áreas pedidas; aqui o usuário é montado à mão.
    const comA: UsuarioAtual = { ...semArea, areasPedidas: [E.areas.a.id] };
    const ids = (await listarSolicitacoes(comA, { eventoId: ev.id })).map((s) => s.id);
    expect(ids).toContain(daA.id);
    expect(ids).not.toContain(daB.id);
    await expect(obterSolicitacao(comA, daB.id)).rejects.toBeInstanceOf(SemPermissaoError);
    expect(podeEditarSolicitacao(comA, { areaId: E.areas.a.id })).toBe(true);
    expect(podeEditarSolicitacao(comA, { areaId: E.areas.b.id })).toBe(false);
    // Sem nenhuma área (nem fixa, nem pedida) não vê nada.
    expect(await listarSolicitacoes(semArea, { eventoId: ev.id })).toHaveLength(0);
  });
});
