/**
 * Regras da logística que dependem do que está na ata (observações das reuniões de OS):
 * - tina de 1000 l: 2 por stand + 6 por palco show;
 * - pallet de ferro: 2 por stand + 6 por palco show;
 * - saco de ráfia: 1 por lixeira ultra bag;
 * - acompanhantes que sempre vão junto: 2 cavaletes de ferro por cocho, 2 cavaletes de madeira por
 *   pranchão e por mesa de medalha, 2 pés por grade 2×1;
 * - grades 2×1 do prisma: 2 por prisma, somadas às grades pedidas (as do prisma não levam pés);
 * - testeira de madeira: com tenda na ata, entra "a definir" (quantidade 0) e o número é definido na conferência.
 * (a lona de teto já vem na lista de peças de cada stand e palco show)
 * O que a área já pediu da mesma peça à parte é descontado. A linha da regra acompanha a ata sozinha
 * até a ata fechar; se a logística ajustar à mão, fica como ela deixou.
 */
/** `aDefinir`: a regra só põe a linha na ata com quantidade 0; quem define o número é a conferência. */
export type RegraKit = { regra: string; codigoPeca: string; descricao: string; aDefinir?: boolean };

export const REGRAS_KIT: readonly RegraKit[] = [
  { regra: "tina-contrapeso", codigoPeca: "TINA-1000", descricao: "2 por stand + 6 por palco show" },
  { regra: "pallet-ferro", codigoPeca: "PALLET-FE", descricao: "2 por stand + 6 por palco show" },
  { regra: "saco-rafia", codigoPeca: "SACO-RAFIA", descricao: "1 por lixeira ultra bag" },
  { regra: "cavalete-cocho", codigoPeca: "CAV-COCHO", descricao: "1 cocho = 2 cavaletes de ferro p/ cocho (cocho para água e posto de hidratação)" },
  { regra: "cavalete-reto", codigoPeca: "CAV-RETO", descricao: "1 pranchão de madeira ou mesa de medalha = 2 cavaletes retos" },
  { regra: "grade-prisma", codigoPeca: "GRADE-2X1", descricao: "1 prisma = 2 grades 2×1 (além das grades pedidas)" },
  { regra: "pe-grade-2x1", codigoPeca: "PE-GRADE-2X1", descricao: "1 grade 2×1 = 2 pés (as grades do prisma não levam pés)" },
  { regra: "testeira-tenda-5x5", codigoPeca: "TND5-TESTEIRA", descricao: "tenda 5×5 na ata: testeira a definir na conferência", aDefinir: true },
  { regra: "testeira-tenda-3x3", codigoPeca: "MRC-TESTEIRADEMADEIRADE3M", descricao: "tenda 3×3 na ata: testeira a definir na conferência", aDefinir: true },
];

/** Cantoneira de cada tamanho de tenda: com ela na ata, a testeira daquele tamanho entra a definir. */
const TESTEIRA_POR_TENDA: Record<string, string> = { "testeira-tenda-5x5": "TND5-CANT", "testeira-tenda-3x3": "TND3-CANT" };

/** Peça que sempre vai junto de outra (base → acompanhante × fator). Também usada na tela da solicitação. */
export const ACOMPANHANTES: ReadonlyArray<{ bases: string[]; acompanhante: string; fator: number; texto: string }> = [
  { bases: ["COCHO", "POSTO-HIDRATACAO"], acompanhante: "CAV-COCHO", fator: 2, texto: "1 cocho = 2 cavaletes de ferro p/ cocho" },
  { bases: ["PRANCHÃO-220", "MESA-1X1"], acompanhante: "CAV-RETO", fator: 2, texto: "1 pranchão ou mesa de medalha = 2 cavaletes retos" },
  { bases: ["GRADE-2X1"], acompanhante: "PE-GRADE-2X1", fator: 2, texto: "1 grade 2×1 = 2 pés" },
];

export const CODIGO_ULTRABAG = "LIXEIRA-BAG";
export const CODIGO_PRISMA = "PRISMA";

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
export function calcularRegrasKit(linhas: readonly LinhaParaRegra[]): Array<RegraKit & { quantidade: number; presente?: boolean }> {
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
  // Grades do prisma somam às pedidas (não descontam) e vão presas no prisma: não levam pés.
  const gradesPrisma = total(CODIGO_PRISMA) * 2;
  // O que já foi pedido da mesma peça (ex.: cavaletes que vieram na solicitação) conta para a regra.
  return REGRAS_KIT.map((r) =>
    r.aDefinir
      ? // Testeira: só a presença (tem tenda e a área não pediu a testeira à parte); o número fica para a conferência.
        { ...r, quantidade: 0, presente: total(TESTEIRA_POR_TENDA[r.regra]) > 0 && total(r.codigoPeca) === 0 }
      : { ...r, quantidade: r.regra === "grade-prisma" ? gradesPrisma : Math.max(0, (precisa[r.regra] ?? 0) - total(r.codigoPeca)) },
  );
}

export const descricaoDaRegra = (regra: string | null | undefined) => (regra ? (REGRAS_KIT.find((r) => r.regra === regra)?.descricao ?? null) : null);
