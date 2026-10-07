/** Entorno 3D da arena: prédios e ruas do OpenStreetMap entram e saem sem mexer no que foi desenhado à mão. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { arenas } from "@/server/db/schema";
import { migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import type { ElementoOsm } from "@/domain/arena/entorno";
import { importarEntornoArena, removerEntornoArena } from "./arena-entorno";
import { layoutEmBranco } from "./arenas";

let E: Elenco;
const kLon = 111320 * Math.cos((-20 * Math.PI) / 180);
const pt = (leste: number, sul: number) => ({ lat: -20 - sul / 110574, lon: -40 + leste / kLon });
const quadrado = (cx: number, cz: number, l: number) => [pt(cx - l, cz - l), pt(cx + l, cz - l), pt(cx + l, cz + l), pt(cx - l, cz + l), pt(cx - l, cz - l)];
const osm: ElementoOsm[] = [
  { type: "way", id: 1, tags: { building: "apartments", "building:levels": "12" }, geometry: quadrado(120, 0, 10) },
  { type: "way", id: 2, tags: { building: "house" }, geometry: quadrado(-90, 30, 6) },
  { type: "way", id: 3, tags: { highway: "primary", name: "Avenida Beira-Mar" }, geometry: [pt(-250, 0), pt(-100, 0), pt(0, 0), pt(100, 0), pt(250, 0)] },
];

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const base = { ...layoutEmBranco(120, 100), edificacoes: [{ poligono: [[0, 0], [5, 0], [5, 5]] as [number, number][], altura: 4 }], slug: "arena-teste", evento: {}, fonte: { documentos: [], nota: "", rotuloPlanta: "Planta", rotuloAta: "Ata" }, ata: [], corredores: [], semPosicaoNaPlanta: [], contagensDaPlanta: [] };
  await (await getDb()).insert(arenas).values({ slug: "arena-teste", nome: "Arena teste", base: base as never });
}, 120_000);

const lerBase = async () => (await (await getDb()).query.arenas.findFirst({ where: eq(arenas.slug, "arena-teste") }))!.base;

describe("entorno 3D da arena", () => {
  it("importa prédios e ruas do OSM, guarda onde a planta fica e mantém o desenhado à mão", async () => {
    const r = await importarEntornoArena(E.admin, "arena-teste", { lat: -20, lon: -40, giro: 0 }, async () => osm);
    expect(r).toMatchObject({ predios: 2, ruas: 2 });
    const base = await lerBase();
    expect(base.geo).toEqual({ lat: -20, lon: -40, giro: 0 });
    expect(base.edificacoes.filter((e) => e.origem === "osm")).toHaveLength(2);
    expect(base.edificacoes.filter((e) => !e.origem)).toHaveLength(1);
    expect(base.vias.every((v) => v.origem === "osm")).toBe(true);
    expect(base.fonte.documentos.some((d) => d.nome === "Entorno 3D")).toBe(true);
  });

  it("importar de novo substitui (não duplica); remover tira só o que veio do OSM", async () => {
    await importarEntornoArena(E.admin, "arena-teste", { lat: -20, lon: -40, giro: 0 }, async () => osm.slice(0, 1));
    expect((await lerBase()).edificacoes).toHaveLength(2);
    await removerEntornoArena(E.admin, "arena-teste");
    const base = await lerBase();
    expect(base.edificacoes).toHaveLength(1);
    expect(base.vias).toHaveLength(0);
    expect(base.fonte.documentos.some((d) => d.nome === "Entorno 3D")).toBe(false);
  });

  it("valida coordenadas, exige permissão e não mexe na arena fixa", async () => {
    await expect(importarEntornoArena(E.admin, "arena-teste", { lat: 120, lon: -40, giro: 0 }, async () => osm)).rejects.toThrow(/coordenadas/);
    await expect(importarEntornoArena(E.logistica, "arena-teste", { lat: -20, lon: -40, giro: 0 }, async () => osm)).rejects.toThrow();
    await expect(importarEntornoArena(E.admin, "eco-run-sp-2026", { lat: -23.5, lon: -46.6, giro: 0 }, async () => osm)).rejects.toThrow(/fixa/);
  });
});
