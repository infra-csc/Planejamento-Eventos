/**
 * Entorno real da arena a partir do OpenStreetMap: prédios (com altura) e ruas em volta da planta.
 *
 * A arena tem um referencial próprio (x para a direita da planta, z para baixo, metros, origem no centro
 * da área). `ArenaGeo` amarra esse referencial ao mundo: onde fica o centro (lat/lon) e quanto a planta
 * está girada em relação ao norte. Com isso, um ponto do mapa (lat/lon) vira [x, z] da arena:
 *   [x, z] = R(giro) · [leste, sul]   (metros a partir do centro)
 * Sem giro, a planta tem o norte para cima (x = leste, z = sul).
 */
import type { Edificacao, Superficie, Vec2, Via } from "./tipos";

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
  /** Só em nós (ex.: árvore isolada). */
  lat?: number;
  lon?: number;
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

/** Consulta Overpass: prédios, ruas carroçáveis, linha da costa, água, areia, áreas verdes e árvores da caixa. */
export function consultaOverpass(c: { sul: number; oeste: number; norte: number; leste: number }): string {
  const bb = [c.sul, c.oeste, c.norte, c.leste].map((n) => n.toFixed(6)).join(",");
  return [
    "[out:json][timeout:60];(",
    `way["building"](${bb});relation["building"](${bb});`,
    `way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"](${bb});`,
    `way["natural"~"^(coastline|water|beach|sand|wood|scrub|grassland|wetland|tree_row)$"](${bb});relation["natural"~"^(water|beach|sand|wood)$"](${bb});`,
    `way["waterway"="riverbank"](${bb});way["landuse"~"^(grass|forest|meadow|recreation_ground|village_green)$"](${bb});relation["landuse"="forest"](${bb});`,
    `way["leisure"~"^(park|garden)$"](${bb});relation["leisure"="park"](${bb});node["natural"="tree"](${bb});`,
    ");out body geom;",
  ].join("");
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

type LatLon = { lat: number; lon: number };
const limpo = (g: Array<LatLon | null> | undefined) => (g ?? []).filter((x): x is LatLon => x !== null);
const mesmo = (a: LatLon, b: LatLon) => Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lon - b.lon) < 1e-9;

/**
 * Anéis externos de um elemento: o contorno do way, ou os da relação (multipolígono). Na relação, o anel
 * externo costuma vir em vários pedaços: são emendados pelas pontas até fechar.
 */
function aneis(e: ElementoOsm): LatLon[][] {
  if (e.type === "way") return [limpo(e.geometry)];
  if (e.type !== "relation") return [];
  const pedacos = (e.members ?? []).filter((m) => m.type === "way" && m.role !== "inner").map((m) => limpo(m.geometry)).filter((p) => p.length >= 2);
  const fechados: LatLon[][] = [];
  while (pedacos.length) {
    let anel = pedacos.shift()!;
    for (let emendou = true; emendou && !mesmo(anel[0], anel[anel.length - 1]); ) {
      emendou = false;
      for (let i = 0; i < pedacos.length; i++) {
        const p = pedacos[i];
        const fim = anel[anel.length - 1];
        if (mesmo(fim, p[0])) anel = [...anel, ...p.slice(1)];
        else if (mesmo(fim, p[p.length - 1])) anel = [...anel, ...[...p].reverse().slice(1)];
        else continue;
        pedacos.splice(i, 1);
        emendou = true;
        break;
      }
    }
    if (mesmo(anel[0], anel[anel.length - 1])) fechados.push(anel);
  }
  return fechados;
}

