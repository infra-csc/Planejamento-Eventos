import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Modelo } from "@/domain/arena/tipos";
import { Materiais, PALETA, sombrear } from "./materiais";

/**
 * Construtores leves das estruturas, em escala real (metros). Cada estrutura junta suas peças
 * numa malha por material: poucas chamadas de desenho mesmo com dezenas de tendas.
 */

type Partes = Map<THREE.Material, THREE.BufferGeometry[]>;

const SECAO = 0.4; // box truss 40 cm

function adicionar(partes: Partes, mat: THREE.Material, geo: THREE.BufferGeometry) {
  const lista = partes.get(mat) ?? [];
  lista.push(geo);
  partes.set(mat, lista);
}

function caixa(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** Barra de treliça entre dois pontos; a UV repete a textura a cada 40 cm ao longo da barra. */
function trelica(a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.BoxGeometry(len, SECAO, SECAO);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // Faces 2..5 (py, ny, pz, nz) têm u ao longo do comprimento.
  for (let i = 8; i < 24; i++) uv.setX(i, uv.getX(i) * (len / SECAO));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Quadro retangular de treliça: 4 colunas e anel superior. */
function gaiola(partes: Partes, m: Materiais, w: number, d: number, h: number, y0 = 0) {
  const t = m.trelica();
  const cx = w / 2 - SECAO / 2;
  const cz = d / 2 - SECAO / 2;
  for (const [x, z] of [[-cx, -cz], [cx, -cz], [cx, cz], [-cx, cz]]) adicionar(partes, t, trelica(v(x, y0, z), v(x, y0 + h, z)));
  const y = y0 + h;
  adicionar(partes, t, trelica(v(-cx, y, -cz), v(cx, y, -cz)));
  adicionar(partes, t, trelica(v(-cx, y, cz), v(cx, y, cz)));
  adicionar(partes, t, trelica(v(-cx, y, -cz), v(-cx, y, cz)));
  adicionar(partes, t, trelica(v(cx, y, -cz), v(cx, y, cz)));
}

function montar(partes: Partes, nome: string): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = nome;
  for (const [mat, geos] of partes) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) for (const g of geos) g.dispose();
    if (!geo) continue;
    grupo.add(new THREE.Mesh(geo, mat));
  }
  return grupo;
}

function portico(m: Materiais, vao: number, testeira: number | undefined, rotulo: string) {
  const partes: Partes = new Map();
  const t = m.trelica();
  const altura = 6;
  const x = vao / 2 + SECAO / 2;
  adicionar(partes, t, trelica(v(-x, 0, 0), v(-x, altura, 0)));
  adicionar(partes, t, trelica(v(x, 0, 0), v(x, altura, 0)));
  adicionar(partes, t, trelica(v(-x - 0.2, altura + 0.2, 0), v(x + 0.2, altura + 0.2, 0)));
  const metal = m.solido(PALETA.metal, { rugosidade: 0.5, metal: 0.4 });
  adicionar(partes, metal, caixa(1.1, 0.08, 1.1, -x, 0.04, 0));
  adicionar(partes, metal, caixa(1.1, 0.08, 1.1, x, 0.04, 0));
  // Orelhas laterais, levemente abertas.
  const lona = m.solido(PALETA.painel, { rugosidade: 0.95 });
  adicionar(partes, lona, caixa(1.5, 4.4, 0.06, -x - 1.05, 2.6, 0.25, 0.35));
  adicionar(partes, lona, caixa(1.5, 4.4, 0.06, x + 1.05, 2.6, 0.25, -0.35));
  const grupo = montar(partes, "portico");
  // Testeira com o nome, legível dos dois lados do pórtico.
  const hTesteira = testeira ?? 1.1;
  const larg = vao + SECAO * 2 + 0.4;
  const matTexto = m.texto(rotulo.toUpperCase(), { fundo: "#2a1418", cor: "#ffffff", proporcao: larg / hTesteira, faixa: "#8e2740" });
  for (const lado of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(larg, hTesteira), matTexto);
    p.position.set(0, altura + 0.2 + SECAO / 2 + hTesteira / 2, lado * 0.06);
    if (lado < 0) p.rotation.y = Math.PI;
    grupo.add(p);
  }
  return grupo;
}

