/**
 * Peças do catálogo: origem (do galpão ou de uma prova, com os mesmos grupos dos projetos) e fotos e
 * anexos PDF (foto gravada reduzida, conferência pelo conteúdo, capa na lista, permissões).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import sharp from "sharp";
import { migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { pecaSchema } from "@/lib/schemas";
import { adicionarAnexoPeca, criarPeca, editarPeca, listarPecas, obterAnexoPeca, obterPeca, removerAnexoPeca } from "./catalogo";
import { listarGruposProjetos } from "./projetos";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

let seq = 0;
const dados = (extra: Record<string, unknown> = {}) => ({ codigo: `MRC-T${++seq}`, nome: `Painel de teste ${seq}`, setor: "MARCENARIA" as const, familia: "Stand", unidade: "un", descricao: null, estoqueProprio: 0, permiteEmProjeto: true, ...extra });

/** Foto "de celular": 3000 × 2000 px. */
const fotoGrande = async () => new File([new Uint8Array(await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#8e2740" } }).png().toBuffer())], "IMG_0001.png", { type: "image/png" });
const pdf = () => new File([new TextEncoder().encode("%PDF-1.4\n%teste\n")], "desenho tecnico.pdf", { type: "application/pdf" });

describe("origem da peça", () => {
  it("de uma prova reaproveita o grupo dos projetos; volta para o galpão", async () => {
    const p = await criarPeca(E.cenografia, dados({ grupoEvento: "  Bota Pra Correr   RJ " }));
    expect((await obterPeca(E.cenografia, p.id)).prova).toBe("Bota Pra Correr RJ");
    // Mesmo nome com outra grafia: o mesmo grupo (nada duplicado na lista de provas).
    const q = await criarPeca(E.cenografia, dados({ grupoEvento: "bota pra correr rj" }));
    expect((await obterPeca(E.cenografia, q.id)).prova).toBe("Bota Pra Correr RJ");
    expect((await listarGruposProjetos(E.cenografia)).filter((g) => g.nome === "Bota Pra Correr RJ")).toHaveLength(1);

    await editarPeca(E.cenografia, p.id, dados({ codigo: p.codigo, nome: p.nome, grupoEvento: null }));
    expect((await obterPeca(E.cenografia, p.id)).prova).toBeNull();
    // Sem o campo (outras telas que editam a peça): não mexe na prova.
    await editarPeca(E.cenografia, q.id, dados({ codigo: q.codigo, nome: "Outro nome" }));
    expect((await obterPeca(E.cenografia, q.id)).prova).toBe("Bota Pra Correr RJ");
  });

  it("marcar 'De uma prova' sem escolher qual é erro no campo", () => {
    const r = pecaSchema.safeParse({ ...dados(), permiteEmProjeto: "on", grupoEvento: "", deProva: "1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ["grupoEvento"] });
    expect(pecaSchema.safeParse({ ...dados(), permiteEmProjeto: "on", grupoEvento: "" }).success).toBe(true);
  });
});

describe("fotos e anexos da peça", () => {
  it("foto é gravada reduzida (2000 px, JPG); PDF como veio; capa e contagem na lista", async () => {
    const p = await criarPeca(E.logistica, dados());
    const foto = await adicionarAnexoPeca(E.logistica, p.id, await fotoGrande());
    await adicionarAnexoPeca(E.logistica, p.id, pdf());

    const gravada = await obterAnexoPeca(E.requisitante, foto.id);
    expect(gravada).toMatchObject({ tipo: "IMAGEM", mime: "image/jpeg", nomeArquivo: "IMG_0001.jpg" });
    const meta = await sharp(gravada.conteudo).metadata();
    expect([meta.width, meta.height]).toEqual([2000, 1333]);

    const detalhe = await obterPeca(E.logistica, p.id);
    expect(detalhe.anexos.map((a) => a.tipo)).toEqual(["IMAGEM", "PDF"]);
    const naLista = (await listarPecas(E.logistica, { busca: p.codigo })).find((x) => x.id === p.id)!;
    expect(naLista).toMatchObject({ capaFotoId: foto.id, nFotos: 1, nPdfs: 1 });

    await removerAnexoPeca(E.logistica, foto.id);
    expect((await listarPecas(E.logistica, { busca: p.codigo })).find((x) => x.id === p.id)).toMatchObject({ capaFotoId: null, nFotos: 0, nPdfs: 1 });
  });

  it("confere o conteúdo do arquivo e as permissões", async () => {
    const p = await criarPeca(E.cenografia, dados());
    const disfarcado = new File([new TextEncoder().encode("MZ executável")], "foto.jpg", { type: "image/jpeg" });
    await expect(adicionarAnexoPeca(E.cenografia, p.id, disfarcado)).rejects.toThrow(/não é foto/);
    await expect(adicionarAnexoPeca(E.cenografia, p.id, new File([], "vazio.png"))).rejects.toThrow(/vazio/);
    await expect(adicionarAnexoPeca(E.requisitante, p.id, pdf())).rejects.toThrow();
    const a = await adicionarAnexoPeca(E.cenografia, p.id, pdf());
    await expect(removerAnexoPeca(E.requisitante, a.id)).rejects.toThrow();
  });
});
