import * as THREE from "three";
import type { Arena, Vec2 } from "@/domain/arena/tipos";
import { pontoNaDistancia, comprimento, poligonoFaixa } from "@/domain/arena/geometria";
import { ZONA_VISUAL } from "@/domain/arena/categorias";
import { Materiais, PALETA } from "./materiais";
import { dentroPoligono, distanciaAoEixo, fita, planoDoPoligono } from "./fita";

/** Gerador pseudoaleatório com semente: a vegetação é sempre a mesma entre visitas. */
function aleatorio(semente: number) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotuloNaVia(m: Materiais, texto: string, eixo: Vec2[], distancia: number, largura: number) {
  const { ponto, angulo } = pontoNaDistancia(eixo, distancia);
  const altura = largura / 14;
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), m.texto(texto, { fundo: "#4d494b", cor: "#dcd6ce", proporcao: 14 }));
  placa.rotation.set(-Math.PI / 2, 0, -angulo);
  placa.position.set(ponto[0], 0.07, ponto[1]);
  return placa;
}

export function construirAmbiente(arena: Arena, m: Materiais): { base: THREE.Group; zonas: THREE.Group } {
  const base = new THREE.Group();
  base.name = "ambiente";
  const alta = m.qualidade === "alta";
  const rnd = aleatorio(20260614);
  const { minX, maxX, minZ, maxZ } = arena.area;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  // Gramado do parque com borda ampla para o horizonte não "acabar" na planta.
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX + 1600, maxZ - minZ + 1600), m.solido(PALETA.parque, { rugosidade: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.set(cx, -0.02, cz);
  chao.receiveShadow = alta;
  base.add(chao);

  for (const z of arena.zonas.filter((z) => z.tipo === "arena" || z.tipo === "agua")) {
    const agua = z.tipo === "agua";
    const mesh = new THREE.Mesh(planoDoPoligono(z.poligono, agua ? 0.012 : 0.008), agua ? m.solido(0x869ea2, { rugosidade: 0.25, metal: 0.15 }) : m.solido(PALETA.gramado, { rugosidade: 1 }));
    mesh.receiveShadow = alta;
    base.add(mesh);
  }

  // Vias pelo traçado da planta: calçada, asfalto e marcação de faixa.
  const tracos: THREE.Matrix4[] = [];
  arena.vias.forEach((via, i) => {
    const y = 0.03 + i * 0.006;
    const calcada = new THREE.Mesh(fita(via.eixo, via.largura + 6, y - 0.01), m.solido(PALETA.calcada, { rugosidade: 1 }));
    const asfalto = new THREE.Mesh(fita(via.eixo, via.largura, y), m.solido(PALETA.asfalto, { rugosidade: 0.95 }));
    calcada.receiveShadow = asfalto.receiveShadow = alta;
    base.add(calcada, asfalto);
    if (via.largura < 12 || via.largura >= 30) return;
    const total = comprimento(via.eixo);
    const pistas = via.largura >= 30 ? [-via.largura / 3, 0, via.largura / 3] : [-via.largura / 4, via.largura / 4];
    for (let d = 8; d < total - 8; d += 11) {
      const { ponto, angulo } = pontoNaDistancia(via.eixo, d);
      for (const off of pistas) {
        const px = ponto[0] - Math.sin(angulo) * off;
        const pz = ponto[1] + Math.cos(angulo) * off;
        tracos.push(new THREE.Matrix4().compose(new THREE.Vector3(px, y + 0.008, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -angulo, "YXZ")), new THREE.Vector3(1, 1, 1)));
      }
    }
  });
  const tracosMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 0.16), m.solido(PALETA.faixa, { rugosidade: 1 }), tracos.length);
  tracos.forEach((mt, i) => tracosMesh.setMatrixAt(i, mt));
  base.add(tracosMesh);
  const avenida = arena.vias[0];
  if (avenida) base.add(rotuloNaVia(m, avenida.nome.toUpperCase(), avenida.eixo, comprimento(avenida.eixo) * 0.28, 70));

  // Obelisco: praça em leque voltada para a avenida, eixo monumental e o fuste de 72 m.
  if (arena.marco) {
    const [ox, oz] = arena.marco.posicao;
    const pedra = m.solido(PALETA.pedra, { rugosidade: 0.85 });
    const praca = new THREE.Mesh(new THREE.CircleGeometry(arena.marco.raioPraca, alta ? 64 : 28, -Math.PI, Math.PI), m.solido(PALETA.praca, { rugosidade: 1 }));
    praca.rotation.x = -Math.PI / 2;
    praca.position.set(ox, 0.05, oz);
    const anel = new THREE.Mesh(new THREE.RingGeometry(arena.marco.raioPraca, arena.marco.raioPraca + 7, alta ? 64 : 28, 1, -Math.PI, Math.PI), m.solido(0x7c7777, { rugosidade: 0.95 }));
    anel.rotation.x = -Math.PI / 2;
    anel.position.set(ox, 0.06, oz);
    const eixoMonumental = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 72), m.solido(PALETA.praca, { rugosidade: 1 }));
    eixoMonumental.position.set(ox, 0.05, oz + 36);
    const plinto = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 16), pedra);
    plinto.position.set(ox, 0.8, oz);
    const fuste = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 4.8, arena.marco.altura, 4), pedra);
    fuste.rotation.y = Math.PI / 4;
    fuste.position.set(ox, 1.6 + arena.marco.altura / 2, oz);
    for (const o of [praca, anel, eixoMonumental]) o.receiveShadow = alta;
    for (const o of [plinto, fuste]) {
      o.castShadow = alta;
      o.receiveShadow = alta;
    }
    base.add(praca, anel, eixoMonumental, plinto, fuste);
  }

  // Edificações do entorno: só volume, tom neutro.
  const matPredio = m.solido(PALETA.predio, { rugosidade: 0.95 });
  for (const e of arena.edificacoes) {
    let geo: THREE.BufferGeometry;
    if ("centro" in e) {
      geo = new THREE.SphereGeometry(e.raio, alta ? 32 : 16, alta ? 12 : 6, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1, e.altura / e.raio, 1);
      geo.translate(e.centro[0], 0, e.centro[1]);
    } else {
      const forma = new THREE.Shape(e.poligono.map(([x, z]) => new THREE.Vector2(x, z)));
      geo = new THREE.ExtrudeGeometry(forma, { depth: e.altura, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, e.altura, 0);
    }
    const mesh = new THREE.Mesh(geo, matPredio);
    mesh.castShadow = alta;
    mesh.receiveShadow = alta;
    base.add(mesh);
  }

  // Vegetação: densa no parque, rala no gramado da arena, nunca sobre vias, lago, estruturas ou percurso.
  const lago = arena.zonas.filter((z) => z.tipo === "agua").map((z) => z.poligono);
  const arenaPoligono = arena.zonas.find((z) => z.tipo === "arena")?.poligono ?? [];
  const bloqueios: Array<{ x: number; z: number; r: number }> = arena.pontos.flatMap((p) => (p.modelos.length ? p.modelos.map((mo) => ({ x: mo.posicao[0], z: mo.posicao[1], r: mo.tipo === "tenda" && mo.quantidade > 3 ? 30 : 13 })) : [{ x: p.posicao[0], z: p.posicao[1], r: 12 }]));
  if (arena.marco) bloqueios.push({ x: arena.marco.posicao[0], z: arena.marco.posicao[1], r: arena.marco.raioPraca + 10 });
  const livre = (x: number, z: number) => {
    if (arena.vias.some((v) => distanciaAoEixo(x, z, v.eixo) < v.largura / 2 + 6)) return false;
    if (arena.percurso.trechos.some((t) => distanciaAoEixo(x, z, t.eixo) < t.largura / 2 + 5)) return false;
    if (lago.some((p) => dentroPoligono(x, z, p))) return false;
    if (bloqueios.some((b) => Math.hypot(x - b.x, z - b.z) < b.r)) return false;
    if (arena.edificacoes.some((e) => ("centro" in e ? Math.hypot(x - e.centro[0], z - e.centro[1]) < e.raio + 4 : dentroPoligono(x, z, e.poligono)))) return false;
    if (arena.marco && Math.abs(x - arena.marco.posicao[0]) < 10 && z > arena.marco.posicao[1] && z < arena.marco.posicao[1] + 75) return false;
    return true;
  };
  const arvores: Array<{ x: number; z: number; s: number }> = [];
  const alvo = alta ? 1700 : 560;
  for (let t = 0; arvores.length < alvo && t < alvo * 8; t++) {
    const x = minX - 120 + rnd() * (maxX - minX + 240);
    const z = minZ - 120 + rnd() * (maxZ - minZ + 240);
    if (dentroPoligono(x, z, arenaPoligono) && rnd() > 0.12) continue;
    if (!livre(x, z)) continue;
    arvores.push({ x, z, s: 3 + rnd() * 3.6 });
  }
  const copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, alta ? 1 : 0), m.solido(0xffffff, { rugosidade: 1 }), arvores.length);
  const troncoGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 5);
  troncoGeo.translate(0, 0.5, 0);
  const troncos = new THREE.InstancedMesh(troncoGeo, m.solido(PALETA.tronco, { rugosidade: 1 }), arvores.length);
  const cor = new THREE.Color();
  arvores.forEach((a, i) => {
    const h = a.s * 0.85;
    troncos.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(a.x, 0, a.z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    copas.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(a.x, h + a.s * 0.72, a.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(a.s * 1.05, a.s * 0.85, a.s)));
    copas.setColorAt(i, cor.setHex(PALETA.copa).offsetHSL((rnd() - 0.5) * 0.035, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.09));
  });
  copas.castShadow = alta;
  base.add(copas, troncos);

  // Camada "Áreas": currais coloridos por pelotão e áreas de apoio com contorno tracejado.
  const zonas = new THREE.Group();
  zonas.name = "zonas";
  for (const c of arena.currais) {
    const pad = new THREE.Mesh(fita(c.eixo, c.largura, 0.09), m.solido(new THREE.Color(c.cor).getHex(), { rugosidade: 0.95, opacidade: 0.88 }));
    pad.renderOrder = 1;
    zonas.add(pad);
  }
  for (const z of arena.zonas.filter((z) => z.tipo === "apoio" || z.tipo === "restrita" || z.tipo === "atletas")) {
    const mat = z.tipo === "restrita" ? m.hachura("#c8997f", "#e9ded2") : m.solido(new THREE.Color(ZONA_VISUAL[z.tipo].cor).getHex(), { rugosidade: 1, opacidade: 0.75 });
    zonas.add(new THREE.Mesh(planoDoPoligono(z.poligono, 0.05), mat));
    const contorno = [...z.poligono, z.poligono[0]].map(([x, zz]) => new THREE.Vector3(x, 0.14, zz));
    const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(contorno), new THREE.LineDashedMaterial({ color: z.tipo === "restrita" ? 0xa8400f : 0x5f5758, dashSize: 2.5, gapSize: 1.8 }));
    linha.computeLineDistances();
    zonas.add(linha);
  }
  for (const c of arena.currais) {
    const borda = [...poligonoFaixa(c.eixo, c.largura), poligonoFaixa(c.eixo, c.largura)[0]].map(([x, z]) => new THREE.Vector3(x, 0.16, z));
    zonas.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(borda), new THREE.LineBasicMaterial({ color: 0x2a1418, transparent: true, opacity: 0.35 })));
  }
  return { base, zonas };
}
