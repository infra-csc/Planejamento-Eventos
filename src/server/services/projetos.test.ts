/**
 * Regras da biblioteca de projetos que não dependem de tela: nome único entre projetos ativos,
 * caixa "disponível nas solicitações" na criação e na edição.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { ValidacaoError } from "@/domain/errors";
import { criarPeca, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { alterarAtivoProjeto, criarProjeto, editarProjeto, listarGruposProjetos, listarProjetos, obterProjeto } from "./projetos";
import { normalizarGrupoProjeto } from "@/domain/grupos-projeto";

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

describe("grupos livres da biblioteca", () => {
  it("novos projetos continuam Padrão sem informar grupo", async () => {
    const p = await criarProjeto(E.cenografia, dados("Projeto geral sem grupo"));
    expect(p.grupoId).toBeNull();
    expect((await obterProjeto(E.cenografia, p.id)).grupo).toBeNull();
  });

  it("cria e reutiliza nomes normalizados sem restringir a disponibilidade", async () => {
    const a = await criarProjeto(E.cenografia, dados("Projeto grupo A", { grupoEvento: "  Feira   BH  " }));
    const b = await criarProjeto(E.cenografia, dados("Projeto grupo B", { grupoEvento: "feira bh" }));
    expect(a.grupoId).toBeTruthy();
    expect(b.grupoId).toBe(a.grupoId);
    expect((await obterProjeto(E.cenografia, b.id)).grupo?.nome).toBe("Feira BH");
    expect((await listarGruposProjetos(E.cenografia)).filter((g) => g.nome === "Feira BH")).toHaveLength(1);
    const selecionaveis = await listarProjetos(E.cenografia, { busca: "Projeto grupo" });
    expect(selecionaveis.map((p) => p.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(selecionaveis.every((p) => p.disponivelEmSolicitacoes)).toBe(true);
    expect(selecionaveis.find((p) => p.id === a.id)?.grupo?.nome).toBe("Feira BH");
  });

  it("editar só o grupo não cria versão; omitir preserva e Padrão limpa", async () => {
    const p = await criarProjeto(E.cenografia, dados("Projeto organização", { grupoEvento: "Grupo de organização" }));
    await editarProjeto(E.cenografia, p.id, dados(p.nome));
    expect((await obterProjeto(E.cenografia, p.id)).grupoId).toBe(p.grupoId);
    await editarProjeto(E.cenografia, p.id, dados(p.nome, { grupoEvento: "Outro evento" }));
    const movido = await obterProjeto(E.cenografia, p.id);
    expect(movido.grupoId).not.toBe(p.grupoId);
    expect(movido.grupo?.nome).toBe("Outro evento");
    expect(movido.versaoAtual).toBe(1);
    expect(movido.versoes).toHaveLength(1);
    await editarProjeto(E.cenografia, p.id, dados(p.nome, { grupoEvento: null }));
    const geral = await obterProjeto(E.cenografia, p.id);
    expect(geral.grupoId).toBeNull();
    expect(geral.versaoAtual).toBe(1);
    const grupos = await listarGruposProjetos(E.cenografia);
    expect(grupos.map((g) => g.id)).toEqual(expect.arrayContaining([p.grupoId!, movido.grupoId!]));
  });

  it("valida nomes e impede criação de grupo sem permissão", async () => {
    expect(normalizarGrupoProjeto(" \n ")).toBeNull();
    expect(normalizarGrupoProjeto("  Ｆeira BH ")).toEqual({ nome: "Feira BH", nomeNormalizado: "feira bh" });
    for (const nome of ["x".repeat(121), "Padrão", "padrao", 10, {}]) {
      expect(() => normalizarGrupoProjeto(nome)).toThrow();
    }
    await expect(criarProjeto({ ...E.cenografia, perfil: "REQUISITANTE" }, dados("Grupo sem acesso", { grupoEvento: "Grupo proibido" }))).rejects.toThrow();
    expect((await listarGruposProjetos(E.cenografia)).some((g) => g.nome === "Grupo proibido")).toBe(false);
    await expect(criarProjeto(E.cenografia, dados("Grupo reservado", { grupoEvento: "Padrão" }))).rejects.toThrow();
  });
});
