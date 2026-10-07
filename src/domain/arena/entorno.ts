/**
 * Entorno real da arena a partir do OpenStreetMap: prédios (com altura) e ruas em volta da planta.
 *
 * A arena tem um referencial próprio (x para a direita da planta, z para baixo, metros, origem no centro
 * da área). `ArenaGeo` amarra esse referencial ao mundo: onde fica o centro (lat/lon) e quanto a planta
 * está girada em relação ao norte. Com isso, um ponto do mapa (lat/lon) vira [x, z] da arena:
 *   [x, z] = R(giro) · [leste, sul]   (metros a partir do centro)
 * Sem giro, a planta tem o norte para cima (x = leste, z = sul).
 */
import type { Edificacao, Vec2, Via } from "./tipos";

export type ArenaGeo = {
  /** Centro da área da planta. */
  lat: number;
  lon: number;
  /** Giro da planta, em graus: ângulo que leva o leste para a direita da planta (0 = norte para cima). */
  giro: number;
};

/** Elemento do Overpass com geometria (`out body geom`). */
export type ElementoOsm = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number } | null>;
  members?: Array<{ type: string; role: string; geometry?: Array<{ lat: number; lon: number } | null> }>;
};

const M_POR_GRAU_LAT = 110574;
const mPorGrauLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Ponto do mundo → referencial da arena. */
export function projetar(geo: ArenaGeo, lat: number, lon: number): Vec2 {
  const leste = (lon - geo.lon) * mPorGrauLon(geo.lat);
  const sul = (geo.lat - lat) * M_POR_GRAU_LAT;
  const t = (geo.giro * Math.PI) / 180;
  return [arred(Math.cos(t) * leste - Math.sin(t) * sul), arred(Math.sin(t) * leste + Math.cos(t) * sul)];
}

/** Retângulo (sul, oeste, norte, leste) que cobre a área da arena mais a margem, para a consulta ao OSM. */
export function caixaDeBusca(geo: ArenaGeo, area: { minX: number; maxX: number; minZ: number; maxZ: number }, margem: number) {
  const r = Math.hypot(Math.max(-area.minX, area.maxX), Math.max(-area.minZ, area.maxZ)) + margem;
  const dLat = r / M_POR_GRAU_LAT;
  const dLon = r / mPorGrauLon(geo.lat);
  return { sul: geo.lat - dLat, oeste: geo.lon - dLon, norte: geo.lat + dLat, leste: geo.lon + dLon };
}

/** Consulta Overpass: prédios e ruas carroçáveis da caixa. */
export function consultaOverpass(c: { sul: number; oeste: number; norte: number; leste: number }): string {
  const bb = [c.sul, c.oeste, c.norte, c.leste].map((n) => n.toFixed(6)).join(",");
  return `[out:json][timeout:60];(way["building"](${bb});relation["building"](${bb});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"](${bb}););out body geom;`;
}

const arred = (n: number) => Math.round(n * 10) / 10;

/** "12", "12 m", "12,5" → metros. */
function metros(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Altura do prédio: a informada; senão andares × 3 m; senão um padrão pelo tipo do prédio. */
export function alturaDoPredio(tags: Record<string, string>): number {
  const h = metros(tags.height) ?? metros(tags["building:height"]);
  if (h) return Math.min(h, 250);
  const andares = metros(tags["building:levels"]);
  if (andares) return Math.min(andares * 3 + (tags["roof:shape"] && tags["roof:shape"] !== "flat" ? 1.5 : 0.6), 250);
  const tipo = tags.building ?? "yes";
  if (["kiosk", "roof", "shed", "hut", "carport", "garage", "garages", "toilets", "cabin", "service", "transformer_tower"].includes(tipo)) return 3.5;
  if (["house", "detached", "semidetached_house", "terrace", "bungalow", "residential"].includes(tipo)) return 7;
  if (["apartments", "hotel", "dormitory"].includes(tipo)) return 24;
  if (["commercial", "retail", "office", "public", "civic", "government", "hospital", "school", "university"].includes(tipo)) return 11;
  if (["industrial", "warehouse", "hangar", "sports_hall", "stadium"].includes(tipo)) return 10;
  if (["church", "cathedral", "chapel", "mosque", "temple"].includes(tipo)) return 14;
  return 8;
}

/** Largura da rua pelo tipo (metros). */
function larguraDaVia(highway: string): number {
  const t = highway.replace(/_link$/, "");
  if (t === "motorway" || t === "trunk") return 16;
  if (t === "primary") return 13;
  if (t === "secondary") return 11;
  if (t === "tertiary") return 9;
  if (t === "service") return 4.5;
  return 7;
}

function areaPoligono(p: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

const centroide = (p: Vec2[]): Vec2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

/** Anéis de um elemento de prédio: o contorno do way, ou os contornos externos da relação. */
function aneis(e: ElementoOsm): Array<Array<{ lat: number; lon: number }>> {
  const limpo = (g: Array<{ lat: number; lon: number } | null> | undefined) => (g ?? []).filter((x): x is { lat: number; lon: number } => x !== null);
  if (e.type === "way") return [limpo(e.geometry)];
  if (e.type === "relation") return (e.members ?? []).filter((m) => m.type === "way" && m.role !== "inner").map((m) => limpo(m.geometry));
  return [];
}

/**
 * Prédios e ruas do OSM no referencial da arena. Ficam só os que caem na área mais a margem
 * (o resto da caixa de busca é canto do círculo). Ruas dentro da planta saem: a foto já as mostra.
 */
export function entornoDoOsm(elementos: ElementoOsm[], geo: ArenaGeo, area: { minX: number; maxX: number; minZ: number; maxZ: number }, margem: number): { edificacoes: Edificacao[]; vias: Via[] } {
  const dentro = ([x, z]: Vec2, m: number) => x >= area.minX - m && x <= area.maxX + m && z >= area.minZ - m && z <= area.maxZ + m;
  const edificacoes: Edificacao[] = [];
  const vias: Via[] = [];
  for (const e of elementos) {
    const tags = e.tags ?? {};
    if (tags.building && tags.building !== "no") {
      for (const anel of aneis(e)) {
        if (anel.length < 4) continue;
        let poligono = anel.map((g) => projetar(geo, g.lat, g.lon));
        // Contorno fechado repete o primeiro ponto no fim: a extrusão não precisa dele.
        const [a, b] = [poligono[0], poligono[poligono.length - 1]];
        if (a[0] === b[0] && a[1] === b[1]) poligono = poligono.slice(0, -1);
        if (poligono.length < 3 || areaPoligono(poligono) < 8) continue;
        if (!dentro(centroide(poligono), margem)) continue;
        edificacoes.push({ poligono, altura: arred(alturaDoPredio(tags)), origem: "osm" });
      }
    } else if (tags.highway && e.type === "way") {
      const pts = (e.geometry ?? []).filter((g): g is { lat: number; lon: number } => g !== null).map((g) => projetar(geo, g.lat, g.lon));
      // Partes contínuas fora da planta (e dentro da margem): dentro da planta a rua já está na foto.
      let trecho: Vec2[] = [];
      const fechar = () => {
        if (trecho.length >= 2) vias.push({ nome: tags.name ?? tags.highway, eixo: trecho, largura: larguraDaVia(tags.highway), origem: "osm" });
        trecho = [];
      };
      for (const p of pts) {
        if (dentro(p, margem) && !dentro(p, -2)) trecho.push(p);
        else fechar();
      }
      fechar();
    }
  }
  return { edificacoes, vias };
}
