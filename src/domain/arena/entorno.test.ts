import { describe, expect, it } from "vitest";
import { alturaDoPredio, entornoDoOsm, projetar, type ArenaGeo, type ElementoOsm } from "./entorno";

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
});
