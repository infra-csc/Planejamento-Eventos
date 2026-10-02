/**
 * Regras da logística que dependem do que está na ata (observações das reuniões de OS):
 * - tina de 1000 l: 2 por stand + 6 por palco show;
 * - pallet de ferro: 2 por stand + 6 por palco show;
 * - saco de ráfia: 1 por lixeira ultra bag;
 * - acompanhantes que sempre vão junto: 2 cavaletes de ferro por cocho, 2 cavaletes de madeira por
 *   bancada e por mesa de medalha, 2 pés por grade 2×1.
 * (a lona de teto já vem na lista de peças de cada stand e palco show)
 * O que a área já pediu da mesma peça à parte é descontado. A linha da regra acompanha a ata sozinha
 * até a ata fechar; se a logística ajustar à mão, fica como ela deixou.
 */
export type RegraKit = { regra: string; codigoPeca: string; descricao: string };

export const REGRAS_KIT: readonly RegraKit[] = [
  { regra: "tina-contrapeso", codigoPeca: "TINA-1000", descricao: "2 por stand + 6 por palco show" },
  { regra: "pallet-ferro", codigoPeca: "PALLET-FE", descricao: "2 por stand + 6 por palco show" },
  { regra: "saco-rafia", codigoPeca: "SACO-RAFIA", descricao: "1 por lixeira ultra bag" },
  { regra: "cavalete-cocho", codigoPeca: "CAV-COCHO", descricao: "2 por cocho para água" },
  { regra: "cavalete-reto", codigoPeca: "CAV-RETO", descricao: "2 por bancada de madeira e por mesa de medalha" },
  { regra: "pe-grade-2x1", codigoPeca: "PE-GRADE-2X1", descricao: "2 por grade 2×1" },
];

/** Peça que sempre vai junto de outra (base → acompanhante × fator). Também usada na tela da solicitação. */
export const ACOMPANHANTES: ReadonlyArray<{ bases: string[]; acompanhante: string; fator: number; texto: string }> = [
  { bases: ["COCHO"], acompanhante: "CAV-COCHO", fator: 2, texto: "2 por cocho" },
  { bases: ["BANCADA-210", "MESA-1X1"], acompanhante: "CAV-RETO", fator: 2, texto: "2 por bancada e por mesa de medalha" },
  { bases: ["GRADE-2X1"], acompanhante: "PE-GRADE-2X1", fator: 2, texto: "2 por grade 2×1" },
];

export const CODIGO_ULTRABAG = "LIXEIRA-BAG";

export type LinhaParaRegra = {
  tipo: string;
  quantidade: number;
  projeto?: { nome: string; categoria?: string | null } | null;
  pecaCodigo?: string | null;
  /** Peças por unidade do projeto (snapshot da linha). */
  bom?: ReadonlyArray<{ codigo: string; quantidade: number }> | null;
};

const ehStand = (p: { nome: string; categoria?: string | null }) => ["estande", "stand"].includes((p.categoria ?? "").toLocaleLowerCase("pt-BR"));
const ehPalcoShow = (p: { nome: string }) => /^palco show/i.test(p.nome.trim());

/** Unidades de uma peça numa linha: peça solta, ou dentro da lista do projeto × quantidade. */
const unidades = (l: LinhaParaRegra, codigo: string) =>
  l.tipo === "PROJETO" ? (l.bom ?? []).filter((b) => b.codigo === codigo).reduce((a, b) => a + b.quantidade, 0) * l.quantidade : l.tipo === "PECA" && l.pecaCodigo === codigo ? l.quantidade : 0;

/** Quantas unidades cada regra pede, a partir das linhas ativas da ata (sem as linhas das próprias regras). */
export function calcularRegrasKit(linhas: readonly LinhaParaRegra[]): Array<RegraKit & { quantidade: number }> {
  const ativas = linhas.filter((l) => l.quantidade > 0);
  const total = (codigo: string) => ativas.reduce((a, l) => a + unidades(l, codigo), 0);
  let stands = 0;
  let palcosShow = 0;
  for (const l of ativas) {
    if (l.tipo !== "PROJETO" || !l.projeto) continue;
    if (ehStand(l.projeto)) stands += l.quantidade;
    if (ehPalcoShow(l.projeto)) palcosShow += l.quantidade;
  }
  const precisa: Record<string, number> = {
    "tina-contrapeso": stands * 2 + palcosShow * 6,
    "pallet-ferro": stands * 2 + palcosShow * 6,
    "saco-rafia": total(CODIGO_ULTRABAG),
  };
  for (const a of ACOMPANHANTES) {
    const r = REGRAS_KIT.find((x) => x.codigoPeca === a.acompanhante)!;
    precisa[r.regra] = a.bases.reduce((s, b) => s + total(b), 0) * a.fator;
  }
  // O que já foi pedido da mesma peça (ex.: cavaletes que vieram na solicitação) conta para a regra.
  return REGRAS_KIT.map((r) => ({ ...r, quantidade: Math.max(0, (precisa[r.regra] ?? 0) - total(r.codigoPeca)) }));
}

export const descricaoDaRegra = (regra: string | null | undefined) => (regra ? (REGRAS_KIT.find((r) => r.regra === regra)?.descricao ?? null) : null);
