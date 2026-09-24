/**
 * Regras da biblioteca de projetos que não dependem de tela: nome único entre projetos ativos,
 * caixa "disponível nas solicitações" na criação e na edição.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { ValidacaoError } from "@/domain/errors";
import { criarPeca, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { alterarAtivoProjeto, criarProjeto, editarProjeto, obterProjeto } from "./projetos";

let E: Elenco;
let pecaId: string;
const dados = (nome: string, extra: Partial<Parameters<typeof criarProjeto>[1]> = {}) => ({ nome, categoria: "Quadro", descricao: null, observacaoVersao: null, itens: [{ pecaId, quantidade: 2 }], ...extra });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaId = (await criarPeca()).id;
}, 120_000);

describe("nome único", () => {
  it("não deixa criar dois projetos ativos com o mesmo nome (sem diferenciar maiúsculas) e aponta o campo", async () => {
    await criarProjeto(E.cenografia, dados("Quadro 4×3 m"));
    const erro = await criarProjeto(E.cenografia, dados("quadro 4×3 M")).catch((e) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos?.nome).toMatch(/Já existe/);
  });

  it("editar mantendo o próprio nome passa; renomear para o nome de outro não", async () => {
    const a = await criarProjeto(E.cenografia, dados("Pórtico A"));
    await criarProjeto(E.cenografia, dados("Pórtico B"));
    await expect(editarProjeto(E.cenografia, a.id, dados("Pórtico A"))).resolves.toBeTruthy();
    await expect(editarProjeto(E.cenografia, a.id, dados("pórtico b"))).rejects.toBeInstanceOf(ValidacaoError);
  });

  it("projeto inativo libera o nome", async () => {
    const a = await criarProjeto(E.cenografia, dados("Estande X"));
    await alterarAtivoProjeto(E.cenografia, a.id, false);
    await expect(criarProjeto(E.cenografia, dados("Estande X"))).resolves.toBeTruthy();
  });
});

describe("disponível nas solicitações", () => {
  it("nasce como a caixa mandou e a edição só mexe quando informada", async () => {
    const p = await criarProjeto(E.cenografia, dados("Marcenaria só biblioteca", { disponivelEmSolicitacoes: false }));
    expect((await obterProjeto(E.cenografia, p.id)).disponivelEmSolicitacoes).toBe(false);
    await editarProjeto(E.cenografia, p.id, dados("Marcenaria só biblioteca"));
    expect((await obterProjeto(E.cenografia, p.id)).disponivelEmSolicitacoes).toBe(false);
    await editarProjeto(E.cenografia, p.id, dados("Marcenaria só biblioteca", { disponivelEmSolicitacoes: true }));
    expect((await obterProjeto(E.cenografia, p.id)).disponivelEmSolicitacoes).toBe(true);
  });
});
