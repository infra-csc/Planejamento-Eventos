import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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

/** Escurece a base e clareia o topo: oclusão falsa, barata e convincente de longe. */
function gradienteVertical(g: THREE.BufferGeometry, baixo: number, alto: number) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const cores = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / Math.max(0.001, max.y - min.y);
    const k = baixo + (alto - baixo) * Math.pow(t, 0.8);
    cores[i * 3] = cores[i * 3 + 1] = cores[i * 3 + 2] = k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  return g;
}

/** Copa de árvore folhosa: três massas sobrepostas, sem índice (compatível com merge). */
function copaFolhosa(detalhe: number) {
  const partes = [
    [0, 0, 0, 1],
    [0.55, -0.15, 0.2, 0.72],
    [-0.45, -0.1, -0.35, 0.68],
  ].map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, detalhe);
    g.translate(x, y, z);
    return g;
  });
  const g = mergeGeometries(partes, false)!;
  partes.forEach((p) => p.dispose());
  return gradienteVertical(g, 0.62, 1.12);
}

function copaAlta(detalhe: number) {
  const g = new THREE.IcosahedronGeometry(1, detalhe);
  g.scale(0.7, 1.35, 0.7);
  return gradienteVertical(g, 0.6, 1.08);
}

function rotuloNaVia(m: Materiais, texto: string, eixo: Vec2[], distancia: number, largura: number) {
  const { ponto, angulo } = pontoNaDistancia(eixo, distancia);
  const altura = largura / 14;
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), m.texto(texto, { fundo: "#4a4648", cor: "#d9d3cb", proporcao: 14 }));
  placa.rotation.set(-Math.PI / 2, 0, -angulo);
  placa.position.set(ponto[0], 0.08, ponto[1]);
  return placa;
}

function juntar(geos: THREE.BufferGeometry[], mat: THREE.Material, sombra: boolean) {
  if (!geos.length) return null;
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  if (!g) return null;
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = sombra;
  return mesh;
}

