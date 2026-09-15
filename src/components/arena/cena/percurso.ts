import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { Arena, Vec2 } from "@/domain/arena/tipos";
import { amostrar, comprimento, pontoNaDistancia } from "@/domain/arena/geometria";
import { Materiais, PALETA } from "./materiais";
import { fita } from "./fita";

export type Percurso3D = {
  grupo: THREE.Group;
  /** Linha de espessura constante em pixels: mantém o percurso legível com a câmera afastada. */
  trilho: LineMaterial;
};

/** Pontos a cada `passo` metros, deslocados lateralmente. */
function aoLongoDe(eixo: Vec2[], passo: number, deslocamento: number) {
  const n = Math.max(2, Math.floor(comprimento(eixo) / passo) + 1);
  return amostrar(eixo, n).map(({ ponto, angulo }) => ({
    x: ponto[0] - Math.sin(angulo) * deslocamento,
    z: ponto[1] + Math.cos(angulo) * deslocamento,
    angulo,
  }));
}

export function construirPercurso(arena: Arena, m: Materiais): Percurso3D {
  const grupo = new THREE.Group();
  grupo.name = "percurso";
  const alta = m.qualidade === "alta";
  const trilho = new LineMaterial({ color: PALETA.percurso, linewidth: 3.5, worldUnits: false });
  const matFaixa = m.solido(PALETA.percurso, { rugosidade: 0.9 });
  const matBorda = m.solido(PALETA.bordaPercurso, { rugosidade: 1 });
  const setaGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-1, -1.1), new THREE.Vector2(1.2, 0), new THREE.Vector2(-1, 1.1), new THREE.Vector2(-0.35, 0)]));
  setaGeo.rotateX(-Math.PI / 2);
  const setas: THREE.Matrix4[] = [];
  const grades: THREE.Matrix4[] = [];
  const eixoY = new THREE.Vector3(0, 1, 0);

  const comCurral = new Set(arena.currais.length ? ["largada"] : []);
  for (const t of arena.percurso.trechos) {
    // Nos currais a cor do pelotão é a informação; ali o percurso fica só com bordas e setas.
    if (!comCurral.has(t.id)) {
      const faixa = new THREE.Mesh(fita(t.eixo, t.largura, 0.1), matFaixa);
      faixa.receiveShadow = alta;
      grupo.add(faixa);
    }
    for (const lado of [-1, 1]) grupo.add(new THREE.Mesh(fita(t.eixo, 0.35, 0.115, (lado * t.largura) / 2), matBorda));
    const total = comprimento(t.eixo);
    for (let d = 10; d < total - 4; d += 22) {
      const { ponto, angulo } = pontoNaDistancia(t.eixo, d);
      setas.push(new THREE.Matrix4().compose(new THREE.Vector3(ponto[0], 0.13, ponto[1]), new THREE.Quaternion().setFromAxisAngle(eixoY, -angulo), new THREE.Vector3(1, 1, 1)));
    }
    const geo = new LineGeometry();
    geo.setPositions(t.eixo.flatMap(([x, z]) => [x, 0.7, z]));
    const linha = new Line2(geo, trilho);
    linha.computeLineDistances();
    linha.userData.lod = "longe";
    grupo.add(linha);
    // Grades de isolamento dos dois lados do corredor (as linhas azuis da planta).
    for (const lado of [-1, 1]) {
      for (const p of aoLongoDe(t.eixo, 2.05, (lado * (t.largura + 0.3)) / 2)) {
        grades.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0.1, p.z), new THREE.Quaternion().setFromAxisAngle(eixoY, -p.angulo), new THREE.Vector3(1, 1, 1)));
      }
    }
  }

  const setasMesh = new THREE.InstancedMesh(setaGeo, matBorda, setas.length);
  setas.forEach((mt, i) => setasMesh.setMatrixAt(i, mt));
  const gradeGeo = new THREE.BoxGeometry(2, 1.05, 0.05);
  gradeGeo.translate(0, 0.55, 0);
  const gradesMesh = new THREE.InstancedMesh(gradeGeo, m.solido(PALETA.grade, { metal: 0.45, rugosidade: 0.55 }), grades.length);
  grades.forEach((mt, i) => gradesMesh.setMatrixAt(i, mt));
  gradesMesh.castShadow = alta;
  grupo.add(setasMesh, gradesMesh);

  // Cones grandes da ata (400) distribuídos pelos corredores, pelo lado de fora das grades.
  const trechos = arena.percurso.trechos;
  const total = trechos.reduce((a, t) => a + comprimento(t.eixo), 0);
  const coneGeo = new THREE.ConeGeometry(0.2, 0.75, 8);
  coneGeo.translate(0, 0.375, 0);
  const cones = new THREE.InstancedMesh(coneGeo, m.solido(PALETA.cone, { rugosidade: 0.7 }), arena.percurso.conesGrandes);
  let k = 0;
  trechos.forEach((t, i) => {
    const n = i === trechos.length - 1 ? arena.percurso.conesGrandes - k : Math.round((arena.percurso.conesGrandes * comprimento(t.eixo)) / total);
    for (const p of amostrar(t.eixo, Math.max(2, n))) {
      if (k >= arena.percurso.conesGrandes) break;
      const off = t.largura / 2 + 1.1;
      cones.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(p.ponto[0] - Math.sin(p.angulo) * off, 0.05, p.ponto[1] + Math.cos(p.angulo) * off));
    }
  });
  cones.count = k;
  cones.castShadow = alta;
  grupo.add(cones);

  return { grupo, trilho };
}

