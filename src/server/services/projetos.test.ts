/**
 * Regras da biblioteca de projetos que não dependem de tela: nome único entre projetos ativos,
 * caixa "disponível nas solicitações" na criação e na edição.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { ValidacaoError } from "@/domain/errors";
import { criarPeca, migrarBanco, montarElenco, pngMinimo, type Elenco } from "@/test/apoio";
import { alterarAtivoProjeto, anexarArquivo, criarProjeto, editarProjeto, excluirGrupoProjeto, listarGruposComUso, listarGruposProjetos, listarProjetos, obterProjeto } from "./projetos";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
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

describe("excluir grupo de prova", () => {
  it("o que estava no grupo passa para Padrão; requisitante não exclui", async () => {
    const p = await criarProjeto(E.cenografia, dados("Pórtico do grupo que sai", { grupoEvento: "Prova que acabou" }));
    const g = (await listarGruposComUso(E.cenografia)).find((x) => x.nome === "Prova que acabou")!;
    const db = await getDb();
    const peca = await criarPeca();
    await db.update(pecas).set({ grupoId: g.id }).where(eq(pecas.id, peca.id));
    expect((await listarGruposComUso(E.cenografia)).find((x) => x.id === g.id)).toMatchObject({ projetos: 1, pecas: 1 });

    await expect(excluirGrupoProjeto(E.requisitante, g.id)).rejects.toThrow();
    expect(await excluirGrupoProjeto(E.cenografia, g.id)).toEqual({ nome: "Prova que acabou", projetos: 1, pecas: 1 });
    expect((await listarGruposProjetos(E.cenografia)).some((x) => x.id === g.id)).toBe(false);
    expect((await obterProjeto(E.cenografia, p.id)).grupoId).toBeNull();
    expect((await db.query.pecas.findFirst({ where: eq(pecas.id, peca.id) }))?.grupoId).toBeNull();
  });
});

describe("peça inativa (auditoria 30/10, parte C N8)", () => {
  it("não reativa projeto com peça inativa e a mensagem do salvar cita a peça", async () => {
    const peca = await criarPeca();
    const p = await criarProjeto(E.cenografia, dados("Projeto com peça que sai", { itens: [{ pecaId: peca.id, quantidade: 1 }] }));
    await alterarAtivoProjeto(E.cenografia, p.id, false);
    await (await getDb()).update(pecas).set({ ativo: false }).where(eq(pecas.id, peca.id));

    const erro = await alterarAtivoProjeto(E.cenografia, p.id, true).catch((e) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as Error).message).toContain(`a peça ${peca.codigo} (Peça de teste) está inativa`);
    expect((await obterProjeto(E.cenografia, p.id)).ativo).toBe(false);

    const salvar = await editarProjeto(E.cenografia, p.id, dados("Projeto com peça que sai", { itens: [{ pecaId: peca.id, quantidade: 1 }] })).catch((e) => e);
    expect((salvar as ValidacaoError).campos?.itens).toContain(`${peca.codigo} (Peça de teste) está inativa`);

    // Trocando a peça, o projeto volta a salvar e pode ser reativado.
    await editarProjeto(E.cenografia, p.id, dados("Projeto com peça que sai"));
    await expect(alterarAtivoProjeto(E.cenografia, p.id, true)).resolves.toBeUndefined();
  });
});

describe("anexos do projeto (auditoria 30/10, parte C N14)", () => {
  it("JPEG corrompido é recusado como na peça; foto que abre entra", async () => {
    const p = await criarProjeto(E.cenografia, dados("Projeto com anexo corrompido"));
    const corrompido = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(7)]);
    await expect(anexarArquivo(E.cenografia, p.id, new File([corrompido], "quebrada.jpg", { type: "image/jpeg" }))).rejects.toThrow(/Não foi possível ler a imagem “quebrada.jpg”/);
    const png = await pngMinimo();
    await expect(anexarArquivo(E.cenografia, p.id, new File([new Uint8Array(png)], "boa.png", { type: "image/png" }))).resolves.toMatchObject({ id: expect.any(String) });
  });
});
