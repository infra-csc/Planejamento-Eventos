import type { Arena, ItemAta, PontoArena, Vec2 } from "./tipos";

/** Comprimento de uma polilinha em metros. */
export function comprimento(eixo: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < eixo.length; i++) total += Math.hypot(eixo[i][0] - eixo[i - 1][0], eixo[i][1] - eixo[i - 1][1]);
  return total;
}

/** Ponto e direção (radianos no plano xz, 0 = +x) a uma distância do início da polilinha. */
export function pontoNaDistancia(eixo: Vec2[], distancia: number): { ponto: Vec2; angulo: number } {
  if (eixo.length < 2) return { ponto: eixo[0] ?? [0, 0], angulo: 0 };
  let resto = Math.max(0, distancia);
  for (let i = 1; i < eixo.length; i++) {
    const [ax, az] = eixo[i - 1];
    const [bx, bz] = eixo[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (resto <= seg || i === eixo.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, resto / seg);
      return { ponto: [ax + (bx - ax) * t, az + (bz - az) * t], angulo: Math.atan2(bz - az, bx - ax) };
    }
    resto -= seg;
  }
  return { ponto: eixo[eixo.length - 1], angulo: 0 };
}

/** Amostras igualmente espaçadas ao longo da polilinha (inclui início e fim). */
export function amostrar(eixo: Vec2[], quantidade: number): Array<{ ponto: Vec2; angulo: number }> {
  const total = comprimento(eixo);
  if (quantidade <= 1) return [pontoNaDistancia(eixo, 0)];
  return Array.from({ length: quantidade }, (_, i) => pontoNaDistancia(eixo, (total * i) / (quantidade - 1)));
}

/** Polígono de uma faixa de largura constante em torno de uma polilinha (currais, corredores). */
export function poligonoFaixa(eixo: Vec2[], largura: number): Vec2[] {
  const esquerda: Vec2[] = [];
  const direita: Vec2[] = [];
  const meia = largura / 2;
  eixo.forEach(([x, z], i) => {
    const [ax, az] = eixo[Math.max(0, i - 1)];
    const [bx, bz] = eixo[Math.min(eixo.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    esquerda.push([x + nx * meia, z + nz * meia]);
    direita.push([x - nx * meia, z - nz * meia]);
  });
  return [...esquerda, ...direita.reverse()];
}

export function comprimentoPercurso(arena: Arena): number {
  return arena.percurso.trechos.reduce((a, t) => a + comprimento(t.eixo), 0);
}

/** Retângulo que envolve percurso, currais e pontos, com margem. Usado pela câmera inicial. */
export function limitesArena(arena: Arena, margem = 40): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const pts: Vec2[] = [...arena.percurso.trechos.flatMap((t) => t.eixo), ...arena.currais.flatMap((c) => c.eixo), ...arena.pontos.map((p) => p.posicao)];
  if (arena.marco) pts.push(arena.marco.posicao);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { minX: Math.min(...xs) - margem, maxX: Math.max(...xs) + margem, minZ: Math.min(...zs) - margem, maxZ: Math.max(...zs) + margem };
}

/** Linhas da ata que não aparecem em nenhum ponto do mapa (para não esconder nada do usuário). */
export function itensNaoPosicionados(arena: Arena): ItemAta[] {
  const usados = new Set(arena.pontos.flatMap((p) => p.itensAta.map((i) => `${i.secao}|${i.item}`)));
  return arena.ata.filter((i) => !usados.has(`${i.secao}|${i.item}`));
}

/** Busca por nome, tipo, número da legenda ou item da ata, sem acento e sem caixa. */
export function buscarPontos(pontos: PontoArena[], termo: string): PontoArena[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const t = norm(termo.trim());
  if (!t) return pontos;
  return pontos.filter((p) => norm(`${p.nome} ${p.tipo} ${p.legenda ?? ""} ${p.itensAta.map((i) => i.item).join(" ")}`).includes(t));
}