type Retangulo = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Recorte de polígono por retângulo (Sutherland–Hodgman): o chão importado não passa do chão da cena. */
export function recortar(poligono: Vec2[], r: Retangulo): Vec2[] {
  const bordas: Array<[(p: Vec2) => boolean, (a: Vec2, b: Vec2) => Vec2]> = [
    [(p) => p[0] >= r.minX, (a, b) => [r.minX, a[1] + ((b[1] - a[1]) * (r.minX - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= r.maxX, (a, b) => [r.maxX, a[1] + ((b[1] - a[1]) * (r.maxX - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= r.minZ, (a, b) => [a[0] + ((b[0] - a[0]) * (r.minZ - a[1])) / (b[1] - a[1]), r.minZ]],
    [(p) => p[1] <= r.maxZ, (a, b) => [a[0] + ((b[0] - a[0]) * (r.maxZ - a[1])) / (b[1] - a[1]), r.maxZ]],
  ];
  let saida = poligono;
  for (const [dentro, cortar] of bordas) {
    const entrada = saida;
    saida = [];
    for (let i = 0; i < entrada.length; i++) {
      const a = entrada[(i + entrada.length - 1) % entrada.length];
      const b = entrada[i];
      if (dentro(b)) {
        if (!dentro(a)) saida.push(cortar(a, b));
        saida.push(b);
      } else if (dentro(a)) saida.push(cortar(a, b));
    }
    if (!saida.length) return [];
  }
  return saida.map(([x, z]) => [arred(x), arred(z)]);
}

/** Tipo de chão de um elemento do OSM (ou null quando não é chão que interessa). */
function tipoDeSuperficie(t: Record<string, string>): Superficie["tipo"] | null {
  if (t.natural === "water" || t.waterway === "riverbank" || t.natural === "wetland") return "agua";
  if (t.natural === "beach" || t.natural === "sand") return "areia";
  if (["wood", "scrub", "grassland"].includes(t.natural ?? "") || ["grass", "forest", "meadow", "recreation_ground", "village_green"].includes(t.landuse ?? "") || ["park", "garden"].includes(t.leisure ?? "")) return "verde";
  return null;
}

/** Ponto dentro do polígono (par-ímpar). */
function dentroDoPoligono(x: number, z: number, p: Vec2[]): boolean {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i][1] > z !== p[j][1] > z && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) d = !d;
  }
  return d;
}

/** Quanto o mar avança a partir da linha da costa (metros), do lado da água. */
const FAIXA_MAR_M = 700;
/** Árvores no máximo (instâncias na cena). */
const MAX_ARVORES = 2500;

/**
 * Prédios e ruas do OSM no referencial da arena. Ficam só os que caem na área mais a margem
 * (o resto da caixa de busca é canto do círculo). Ruas dentro da planta saem: a foto já as mostra.
 */
export function entornoDoOsm(
  elementos: ElementoOsm[],
  geo: ArenaGeo,
  area: Retangulo,
  margem: number,
): { edificacoes: Edificacao[]; vias: Via[]; superficies: Superficie[]; arvores: Vec2[] } {
  const dentro = ([x, z]: Vec2, m: number) => x >= area.minX - m && x <= area.maxX + m && z >= area.minZ - m && z <= area.maxZ + m;
  // O chão importado vai um pouco além dos prédios (a cena mostra mais longe que a margem).
  const MARGEM_CHAO = margem + 380;
  const retChao: Retangulo = { minX: area.minX - MARGEM_CHAO, maxX: area.maxX + MARGEM_CHAO, minZ: area.minZ - MARGEM_CHAO, maxZ: area.maxZ + MARGEM_CHAO };
  const edificacoes: Edificacao[] = [];
  const vias: Via[] = [];
  const superficies: Superficie[] = [];
  const arvores: Vec2[] = [];
  const bosques: Vec2[][] = [];
  for (const e of elementos) {
    const tags = e.tags ?? {};
    if (e.type === "node") {
      if (tags.natural === "tree" && e.lat != null && e.lon != null) {
        const p = projetar(geo, e.lat, e.lon);
        if (dentro(p, margem)) arvores.push(p);
      }
      continue;
    }
    if (tags.natural === "coastline" && e.type === "way") {
      // Linha da costa: no OSM a água fica à direita do sentido do traço. O mar é a faixa varrida
      // para esse lado (deslocamento constante pela corda do trecho, sem se cruzar), recortada no chão da cena.
      const pts = limpo(e.geometry).map((g) => projetar(geo, g.lat, g.lon));
      if (pts.length < 2) continue;
      const [x0, z0] = pts[0];
      const [x1, z1] = pts[pts.length - 1];
      const l = Math.hypot(x1 - x0, z1 - z0) || 1;
      const [nx, nz] = [(-(z1 - z0) / l) * FAIXA_MAR_M, ((x1 - x0) / l) * FAIXA_MAR_M];
      const faixa = recortar([...pts, ...[...pts].reverse().map(([x, z]) => [x + nx, z + nz] as Vec2)], retChao);
      if (faixa.length >= 3) superficies.push({ tipo: "agua", poligono: faixa });
      continue;
    }
    if (tags.natural === "tree_row" && e.type === "way") {
      const pts = limpo(e.geometry).map((g) => projetar(geo, g.lat, g.lon));
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]];
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7));
        for (let k = 0; k < n; k++) {
          const p: Vec2 = [arred(a[0] + ((b[0] - a[0]) * k) / n), arred(a[1] + ((b[1] - a[1]) * k) / n)];
          if (dentro(p, margem)) arvores.push(p);
        }
      }
      continue;
    }
    const tipoChao = !tags.building ? tipoDeSuperficie(tags) : null;
    if (tipoChao) {
      for (const anel of aneis(e)) {
        if (anel.length < 4) continue;
        const poligono = recortar(anel.slice(0, -1).map((g) => projetar(geo, g.lat, g.lon)), retChao);
        if (poligono.length < 3 || areaPoligono(poligono) < 20) continue;
        superficies.push({ tipo: tipoChao, poligono });
        if (tags.natural === "wood" || tags.landuse === "forest") bosques.push(poligono);
      }
      continue;
    }
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
  // Mata mapeada só como área: árvores numa grade irregular (uma a cada ~9 m), até o limite.
  for (const b of bosques) {
    const xs = b.map((p) => p[0]);
    const zs = b.map((p) => p[1]);
    for (let x = Math.min(...xs); x < Math.max(...xs) && arvores.length < MAX_ARVORES; x += 9) {
      for (let z = Math.min(...zs); z < Math.max(...zs) && arvores.length < MAX_ARVORES; z += 9) {
        const p: Vec2 = [arred(x + (((x * 7 + z * 13) % 5) - 2)), arred(z + (((x * 11 + z * 3) % 5) - 2))];
        if (dentro(p, margem) && dentroDoPoligono(p[0], p[1], b)) arvores.push(p);
      }
    }
  }
  // Água por baixo, depois areia, depois verde: o mais específico desenha por cima.
  const ordem = { agua: 0, areia: 1, verde: 2 } as const;
  superficies.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);
  return { edificacoes, vias, superficies, arvores: arvores.slice(0, MAX_ARVORES) };
}
