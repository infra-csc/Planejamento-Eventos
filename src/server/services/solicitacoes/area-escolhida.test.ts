/**
 * Área do pedido: o solicitante pede sempre pela área do próprio cadastro (não escolhe); só o
 * Administrador escolhe em nome de qual área pede. Visibilidade pelas áreas do usuário.
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

describe("área do pedido", () => {
  it("solicitante sem área no cadastro não pede (e o aviso manda falar com o administrador)", async () => {
    const ev = await novoEvento(E.logistica);
    const erro = await pedido(semArea, ev.id, E.areas.a.id).catch((e) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(String((erro as Error).message)).toMatch(/administrador/);
  });

  it("solicitante pede sempre pela própria área, mesmo que outra venha no pedido", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await pedido(E.requisitante, ev.id, E.areas.b.id);
    expect((await obterSolicitacao(E.admin, r.id)).areaId).toBe(E.areas.a.id);
  });

  it("o administrador escolhe a área em nome da qual pede", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await pedido(E.admin, ev.id, E.areas.b.id);
    expect((await obterSolicitacao(E.admin, r.id)).areaId).toBe(E.areas.b.id);
  });

  it("enxerga só as solicitações das próprias áreas", async () => {
    const ev = await novoEvento(E.logistica);
    const daA = await pedido(E.requisitante, ev.id, null);
    const daB = await pedido(E.requisitanteB, ev.id, null);
    const ids = (await listarSolicitacoes(E.requisitante, { eventoId: ev.id })).map((s) => s.id);
    expect(ids).toContain(daA.id);
    expect(ids).not.toContain(daB.id);
    await expect(obterSolicitacao(E.requisitante, daB.id)).rejects.toBeInstanceOf(SemPermissaoError);
    expect(podeEditarSolicitacao(E.requisitante, { areaId: E.areas.a.id })).toBe(true);
    expect(podeEditarSolicitacao(E.requisitante, { areaId: E.areas.b.id })).toBe(false);
    expect(await listarSolicitacoes(semArea, { eventoId: ev.id })).toHaveLength(0);
  });
});