export function construirAmbiente(arena: Arena, m: Materiais): { base: THREE.Group; zonas: THREE.Group } {
  const base = new THREE.Group();
  base.name = "ambiente";
  const alta = m.qualidade === "alta";
  const rnd = aleatorio(20260614);
  const { minX, maxX, minZ, maxZ } = arena.area;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  // Chão do parque com textura de gramado; borda ampla para o horizonte não "acabar" na planta.
  const larguraChao = maxX - minX + 1800;
  const alturaChao = maxZ - minZ + 1800;
  const chaoGeo = new THREE.PlaneGeometry(larguraChao, alturaChao);
  const uvChao = chaoGeo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uvChao.count; i++) uvChao.setXY(i, (uvChao.getX(i) * larguraChao) / 4, (uvChao.getY(i) * alturaChao) / 4);
  const chao = new THREE.Mesh(chaoGeo, m.ruido(PALETA.parque, { variacao: 0.16, metrosPorTile: 60 }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.set(cx, -0.02, cz);
  chao.receiveShadow = alta;
  base.add(chao);

  for (const z of arena.zonas.filter((z) => z.tipo === "arena" || z.tipo === "agua")) {
    const agua = z.tipo === "agua";
    const mat = agua ? m.solido(0x7f989c, { rugosidade: 0.18, metal: 0.2 }) : m.ruido(PALETA.gramado, { variacao: 0.12, metrosPorTile: 40 });
    const mesh = new THREE.Mesh(planoDoPoligono(z.poligono, agua ? 0.012 : 0.008), mat);
    mesh.receiveShadow = alta;
    base.add(mesh);
    if (agua) {
      // Margem úmida escura ao redor do lago.
      const borda = [...z.poligono, z.poligono[0]];
      base.add(new THREE.Mesh(fita(borda, 3.5, 0.01), m.solido(0x6f7f6c, { rugosidade: 1 })));
    }
  }

  // Vias: calçada e asfalto unidos por material (duas malhas para todas as vias).
  const calcadas: THREE.BufferGeometry[] = [];
  const asfaltos: THREE.BufferGeometry[] = [];
  const tracos: THREE.Matrix4[] = [];
  const postes: THREE.Matrix4[] = [];
  const eixoY = new THREE.Vector3(0, 1, 0);
  arena.vias.forEach((via, i) => {
    const y = 0.03 + i * 0.006;
    calcadas.push(fita(via.eixo, via.largura + 6, y - 0.012));
    asfaltos.push(fita(via.eixo, via.largura, y));
    const total = comprimento(via.eixo);
    if (via.largura >= 12 && via.largura < 30) {
      const pistas = [-via.largura / 4, via.largura / 4];
      for (let d = 8; d < total - 8; d += 11) {
        const { ponto, angulo } = pontoNaDistancia(via.eixo, d);
        for (const off of pistas) {
          tracos.push(new THREE.Matrix4().compose(new THREE.Vector3(ponto[0] - Math.sin(angulo) * off, y + 0.008, ponto[1] + Math.cos(angulo) * off), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -angulo, "YXZ")), new THREE.Vector3(1, 1, 1)));
        }
      }
    }
    if (via.largura >= 14) {
      for (let d = 15; d < total - 5; d += 38) {
        const { ponto, angulo } = pontoNaDistancia(via.eixo, d);
        for (const lado of [-1, 1]) {
          const off = lado * (via.largura / 2 + 2.2);
          postes.push(new THREE.Matrix4().compose(new THREE.Vector3(ponto[0] - Math.sin(angulo) * off, 0, ponto[1] + Math.cos(angulo) * off), new THREE.Quaternion().setFromAxisAngle(eixoY, -angulo + (lado < 0 ? Math.PI : 0)), new THREE.Vector3(1, 1, 1)));
        }
      }
    }
  });
  const calcadaMesh = juntar(calcadas, m.ruido(PALETA.calcada, { variacao: 0.1, metrosPorTile: 16 }), alta);
  const asfaltoMesh = juntar(asfaltos, m.ruido(PALETA.asfalto, { variacao: 0.14, metrosPorTile: 20, rugosidade: 0.92 }), alta);
  if (calcadaMesh) base.add(calcadaMesh);
  if (asfaltoMesh) base.add(asfaltoMesh);
  const tracosMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 0.16), m.solido(PALETA.faixa, { rugosidade: 1 }), tracos.length);
  tracos.forEach((mt, i) => tracosMesh.setMatrixAt(i, mt));
  base.add(tracosMesh);

  // Postes de iluminação: escala humana ao longo das avenidas.
  const posteGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.14, 9, 6).translate(0, 4.5, 0).toNonIndexed(),
    new THREE.BoxGeometry(1.6, 0.08, 0.12).translate(0.75, 9, 0).toNonIndexed(),
    new THREE.BoxGeometry(0.5, 0.12, 0.28).translate(1.5, 8.94, 0).toNonIndexed(),
  ])!;
  const postesMesh = new THREE.InstancedMesh(posteGeo, m.solido(0x5d5f61, { rugosidade: 0.6, metal: 0.5 }), postes.length);
  postes.forEach((mt, i) => postesMesh.setMatrixAt(i, mt));
  postesMesh.castShadow = alta;
  base.add(postesMesh);

  const avenida = arena.vias[0];
  if (avenida) base.add(rotuloNaVia(m, avenida.nome.toUpperCase(), avenida.eixo, comprimento(avenida.eixo) * 0.28, 70));

  // Obelisco: praça em leque voltada para a avenida, eixo monumental e o fuste de 72 m.
  if (arena.marco) {
    const [ox, oz] = arena.marco.posicao;
    const pedra = m.ruido(PALETA.pedra, { variacao: 0.08, metrosPorTile: 12, rugosidade: 0.85 });
    const praca = new THREE.Mesh(new THREE.CircleGeometry(arena.marco.raioPraca, alta ? 64 : 28, -Math.PI, Math.PI), m.ruido(PALETA.praca, { variacao: 0.08, metrosPorTile: 10 }));
    praca.rotation.x = -Math.PI / 2;
    praca.position.set(ox, 0.05, oz);
    const anel = new THREE.Mesh(new THREE.RingGeometry(arena.marco.raioPraca, arena.marco.raioPraca + 7, alta ? 64 : 28, 1, -Math.PI, Math.PI), m.solido(0x7a7474, { rugosidade: 0.95 }));
    anel.rotation.x = -Math.PI / 2;
    anel.position.set(ox, 0.06, oz);
    const eixoMonumental = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 72), m.solido(PALETA.praca, { rugosidade: 1 }));
    eixoMonumental.position.set(ox, 0.05, oz + 36);
    const plinto = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 16), pedra);
    plinto.position.set(ox, 0.8, oz);
    const fuste = new THREE.Mesh(gradienteVertical(new THREE.CylinderGeometry(1.1, 4.8, arena.marco.altura, 4), 0.82, 1.04), m.comVertices(PALETA.pedra, 0.8));
    fuste.rotation.y = Math.PI / 4;
    fuste.position.set(ox, 1.6 + arena.marco.altura / 2, oz);
    for (const o of [praca, anel, eixoMonumental]) o.receiveShadow = alta;
    for (const o of [plinto, fuste]) {
      o.castShadow = alta;
      o.receiveShadow = alta;
    }
    base.add(praca, anel, eixoMonumental, plinto, fuste);
  }

  // Edificações do entorno: volume com base mais escura e laje clara; uma malha só.
  const predios: THREE.BufferGeometry[] = [];
  for (const e of arena.edificacoes) {
    let geo: THREE.BufferGeometry;
    if ("centro" in e) {
      geo = new THREE.SphereGeometry(e.raio, alta ? 32 : 16, alta ? 12 : 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
      geo.scale(1, e.altura / e.raio, 1);
      geo.translate(e.centro[0], 0, e.centro[1]);
    } else {
      const forma = new THREE.Shape(e.poligono.map(([x, z]) => new THREE.Vector2(x, z)));
      geo = new THREE.ExtrudeGeometry(forma, { depth: e.altura, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, e.altura, 0);
      geo.deleteAttribute("uv");
      geo = geo.index ? geo.toNonIndexed() : geo;
    }
    if (geo.getAttribute("uv")) geo.deleteAttribute("uv");
    predios.push(gradienteVertical(geo, 0.74, 1.02));
  }
  const prediosMesh = juntar(predios, m.comVertices(PALETA.predio, 0.95), alta);
  if (prediosMesh) {
    prediosMesh.castShadow = alta;
    base.add(prediosMesh);
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
  const arvores: Array<{ x: number; z: number; s: number; alta: boolean }> = [];
  const alvo = alta ? 1900 : 620;
  for (let t = 0; arvores.length < alvo && t < alvo * 8; t++) {
    // Agrupamentos: sorteia um centro e espalha ao redor, como bosques reais.
    const x0 = minX - 140 + rnd() * (maxX - minX + 280);
    const z0 = minZ - 140 + rnd() * (maxZ - minZ + 280);
    const grupo = 1 + Math.floor(rnd() * 5);
    for (let k = 0; k < grupo && arvores.length < alvo; k++) {
      const x = x0 + (rnd() - 0.5) * 18;
      const z = z0 + (rnd() - 0.5) * 18;
      if (dentroPoligono(x, z, arenaPoligono) && rnd() > 0.1) continue;
      if (!livre(x, z)) continue;
      arvores.push({ x, z, s: 2.8 + rnd() * 3.8, alta: rnd() < 0.22 });
    }
  }
  const detalhe = alta ? 1 : 0;
  const troncoGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 5);
  troncoGeo.translate(0, 0.5, 0);
  const troncos = new THREE.InstancedMesh(troncoGeo, m.solido(PALETA.tronco, { rugosidade: 1 }), arvores.length);
  const folhosas = arvores.filter((a) => !a.alta);
  const altas = arvores.filter((a) => a.alta);
  const copasF = new THREE.InstancedMesh(copaFolhosa(detalhe), m.comVertices(0xffffff), folhosas.length);
  const copasA = new THREE.InstancedMesh(copaAlta(detalhe), m.comVertices(0xffffff), altas.length);
  const cor = new THREE.Color();
  const q = new THREE.Quaternion();
  arvores.forEach((a, i) => {
    const h = a.s * (a.alta ? 1.4 : 0.8);
    troncos.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(a.x, 0, a.z), q.identity(), new THREE.Vector3(1, h, 1)));
  });
  const pintar = (lista: typeof arvores, mesh: THREE.InstancedMesh, tom: number) =>
    lista.forEach((a, i) => {
      const h = a.s * (a.alta ? 1.4 : 0.8);
      q.setFromAxisAngle(eixoY, rnd() * Math.PI * 2);
      mesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(a.x, h + a.s * (a.alta ? 1.1 : 0.62), a.z), q, new THREE.Vector3(a.s, a.s * 0.9, a.s)));
      mesh.setColorAt(i, cor.setHex(tom).offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.1));
    });
  pintar(folhosas, copasF, PALETA.copa);
  pintar(altas, copasA, 0x5f6f52);
  for (const mesh of [copasF, copasA, troncos]) {
    mesh.castShadow = alta;
    mesh.computeBoundingSphere();
  }
  base.add(troncos, copasF, copasA);

  // Camada "Áreas": currais coloridos por pelotão e áreas de apoio com contorno tracejado.
  const zonas = new THREE.Group();
  zonas.name = "zonas";
  for (const c of arena.currais) {
    const pad = new THREE.Mesh(fita(c.eixo, c.largura, 0.09), m.solido(new THREE.Color(c.cor).getHex(), { rugosidade: 0.95, opacidade: 0.9 }));
    pad.renderOrder = 1;
    zonas.add(pad);
    const borda = [...poligonoFaixa(c.eixo, c.largura), poligonoFaixa(c.eixo, c.largura)[0]].map(([x, z]) => new THREE.Vector3(x, 0.16, z));
    zonas.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(borda), new THREE.LineBasicMaterial({ color: 0x2a1418, transparent: true, opacity: 0.35 })));
  }
  for (const z of arena.zonas.filter((z) => z.tipo === "apoio" || z.tipo === "restrita" || z.tipo === "atletas")) {
    const mat = z.tipo === "restrita" ? m.hachura("#c8997f", "#e9ded2") : m.solido(new THREE.Color(ZONA_VISUAL[z.tipo].cor).getHex(), { rugosidade: 1, opacidade: 0.75 });
    zonas.add(new THREE.Mesh(planoDoPoligono(z.poligono, 0.05), mat));
    const contorno = [...z.poligono, z.poligono[0]].map(([x, zz]) => new THREE.Vector3(x, 0.14, zz));
    const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(contorno), new THREE.LineDashedMaterial({ color: z.tipo === "restrita" ? 0xa8400f : 0x5f5758, dashSize: 2.5, gapSize: 1.8 }));
    linha.computeLineDistances();
    zonas.add(linha);
  }
  return { base, zonas };
}
