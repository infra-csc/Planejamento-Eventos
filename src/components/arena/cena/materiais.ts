import * as THREE from "three";

export type Qualidade = "alta" | "leve";

/** Paleta da cena: manhã de prova (largada 06:30), tons terrosos e o vinho da marca só no percurso. */
export const PALETA = {
  ceu: 0xe9e4de,
  gramado: 0xa3ab90,
  parque: 0x94a07f,
  asfalto: 0x4f4b4d,
  faixa: 0xeeeae4,
  calcada: 0xcdc6be,
  canteiro: 0x8e977b,
  predio: 0xc6beb4,
  copa: 0x6e7c5b,
  tronco: 0x6a5a4c,
  pedra: 0xd8cfbf,
  praca: 0xd6cfc3,
  trelica: 0xc5c9cd,
  lona: 0xf4f1ec,
  fechamento: 0xe2ddd5,
  metal: 0x8c9196,
  painel: 0x2a1418,
  acento: 0x8e2740,
  percurso: 0x8e2740,
  bordaPercurso: 0xf2e7e9,
  grade: 0xa7acb1,
  cone: 0xc8662a,
  carpete: 0xd4cbc1,
  gerador: 0x5b6158,
  cocho: 0x5f7f91,
  medico: 0xa8400f,
  pessoa: 0x6f6366,
} as const;

type OpcoesSolido = { rugosidade?: number; metal?: number; opacidade?: number; duplo?: boolean };

/**
 * Cache de materiais e texturas: a cena inteira usa algumas dezenas de materiais,
 * todos descartados juntos no dispose.
 */
export class Materiais {
  private cache = new Map<string, THREE.Material>();
  private texturas: THREE.Texture[] = [];

  constructor(readonly qualidade: Qualidade) {}

