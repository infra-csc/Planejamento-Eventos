import * as THREE from "three";
import type { Vec2 } from "@/domain/arena/tipos";
import { amostrar, comprimento } from "@/domain/arena/geometria";

/**
 * Faixa deitada no chão ao longo de uma polilinha (vias, percurso, currais), com normais médias
 * nas curvas e UV em metros (u ao longo, v na largura).
 */
export function fita(eixo: Vec2[], largura: number, y: number, deslocamento = 0, passo = 3): THREE.BufferGeometry {
  const total = comprimento(eixo);
  const amostras = amostrar(eixo, Math.max(2, Math.ceil(total / passo) + 1));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  amostras.forEach(({ ponto }, i) => {
    const a = amostras[Math.max(0, i - 1)].ponto;
    const b = amostras[Math.min(amostras.length - 1, i + 1)].ponto;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const nz = (b[0] - a[0]) / len;
    const u = (total * i) / (amostras.length - 1);
    for (const lado of [-1, 1]) {
      const off = deslocamento + (lado * largura) / 2;
      pos.push(ponto[0] + nx * off, y, ponto[1] + nz * off);
      uv.push(u, lado < 0 ? 0 : largura);
    }
    if (i > 0) {
      const k = (i - 1) * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Garante normal para cima independentemente do sentido da polilinha.
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/** Distância de um ponto a uma polilinha, em metros. */
export function distanciaAoEixo(x: number, z: number, eixo: Vec2[]): number {
  let melhor = Infinity;
  for (let i = 1; i < eixo.length; i++) {
    const [ax, az] = eixo[i - 1];
    const [bx, bz] = eixo[i];
    const len2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len2));
    melhor = Math.min(melhor, Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))));
  }
  return melhor;
}

export function dentroPoligono(x: number, z: number, p: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i];
    const [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Polígono do plano xz como geometria deitada no chão, com UV em metros/4. */
export function planoDoPoligono(poligono: Vec2[], y: number): THREE.BufferGeometry {
  const s = new THREE.Shape(poligono.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
  g.translate(0, y, 0);
  return g;
}