function tendas(m: Materiais, lado: number, quantidade: number, colunas: number | undefined, fechamentos: boolean, passoXZ?: [number, number]) {
  const partes: Partes = new Map();
  const cols = colunas ?? Math.ceil(Math.sqrt(quantidade));
  const linhas = Math.ceil(quantidade / cols);
  const passo = passoXZ?.[0] ?? lado + 0.5;
  const passoZ = passoXZ?.[1] ?? passo;
  const beiral = 2.4;
  const perna = m.solido(PALETA.metal, { rugosidade: 0.5, metal: 0.5 });
  const lona = m.solido(PALETA.lona, { rugosidade: 0.95 });
  const parede = m.solido(PALETA.fechamento, { rugosidade: 1, duplo: true });
  for (let i = 0; i < quantidade; i++) {
    const cx = (i % cols) * passo - ((cols - 1) * passo) / 2;
    const cz = Math.floor(i / cols) * passoZ - ((linhas - 1) * passoZ) / 2;
    const a = lado / 2 - 0.05;
    for (const [dx, dz] of [[-a, -a], [a, -a], [a, a], [-a, a]]) {
      const g = new THREE.CylinderGeometry(0.05, 0.05, beiral, 5);
      g.translate(cx + dx, beiral / 2, cz + dz);
      adicionar(partes, perna, g);
    }
    const alturaTeto = lado * 0.3;
    const teto = new THREE.ConeGeometry(lado / Math.SQRT2, alturaTeto, 4, 1);
    teto.rotateY(Math.PI / 4);
    teto.translate(cx, beiral + alturaTeto / 2, cz);
    adicionar(partes, lona, teto);
    adicionar(partes, lona, caixa(lado, 0.3, lado, cx, beiral - 0.15, cz));
    if (fechamentos) {
      adicionar(partes, parede, caixa(lado, beiral - 0.3, 0.03, cx, (beiral - 0.3) / 2, cz - a));
      adicionar(partes, parede, caixa(0.03, beiral - 0.3, lado, cx - a, (beiral - 0.3) / 2, cz));
      adicionar(partes, parede, caixa(0.03, beiral - 0.3, lado, cx + a, (beiral - 0.3) / 2, cz));
    }
  }
  return montar(partes, "tendas");
}

function palco(m: Materiais, w: number, d: number) {
  const partes: Partes = new Map();
  adicionar(partes, m.solido(0x3a3335, { rugosidade: 0.8 }), caixa(w, 1.2, d, 0, 0.6, 0));
  adicionar(partes, m.solido(0x3a3335, { rugosidade: 0.8 }), caixa(1.4, 0.6, 1.2, w / 2 - 1, 0.3, d / 2 + 0.6));
  gaiola(partes, m, w, d, 6, 1.2);
  const grupo = montar(partes, "palco");
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, 4.4), m.texto("ECO RUN SP 2026", { fundo: "#2a1418", cor: "#f4f1ec", proporcao: (w - 0.8) / 4.4, faixa: "#8e2740" }));
  fundo.position.set(0, 1.2 + 2.4, -d / 2 + 0.3);
  grupo.add(fundo);
  return grupo;
}

function estander(m: Materiais, w: number, d: number, marca: string) {
  const partes: Partes = new Map();
  adicionar(partes, m.solido(PALETA.carpete, { rugosidade: 1 }), caixa(w, 0.05, d, 0, 0.025, 0));
  gaiola(partes, m, w, d, 3.6);
  adicionar(partes, m.solido(PALETA.fechamento, { rugosidade: 1 }), caixa(w - 0.8, 3.0, 0.08, 0, 1.55, -d / 2 + 0.3));
  adicionar(partes, m.solido(0xf4f1ec, { rugosidade: 0.9 }), caixa(1.2, 1, 1, 0, 0.5, d / 2 - 1));
  const grupo = montar(partes, "estander");
  const faixa = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, 1), m.texto(marca, { fundo: "#f4f1ec", cor: "#2a1418", proporcao: (w - 0.8) / 1, faixa: "#7a5f00" }));
  faixa.position.set(0, 3.1, -d / 2 + 0.36);
  grupo.add(faixa);
  return grupo;
}

function quadro(m: Materiais) {
  const partes: Partes = new Map();
  const t = m.trelica();
  adicionar(partes, t, trelica(v(-2, 0, 0), v(-2, 3.6, 0)));
  adicionar(partes, t, trelica(v(2, 0, 0), v(2, 3.6, 0)));
  adicionar(partes, t, trelica(v(-2.2, 3.6, 0), v(2.2, 3.6, 0)));
  adicionar(partes, t, trelica(v(-2.2, 0.4, 0), v(2.2, 0.4, 0)));
  adicionar(partes, m.solido(0xece6df, { rugosidade: 1 }), caixa(3.6, 3, 0.06, 0, 2, 0));
  return montar(partes, "quadro");
}