  solido(cor: number, o: OpcoesSolido = {}): THREE.MeshStandardMaterial {
    const chave = `s|${cor}|${o.rugosidade ?? 0.9}|${o.metal ?? 0}|${o.opacidade ?? 1}|${o.duplo ? 1 : 0}`;
    let m = this.cache.get(chave) as THREE.MeshStandardMaterial | undefined;
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: cor,
        roughness: o.rugosidade ?? 0.9,
        metalness: o.metal ?? 0,
        transparent: (o.opacidade ?? 1) < 1,
        opacity: o.opacidade ?? 1,
        side: o.duplo ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: (o.opacidade ?? 1) >= 1,
      });
      this.cache.set(chave, m);
    }
    return m;
  }

  /** Box truss: textura de treliça com recorte, repetida ao longo da barra pela UV. */
  trelica(): THREE.MeshStandardMaterial {
    const chave = "trelica";
    const existente = this.cache.get(chave) as THREE.MeshStandardMaterial | undefined;
    if (existente) return existente;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.strokeStyle = "#c5c9cd";
    g.lineWidth = 7;
    g.strokeRect(3.5, 3.5, 57, 57);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(6, 6);
    g.lineTo(58, 58);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.qualidade === "alta" ? 4 : 1;
    this.texturas.push(tex);
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.55 });
    this.cache.set(chave, m);
    return m;
  }

  /** Texto impresso numa lona (testeira, fundo de palco, estande). */
  texto(texto: string, o: { fundo: string; cor: string; proporcao: number; faixa?: string }): THREE.MeshStandardMaterial {
    const chave = `t|${texto}|${o.fundo}|${o.cor}|${o.proporcao.toFixed(2)}|${o.faixa ?? ""}`;
    const existente = this.cache.get(chave) as THREE.MeshStandardMaterial | undefined;
    if (existente) return existente;
    const largura = this.qualidade === "alta" ? 512 : 256;
    const altura = Math.max(32, Math.round(largura / o.proporcao));
    const c = document.createElement("canvas");
    c.width = largura;
    c.height = altura;
    const g = c.getContext("2d")!;
    g.fillStyle = o.fundo;
    g.fillRect(0, 0, largura, altura);
    if (o.faixa) {
      g.fillStyle = o.faixa;
      g.fillRect(0, altura * 0.86, largura, altura * 0.14);
    }
    g.fillStyle = o.cor;
    g.textAlign = "center";
    g.textBaseline = "middle";
    let tamanho = altura * 0.5;
    g.font = `600 ${tamanho}px Geist, "Helvetica Neue", Arial, sans-serif`;
    while (g.measureText(texto).width > largura * 0.86 && tamanho > 8) {
      tamanho -= 2;
      g.font = `600 ${tamanho}px Geist, "Helvetica Neue", Arial, sans-serif`;
    }
    g.fillText(texto, largura / 2, altura * (o.faixa ? 0.45 : 0.52));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texturas.push(tex);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    this.cache.set(chave, m);
    return m;
  }

  /** Hachura diagonal para área restrita. UV da geometria em metros (1 repetição a cada 4 m). */
  hachura(cor: string, fundo: string): THREE.MeshStandardMaterial {
    const chave = `h|${cor}|${fundo}`;
    const existente = this.cache.get(chave) as THREE.MeshStandardMaterial | undefined;
    if (existente) return existente;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    g.fillStyle = fundo;
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = cor;
    g.lineWidth = 5;
    g.beginPath();
    for (let i = -32; i <= 64; i += 16) {
      g.moveTo(i, 32);
      g.lineTo(i + 32, 0);
    }
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texturas.push(tex);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
    this.cache.set(chave, m);
    return m;
  }

  /**
   * Superfície com variação sutil (gramado, asfalto): quebra o aspecto de plástico sem foto.
   * `metrosPorTile` define a escala sobre UVs em metros/4.
   */
  ruido(cor: number, o: { variacao: number; metrosPorTile: number; rugosidade?: number; vertexColors?: boolean }): THREE.MeshStandardMaterial {
    const chave = `r|${cor}|${o.variacao}|${o.metrosPorTile}|${o.rugosidade ?? 1}|${o.vertexColors ? 1 : 0}`;
    const existente = this.cache.get(chave) as THREE.MeshStandardMaterial | undefined;
    if (existente) return existente;
    const n = this.qualidade === "alta" ? 256 : 128;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d")!;
    const base = new THREE.Color(cor);
    const img = g.createImageData(n, n);
    let s = 1337;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    // Ruído em duas oitavas, suavizado por blocos, para manchas e grão.
    const grosso = Array.from({ length: 17 * 17 }, rnd);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const gx = (x / n) * 16;
        const gy = (y / n) * 16;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const v = (i: number, j: number) => grosso[((j % 16) * 17 + (i % 16)) % grosso.length];
        const mancha = v(ix, iy) * (1 - fx) * (1 - fy) + v(ix + 1, iy) * fx * (1 - fy) + v(ix, iy + 1) * (1 - fx) * fy + v(ix + 1, iy + 1) * fx * fy;
        const k = 1 + (mancha - 0.5) * o.variacao + (rnd() - 0.5) * o.variacao * 0.35;
        const p = (y * n + x) * 4;
        img.data[p] = Math.min(255, base.r * 255 * k);
        img.data[p + 1] = Math.min(255, base.g * 255 * k);
        img.data[p + 2] = Math.min(255, base.b * 255 * k);
        img.data[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4 / o.metrosPorTile, 4 / o.metrosPorTile);
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.anisotropy = this.qualidade === "alta" ? 8 : 2;
    this.texturas.push(tex);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: o.rugosidade ?? 1, vertexColors: o.vertexColors ?? false });
    this.cache.set(chave, m);
    return m;
  }

  /** Céu em gradiente suave: horizonte quente de manhã, topo mais frio. */
  ceu(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#c9d3d8");
    grad.addColorStop(0.55, "#e4e3dd");
    grad.addColorStop(1, "#ece5dc");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texturas.push(tex);
    return tex;
  }

  /** Material comum com vertex colors (sombreamento embutido em árvores e prédios). */
  comVertices(cor: number, rugosidade = 1): THREE.MeshStandardMaterial {
    const chave = `v|${cor}|${rugosidade}`;
    let m = this.cache.get(chave) as THREE.MeshStandardMaterial | undefined;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: cor, roughness: rugosidade, vertexColors: true });
      this.cache.set(chave, m);
    }
    return m;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.texturas) t.dispose();
    this.cache.clear();
    this.texturas = [];
  }
}

/** Marca sombras conforme a qualidade. */
export function sombrear(obj: THREE.Object3D, qualidade: Qualidade, recebe = true) {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = qualidade === "alta";
      o.receiveShadow = recebe && qualidade === "alta";
    }
  });
}
