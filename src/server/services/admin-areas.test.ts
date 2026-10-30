/**
 * Administração: área com o mesmo nome sem acento não duplica (auditoria 30/10, parte D N14) e a troca de
 * área do usuário fica no histórico com o nome das áreas, de e para (parte D N18).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { ValidacaoError } from "@/domain/errors";
import { migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { editarUsuario, salvarArea } from "./admin";
import { listarHistoricoGeral } from "./historico-geral";

let E: Elenco;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("áreas e usuários no admin", () => {
  it("recusa a mesma área escrita sem acento ou em outra caixa", async () => {
    // E.areas.a é "Produção-<n>-<id>".
    const nome = E.areas.a.nome;
    const semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
    expect(semAcento).not.toBe(nome);
    await expect(salvarArea(E.admin, null, { nome: semAcento, ativo: true })).rejects.toBeInstanceOf(ValidacaoError);
    await expect(salvarArea(E.admin, null, { nome: ` ${nome.toUpperCase()} `, ativo: true })).rejects.toBeInstanceOf(ValidacaoError);
    // Salvar a própria área com outra grafia não é duplicar.
    await expect(salvarArea(E.admin, E.areas.a.id, { nome: semAcento, ativo: true })).resolves.toBe(E.areas.a.id);
    await salvarArea(E.admin, E.areas.a.id, { nome, ativo: true });
  });

  it("troca de área registra os nomes, de e para", async () => {
    const u = E.requisitante;
    await editarUsuario(E.admin, u.id, { nome: u.nome, email: "x@x.com", perfil: "REQUISITANTE", areaId: E.areas.b.id, senha: null, ativo: true });
    const h = await listarHistoricoGeral(E.admin, { periodo: "hoje", categoria: "admin", usuarioId: E.admin.id });
    const reg = h.itens.find((r) => r.entidadeId === u.id && r.acao === "EDITADO");
    expect(reg?.descricao).toContain(`área ${E.areas.a.nome} → ${E.areas.b.nome}`);
    expect(reg?.dadosDepois).toMatchObject({ area: E.areas.b.nome });
  });
});
