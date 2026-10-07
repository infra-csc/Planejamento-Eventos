import { describe, expect, it } from "vitest";
import { alturaDoPredio, entornoDoOsm, projetar, recortar, type ArenaGeo, type ElementoOsm } from "./entorno";

const geo: ArenaGeo = { lat: -20, lon: -40, giro: 0 };
const kLon = 111320 * Math.cos((-20 * Math.PI) / 180);
// Ponto a `leste` m para leste e `sul` m para o sul do centro.
const pt = (leste: number, sul: number) => ({ lat: -20 - sul / 110574, lon: -40 + leste / kLon });
const area = { minX: -50, maxX: 50, minZ: -40, maxZ: 40 };

describe("entorno da arena (OpenStreetMap)", () => {
  it("projeta lat/lon no referencial da planta, com e sem giro", () => {
    const p = pt(30, 10);
    expect(projetar(geo, p.lat, p.lon)).toEqual([30, 10]);
    // Planta girada -90° (o norte fica à esquerda): o sul vai para a direita e o leste para cima.
    expect(projetar({ ...geo, giro: -90 }, p.lat, p.lon)).toEqual([10, -30]);
  });

  it("altura: informada, por andares ou pelo tipo do prédio", () => {
    expect(alturaDoPredio({ building: "yes", height: "18 m" })).toBe(18);
    expect(alturaDoPredio({ building: "apartments", "building:levels": "10" })).toBeCloseTo(30.6);
    expect(alturaDoPredio({ building: "house" })).toBe(7);
    expect(alturaDoPredio({ building: "kiosk" })).toBe(3.5);
    expect(alturaDoPredio({ building: "yes" })).toBe(8);
  });

  it("prédios perto da área entram; longe, minúsculos ou sem contorno, não", () => {
    const quadrado = (cx: number, cz: number, l: number) => [pt(cx - l, cz - l), pt(cx + l, cz - l), pt(cx + l, cz + l), pt(cx - l, cz + l), pt(cx - l, cz - l)];
    const elementos: ElementoOsm[] = [
      { type: "way", id: 1, tags: { building: "yes", "building:levels": "4" }, geometry: quadrado(0, 0, 5) },
      { type: "way", id: 2, tags: { building: "house" }, geometry: quadrado(80, 0, 5) },
      { type: "way", id: 3, tags: { building: "yes" }, geometry: quadrado(400, 0, 5) },
      { type: "way", id: 4, tags: { building: "yes" }, geometry: quadrado(10, 10, 1) },
      { type: "relation", id: 5, tags: { building: "yes" }, members: [{ type: "way", role: "outer", geometry: quadrado(-20, 20, 6) }] },
    ];
    const { edificacoes } = entornoDoOsm(elementos, geo, area, 100);
    expect(edificacoes).toHaveLength(3);
    expect(edificacoes[0]).toMatchObject({ altura: 12.6, origem: "osm" });
    expect("poligono" in edificacoes[0] && edificacoes[0].poligono).toHaveLength(4);
  });

  it("ruas: só os trechos fora da planta (dentro, a foto já mostra)", () => {
    const rua: ElementoOsm = { type: "way", id: 9, tags: { highway: "primary", name: "Avenida" }, geometry: [pt(-120, 0), pt(-70, 0), pt(-20, 0), pt(20, 0), pt(70, 0), pt(120, 0)] };
    const { vias } = entornoDoOsm([rua], geo, area, 100);
    expect(vias).toHaveLength(2);
    expect(vias[0]).toMatchObject({ nome: "Avenida", largura: 13, origem: "osm" });
    expect(vias.flatMap((v) => v.eixo).every(([x]) => Math.abs(x) > 50)).toBe(true);
  });

  it("mar: a faixa fica do lado direito da linha da costa (lado da água no OSM)", () => {
    // Costa indo de oeste para leste: à direita fica o sul (z positivo).
    const costa: ElementoOsm = { type: "way", id: 20, tags: { natural: "coastline" }, geometry: [pt(-200, 60), pt(200, 60)] };
    const { superficies } = entornoDoOsm([costa], geo, area, 100);
    expect(superficies).toHaveLength(1);
    expect(superficies[0].tipo).toBe("agua");
    expect(superficies[0].poligono.every(([, z]) => z >= 59.9)).toBe(true);
  });

  it("recorta polígonos no retângulo do chão", () => {
    const r = recortar([[-10, -10], [30, -10], [30, 10], [-10, 10]], { minX: 0, maxX: 20, minZ: -5, maxZ: 5 });
    expect(r).toHaveLength(4);
    expect(r.every(([x, z]) => x >= 0 && x <= 20 && z >= -5 && z <= 5)).toBe(true);
  });

  it("chão por tipo, multipolígono emendado e árvores (soltas, em fileira e no bosque)", () => {
    const anel = (cx: number, cz: number, l: number) => [pt(cx - l, cz - l), pt(cx + l, cz - l), pt(cx + l, cz + l), pt(cx - l, cz + l), pt(cx - l, cz - l)];
    const q = anel(-90, 0, 20);
    const elementos: ElementoOsm[] = [
      { type: "way", id: 30, tags: { natural: "beach" }, geometry: anel(0, 70, 25) },
      { type: "way", id: 31, tags: { leisure: "park" }, geometry: anel(90, 0, 20) },
      // Lago em relação com o anel externo partido em dois pedaços (um deles ao contrário).
      { type: "relation", id: 32, tags: { natural: "water" }, members: [{ type: "way", role: "outer", geometry: q.slice(0, 3) }, { type: "way", role: "outer", geometry: [...q.slice(2)].reverse() }] },
      { type: "way", id: 33, tags: { natural: "wood" }, geometry: anel(0, -80, 15) },
      { type: "node", id: 34, tags: { natural: "tree" }, ...pt(10, 10) },
      { type: "way", id: 35, tags: { natural: "tree_row" }, geometry: [pt(-40, -20), pt(-12, -20)] },
    ];
    const { superficies, arvores } = entornoDoOsm(elementos, geo, area, 100);
    expect(superficies.map((x) => x.tipo)).toEqual(["agua", "areia", "verde", "verde"]);
    expect(arvores).toContainEqual([10, 10]);
    expect(arvores.filter(([, z]) => z === -20).length).toBe(4);
    expect(arvores.filter(([, z]) => z < -60).length).toBeGreaterThan(4);
  });
});