function totem(m: Materiais, forma: "trimandala" | "tenis") {
  if (forma === "trimandala") {
    const partes: Partes = new Map();
    const t = m.trelica();
    const cantos = [0, 1, 2].map((i) => v(Math.cos((i * 2 * Math.PI) / 3) * 1.4, 0, Math.sin((i * 2 * Math.PI) / 3) * 1.4));
    for (let i = 0; i < 3; i++) {
      const a = cantos[i];
      const b = cantos[(i + 1) % 3];
      adicionar(partes, t, trelica(a, v(a.x, 5, a.z)));
      adicionar(partes, t, trelica(v(a.x, 5, a.z), v(b.x, 5, b.z)));
      const meio = v((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      const ang = Math.atan2(b.z - a.z, b.x - a.x);
      const g = new THREE.BoxGeometry(2.1, 4.2, 0.05);
      g.rotateY(-ang);
      g.translate(meio.x * 1.02, 2.6, meio.z * 1.02);
      adicionar(partes, m.solido(i === 0 ? PALETA.acento : PALETA.painel, { rugosidade: 0.9 }), g);
    }
    return montar(partes, "trimandala");
  }
  const grupo = new THREE.Group();
  grupo.name = "icone-tenis";
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 1.4), m.trelica());
  base.position.y = 0.6;
  grupo.add(base);
  const s = new THREE.Shape();
  s.moveTo(-1.7, 0);
  s.lineTo(1.7, 0);
  s.quadraticCurveTo(1.9, 0.5, 1.2, 0.7);
  s.lineTo(0.2, 1.0);
  s.lineTo(-0.6, 1.6);
  s.lineTo(-1.6, 1.6);
  s.quadraticCurveTo(-1.8, 0.8, -1.7, 0);
  const corpo = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: false }), m.solido(0xf4f1ec, { rugosidade: 0.7 }));
  corpo.position.set(0, 1.45, -0.45);
  grupo.add(corpo);
  const sola = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 0.95), m.solido(PALETA.acento, { rugosidade: 0.8 }));
  sola.position.set(0, 1.33, 0);
  grupo.add(sola);
  return grupo;
}

function repetir(m: Materiais, nome: string, quantidade: number, passo: number, porItem: (partes: Partes, x: number) => void, fileiras = 1) {
  const partes: Partes = new Map();
  const cols = Math.ceil(quantidade / fileiras);
  for (let i = 0; i < quantidade; i++) {
    const x = (i % cols) * passo - ((cols - 1) * passo) / 2;
    const z = Math.floor(i / cols) * 1.8 - ((fileiras - 1) * 1.8) / 2;
    const antes = new Map<THREE.Material, number>();
    for (const [mat, l] of partes) antes.set(mat, l.length);
    porItem(partes, x);
    if (z !== 0) for (const [mat, l] of partes) for (let k = antes.get(mat) ?? 0; k < l.length; k++) l[k].translate(0, 0, z);
  }
  return montar(partes, nome);
}

function veiculo(m: Materiais, forma: "ambulancia" | "van" | "moto") {
  const partes: Partes = new Map();
  const roda = m.solido(0x2b2829, { rugosidade: 0.9 });
  const vidro = m.solido(0x3b4550, { rugosidade: 0.3, metal: 0.2 });
  if (forma === "moto") {
    adicionar(partes, m.solido(PALETA.painel), caixa(1.9, 0.9, 0.5, 0, 0.75, 0));
  } else {
    const corpo = forma === "ambulancia" ? 0xf2f0ec : 0xcfcac4;
    adicionar(partes, m.solido(corpo, { rugosidade: 0.5 }), caixa(3.9, 2.4, 2.05, -0.6, 1.55, 0));
    adicionar(partes, m.solido(corpo, { rugosidade: 0.5 }), caixa(1.4, 1.6, 2.05, 2.05, 1.15, 0));
    adicionar(partes, vidro, caixa(0.05, 0.7, 1.8, 2.76, 1.55, 0));
    if (forma === "ambulancia") adicionar(partes, m.solido(PALETA.medico, { rugosidade: 0.6 }), caixa(3.92, 0.35, 2.07, -0.6, 1.2, 0));
    for (const [x, z] of [[-1.6, 1.02], [-1.6, -1.02], [1.9, 1.02], [1.9, -1.02]]) {
      const g = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
      g.rotateX(Math.PI / 2);
      g.translate(x, 0.38, z);
      adicionar(partes, roda, g);
    }
  }
  return montar(partes, forma);
}

/** Piso claro sob a estrutura: marca a área ocupada e ajuda a ler a implantação de longe. */
function pisoSob(g: THREE.Group, m: Materiais) {
  const b = new THREE.Box3();
  g.updateMatrixWorld(true);
  for (const c of g.children) {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh) continue;
    mesh.geometry.computeBoundingBox();
    b.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix));
  }
  const geo = new THREE.PlaneGeometry(b.max.x - b.min.x + 2.4, b.max.z - b.min.z + 2.4);
  geo.rotateX(-Math.PI / 2);
  const piso = new THREE.Mesh(geo, m.solido(0xe6dccb, { rugosidade: 1 }));
  piso.position.set((b.min.x + b.max.x) / 2, 0.04, (b.min.z + b.max.z) / 2);
  piso.name = "piso";
  return piso;
}