function geometriaPessoa() {
  const corpo = new THREE.CylinderGeometry(0.2, 0.16, 1.25, 6).toNonIndexed();
  corpo.translate(0, 0.62, 0);
  const cabeca = new THREE.SphereGeometry(0.13, 6, 4).toNonIndexed();
  cabeca.translate(0, 1.4, 0);
  const g = new THREE.BufferGeometry();
  const pos = [...corpo.getAttribute("position").array, ...cabeca.getAttribute("position").array];
  const nor = [...corpo.getAttribute("normal").array, ...cabeca.getAttribute("normal").array];
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  corpo.dispose();
  cabeca.dispose();
  return g;
}

const CORES_ROUPA = [0x2f3a4a, 0x8e2740, 0xe9e5df, 0x4f4849, 0x5e7d6a, 0x3d6b82, 0xc9b27c, 0x6b4f57];

function sementeira(semente: number) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/**
 * Público representado junto às grades da largada e da chegada, no corredor dos estandes e na frente do
 * palco. É leitura de ocupação, não contagem: a ata prevê 11.000 pessoas.
 */
export function construirPublico(arena: Arena, m: Materiais): THREE.InstancedMesh {
  const alta = m.qualidade === "alta";
  const n = alta ? 1100 : 380;
  const r = sementeira(42);
  const locais: Array<() => [number, number]> = [];
  for (const t of arena.percurso.trechos.filter((t) => t.id !== "via-norte")) {
    const total = comprimento(t.eixo);
    locais.push(() => {
      const { ponto, angulo } = pontoNaDistancia(t.eixo, r() * total);
      const lado = r() < 0.5 ? -1 : 1;
      const off = lado * (t.largura / 2 + 1.2 + r() * 3.5);
      return [ponto[0] - Math.sin(angulo) * off, ponto[1] + Math.cos(angulo) * off];
    });
  }
  const estandes = arena.pontos.filter((p) => p.tipo === "Estande 9x6");
  if (estandes.length) {
    const xs = estandes.map((p) => p.posicao[0]);
    const zs = estandes.map((p) => p.posicao[1]);
    const minX = Math.min(...xs) - 6;
    const maxX = Math.max(...xs) + 6;
    const meioZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    locais.push(() => [minX + r() * (maxX - minX), meioZ + (r() - 0.5) * 16]);
  }
  const palco = arena.pontos.find((p) => p.id === "palco");
  if (palco) locais.push(() => [palco.posicao[0] - 8 - r() * 22, palco.posicao[1] + (r() - 0.5) * 24]);

  const mesh = new THREE.InstancedMesh(geometriaPessoa(), m.solido(0xffffff, { rugosidade: 1 }), n);
  const cor = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const [x, z] = locais[i % locais.length]();
    mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.02, z));
    mesh.setColorAt(i, cor.setHex(CORES_ROUPA[Math.floor(r() * CORES_ROUPA.length)]));
  }
  mesh.castShadow = alta;
  return mesh;
}

export type Fluxo = { mesh: THREE.InstancedMesh; atualizar: (segundos: number) => void };

/**
 * Corredores ilustrativos nos corredores da planta, com ritmo realista (4:00 a 5:30 min/km).
 * Quando houver leitura de chip, `Arena.corredores` substitui esta simulação.
 */
export function construirFluxo(arena: Arena, m: Materiais): Fluxo {
  const n = m.qualidade === "alta" ? 240 : 90;
  const trechos = arena.percurso.trechos.map((t) => ({ t, total: comprimento(t.eixo) }));
  const soma = trechos.reduce((a, x) => a + x.total, 0);
  const mesh = new THREE.InstancedMesh(geometriaPessoa(), m.solido(0xffffff, { rugosidade: 1 }), n);
  const cor = new THREE.Color();
  let acumulado = 0;
  const dados = Array.from({ length: n }, (_, i) => {
    const alvo = (i / n) * soma;
    let idx = 0;
    acumulado = 0;
    while (idx < trechos.length - 1 && acumulado + trechos[idx].total < alvo) acumulado += trechos[idx++].total;
    return {
      trecho: trechos[idx],
      inicio: alvo - acumulado,
      velocidade: 1000 / (240 + ((i * 37) % 90)),
      lateral: (((i * 53) % 100) / 100 - 0.5) * Math.max(1, trechos[idx].t.largura - 1.4),
    };
  });
  dados.forEach((_, i) => mesh.setColorAt(i, cor.setHex(i % 5 === 0 ? 0xe9e5df : CORES_ROUPA[i % CORES_ROUPA.length])));
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const posicao = new THREE.Vector3();
  const escala = new THREE.Vector3(1, 1, 1);
  const atualizar = (s: number) => {
    for (let i = 0; i < n; i++) {
      const d = dados[i];
      const { ponto, angulo } = pontoNaDistancia(d.trecho.t.eixo, (d.inicio + d.velocidade * s) % d.trecho.total);
      q.setFromAxisAngle(eixoY, -angulo);
      posicao.set(ponto[0] - Math.sin(angulo) * d.lateral, 0.14, ponto[1] + Math.cos(angulo) * d.lateral);
      mesh.setMatrixAt(i, mat.compose(posicao, q, escala));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  atualizar(0);
  return { mesh, atualizar };
}
