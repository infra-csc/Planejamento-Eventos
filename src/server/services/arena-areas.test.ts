/**
 * Mapa 3D de evento: cada área posiciona (e tira) os itens da ata que ela pediu; as outras áreas
 * veem, mas não mexem; o administrador mexe em tudo.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { SemPermissaoError } from "@/domain/errors";
import { migrarBanco, montarElenco, novoEvento, unico, type Elenco } from "@/test/apoio";
import { criarArena } from "./arenas";
import { listarPosicoesArena, removerPosicaoArena, salvarPosicaoArena, secoesEditaveisArena } from "./arena";

let E: Elenco;
let slug: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const ev = await novoEvento(E.logistica);
  slug = (await criarArena(E.admin, { eventoId: ev.id, nome: unico("Arena"), partida: { tipo: "branco", largura: 60, profundidade: 40 } }, null)).slug;
}, 120_000);

const itemDa = (area: string, item: string) => ({ chave: `novo:ata:${area}|${item}`, tipo: "NOVO" as const, x: 3, z: 4, nome: item, itemAta: `${area}|${item}` });

describe("mapa 3D por área", () => {
  it("as seções editáveis são as áreas do usuário; o administrador edita tudo", async () => {
    expect(await secoesEditaveisArena(E.admin)).toBeNull();
    expect(await secoesEditaveisArena(E.requisitante)).toEqual([E.areas.a.nome]);
  });

  it("a área posiciona e tira o item que pediu", async () => {
    const d = itemDa(E.areas.a.nome, "Tenda 3×3 m");
    await salvarPosicaoArena(E.requisitante, slug, d);
    expect((await listarPosicoesArena(slug)).some((p) => p.chave === d.chave)).toBe(true);
    await salvarPosicaoArena(E.requisitante, slug, { ...d, x: 10 });
    await removerPosicaoArena(E.requisitante, slug, d.chave);
    expect((await listarPosicoesArena(slug)).some((p) => p.chave === d.chave)).toBe(false);
  });

  it("não mexe no item de outra área, nem em item avulso ou ponto da planta", async () => {
    const daB = itemDa(E.areas.b.nome, "Estande 9×6 m");
    await expect(salvarPosicaoArena(E.requisitante, slug, daB)).rejects.toBeInstanceOf(SemPermissaoError);
    await salvarPosicaoArena(E.requisitanteB, slug, daB);
    await expect(salvarPosicaoArena(E.requisitante, slug, { ...daB, x: 20 })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(removerPosicaoArena(E.requisitante, slug, daB.chave)).rejects.toBeInstanceOf(SemPermissaoError);
    // Disfarçar o item da outra área com a própria seção não passa: vale o que está salvo.
    await expect(salvarPosicaoArena(E.requisitante, slug, { ...daB, itemAta: `${E.areas.a.nome}|x` })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(salvarPosicaoArena(E.requisitante, slug, { chave: "novo:livre:poste", tipo: "NOVO", x: 1, z: 1, nome: "Poste", itemAta: null })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(salvarPosicaoArena(E.requisitante, slug, { chave: "p-12", tipo: "MOVER", x: 1, z: 1 })).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it("o administrador mexe no item de qualquer área", async () => {
    const daB = itemDa(E.areas.b.nome, "Balcão");
    await salvarPosicaoArena(E.requisitanteB, slug, daB);
    await salvarPosicaoArena(E.admin, slug, { ...daB, x: 30 });
    await removerPosicaoArena(E.admin, slug, daB.chave);
  });
});