/** Constrói um modelo posicionado e girado no plano da arena. */
export function construirModelo(modelo: Modelo, m: Materiais, rotulo: string): THREE.Group {
  let g: THREE.Group;
  switch (modelo.tipo) {
    case "portico":
      g = portico(m, modelo.vao, modelo.testeira, rotulo);
      break;
    case "tenda":
      g = tendas(m, modelo.lado, modelo.quantidade, modelo.colunas, Boolean(modelo.fechamentos), modelo.passo);
      break;
    case "cacamba": {
      const partes: Partes = new Map();
      adicionar(partes, m.solido(0xb58f2a, { rugosidade: 0.7, metal: 0.3 }), caixa(5.8, 1.5, 2.4, 0, 0.85, 0));
      adicionar(partes, m.solido(0x3a3637, { rugosidade: 0.9 }), caixa(5.4, 0.1, 2.2, 0, 1.62, 0));
      g = montar(partes, "cacamba");
      break;
    }
    case "banheiros":
      g = repetir(m, "banheiros", modelo.quantidade, 1.25, (p, x) => {
        adicionar(p, m.solido(0x3e5f86, { rugosidade: 0.6 }), caixa(1.15, 2.3, 1.15, x, 1.15, 0));
        adicionar(p, m.solido(0xeeeae4, { rugosidade: 0.7 }), caixa(1.2, 0.1, 1.2, x, 2.35, 0));
      });
      break;
    case "espaco": {
      const grupo = new THREE.Group();
      grupo.name = "espaco";
      const piso = new THREE.Mesh(new THREE.CircleGeometry(modelo.raio, 32), m.solido(0xd9cfbf, { rugosidade: 1 }));
      piso.rotation.x = -Math.PI / 2;
      piso.position.y = 0.06;
      const borda = new THREE.Mesh(new THREE.TorusGeometry(modelo.raio, 0.22, 6, 40), m.solido(PALETA.acento, { rugosidade: 0.8 }));
      borda.rotation.x = -Math.PI / 2;
      borda.position.y = 0.25;
      grupo.add(piso, borda);
      for (let k = 0; k < 6; k++) {
        const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 8), m.solido(0x6e7c5b, { rugosidade: 1 }));
        vaso.position.set(Math.cos((k / 6) * Math.PI * 2) * (modelo.raio - 0.9), 0.3, Math.sin((k / 6) * Math.PI * 2) * (modelo.raio - 0.9));
        grupo.add(vaso);
      }
      g = grupo;
      break;
    }
    case "palco":
      g = palco(m, modelo.largura, modelo.profundidade);
      break;
    case "estander":
      g = estander(m, modelo.largura, modelo.profundidade, modelo.marca);
      break;
    case "quadro":
      g = quadro(m);
      break;
    case "totem":
      g = totem(m, modelo.forma);
      break;
    case "gerador":
      g = repetir(m, "geradores", modelo.quantidade, 4, (p, x) => {
        adicionar(p, m.solido(PALETA.gerador, { rugosidade: 0.6, metal: 0.2 }), caixa(3, 1.7, 1.3, x, 0.95, 0));
        adicionar(p, m.solido(0x2b2829), caixa(3.1, 0.1, 1.4, x, 0.05, 0));
      });
      break;
    case "mesas":
      g = repetir(m, "mesas", modelo.quantidade, 1.6, (p, x) => adicionar(p, m.solido(0xf1eee9, { rugosidade: 1 }), caixa(1, 0.75, 1, x, 0.375, 0)), 2);
      break;
    case "cochos":
      g = repetir(m, "cochos", modelo.quantidade, 2.3, (p, x) => {
        adicionar(p, m.solido(PALETA.cocho, { rugosidade: 0.6 }), caixa(2, 0.35, 0.55, x, 0.95, 0));
        adicionar(p, m.solido(PALETA.metal, { metal: 0.4, rugosidade: 0.5 }), caixa(0.06, 0.8, 0.6, x - 0.8, 0.4, 0));
        adicionar(p, m.solido(PALETA.metal, { metal: 0.4, rugosidade: 0.5 }), caixa(0.06, 0.8, 0.6, x + 0.8, 0.4, 0));
      });
      break;
    case "veiculo":
      g = veiculo(m, modelo.forma);
      break;
  }
  if (modelo.tipo !== "veiculo" && modelo.tipo !== "espaco" && modelo.tipo !== "totem") g.add(pisoSob(g, m));
  g.position.set(modelo.posicao[0], 0, modelo.posicao[1]);
  g.rotation.y = "rotacao" in modelo ? (modelo.rotacao ?? 0) : 0;
  sombrear(g, m.qualidade);
  return g;
}
