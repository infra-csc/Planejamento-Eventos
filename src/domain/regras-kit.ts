/**
 * Regras da logística que dependem do que está na ata (observações das reuniões de OS):
 * - saco de ráfia: 1 por lixeira ultra bag;
 * - acompanhantes que sempre vão junto: 2 cavaletes de ferro por cocho, 2 cavaletes de madeira por
 *   pranchão e por mesa de medalha, 2 pés por grade 2×1;
 * - grades 2×1 do prisma: 2 por prisma, somadas às grades pedidas (as do prisma não levam pés);
 * - testeira de madeira: com tenda na ata, entra "a definir" (quantidade 0) e o número é definido na conferência.
 * (a lona de teto já vem na lista de peças de cada stand e palco show; a tina de 1000 l e o pallet de ferro
 * deixaram de ser regra em 20/10 e passam a vir dentro dos projetos)
 * O que a área já pediu da mesma peça à parte é descontado. A linha da regra acompanha a ata sozinha
 * até a ata fechar; se a logística ajustar à mão, fica como ela deixou.
 */
/** `aDefinir`: a regra só põe a linha na ata com quantidade 0; quem define o número é a conferência. */
export type RegraKit = { regra: string; codigoPeca: string; descricao: string; aDefinir?: boolean };

export const REGRAS_KIT: readonly RegraKit[] = [
  { regra: "saco-rafia", codigoPeca: "SACO-RAFIA", descricao: "1 por lixeira ultra bag" },
  { regra: "cavalete-cocho", codigoPeca: "CAV-COCHO", descricao: "1 cocho = 2 cavaletes de ferro p/ cocho (cocho para água e posto de hidratação)" },
  { regra: "cavalete-reto", codigoPeca: "CAV-RETO", descricao: "1 pranchão de madeira ou mesa de medalha = 2 cavaletes retos" },
  { regra: "grade-prisma", codigoPeca: "GRADE-2X1", descricao: "1 prisma = 2 grades 2×1 (além das grades pedidas)" },
  { regra: "pe-grade-2x1", codigoPeca: "PE-GRADE-2X1", descricao: "1 grade 2×1 = 2 pés (as grades do prisma não levam pés)" },
  { regra: "testeira-tenda-5x5", codigoPeca: "TND5-TESTEIRA", descricao: "tenda 5×5 na ata: testeira a definir na conferência", aDefinir: true },
  { regra: "testeira-tenda-3x3", codigoPeca: "MRC-TESTEIRADEMADEIRADE3M", descricao: "tenda 3×3 na ata: testeira a definir na conferência", aDefinir: true },
];

/**
 * Pé de cada tamanho de tenda: com ele na ata, a testeira daquele tamanho entra a definir. (Era a cantoneira, que
 * desde 26/10 é a mesma nos dois tamanhos.)
 */
const TESTEIRA_POR_TENDA: Record<string, { pe: string; tamanho: string }> = {
  "testeira-tenda-5x5": { pe: "TND5-PE", tamanho: "5" },
  "testeira-tenda-3x3": { pe: "TND3-PE", tamanho: "3" },
};

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

/** Unidades de uma peça numa linha: peça solta, ou dentro da lista do projeto × quantidade. */
const unidades = (l: LinhaParaRegra, codigo: string) =>
  l.tipo === "PROJETO" ? (l.bom ?? []).filter((b) => b.codigo === codigo).reduce((a, b) => a + b.quantidade, 0) * l.quantidade : l.tipo === "PECA" && l.pecaCodigo === codigo ? l.quantidade : 0;

/** Quantas unidades cada regra pede, a partir das linhas ativas da ata (sem as linhas das próprias regras). */
export function calcularRegrasKit(linhas: readonly LinhaParaRegra[]): Array<RegraKit & { quantidade: number; presente?: boolean }> {
  const ativas = linhas.filter((l) => l.quantidade > 0);
  const total = (codigo: string) => ativas.reduce((a, l) => a + unidades(l, codigo), 0);
  const precisa: Record<string, number> = { "saco-rafia": total(CODIGO_ULTRABAG) };
  for (const a of ACOMPANHANTES) {
    const r = REGRAS_KIT.find((x) => x.codigoPeca === a.acompanhante)!;
    precisa[r.regra] = a.bases.reduce((s, b) => s + total(b), 0) * a.fator;
  }
  // Testeira já pedida como projeto ("Testeira Madeira Tenda 5×5"): a regra não põe outra a definir.
  const temProjetoTesteira = (t: string) => ativas.some((l) => l.tipo === "PROJETO" && l.projeto && /testeira/i.test(l.projeto.nome) && new RegExp(`${t}\\s*[x×]\\s*${t}`, "i").test(l.projeto.nome));
  // Grades do prisma somam às pedidas (não descontam) e vão presas no prisma: não levam pés.
  const gradesPrisma = total(CODIGO_PRISMA) * 2;
  // O que já foi pedido da mesma peça (ex.: cavaletes que vieram na solicitação) conta para a regra.
  return REGRAS_KIT.map((r) =>
    r.aDefinir
      ? // Testeira: só a presença (tem tenda e a área não pediu a testeira à parte); o número fica para a conferência.
        { ...r, quantidade: 0, presente: total(TESTEIRA_POR_TENDA[r.regra].pe) > 0 && total(r.codigoPeca) === 0 && !temProjetoTesteira(TESTEIRA_POR_TENDA[r.regra].tamanho) }
      : { ...r, quantidade: r.regra === "grade-prisma" ? gradesPrisma : Math.max(0, (precisa[r.regra] ?? 0) - total(r.codigoPeca)) },
  );
}

/** O que vem junto de outra peça: quanto a regra pede (pelas peças de origem) e quanto a ata tem hoje. */
export type NecessidadeAcompanhante = { codigo: string; precisa: number; naAta: number; texto: string; bases: string[] };

/**
 * Para a conferência mostrar "a regra pede 6 · na ata 9": as origens contam só as linhas que não são de regra
 * (as grades do prisma não levam pés), e o que está na ata conta todas, inclusive dentro dos projetos.
 */
export function necessidadesAcompanhantes(linhas: ReadonlyArray<LinhaParaRegra & { regra?: string | null }>): NecessidadeAcompanhante[] {
  const ativas = linhas.filter((l) => l.quantidade > 0);
  const total = (ls: typeof ativas, codigo: string) => ls.reduce((a, l) => a + unidades(l, codigo), 0);
  const pedidas = ativas.filter((l) => !l.regra);
  return ACOMPANHANTES.map((a) => ({ codigo: a.acompanhante, precisa: a.bases.reduce((s, b) => s + total(pedidas, b), 0) * a.fator, naAta: total(ativas, a.acompanhante), texto: a.texto, bases: [...a.bases] })).filter((n) => n.precisa > 0 || n.naAta > 0);
}

/**
 * Tina de 1000 l e pallet de ferro pela regra antiga (2 por stand + 6 por palco show), descontado o que as
 * linhas já levam (a versão nova dos stands e palcos traz os dois na lista de peças). Serve só para diminuir
 * as linhas antigas da regra quando o projeto passa a trazer o contrapeso: não cria nem aumenta linha.
 */
export function contrapesoDaRegraAntiga(linhas: readonly LinhaParaRegra[]): Record<"tina-contrapeso" | "pallet-ferro", number> {
  const ativas = linhas.filter((l) => l.quantidade > 0);
  const total = (codigo: string) => ativas.reduce((a, l) => a + unidades(l, codigo), 0);
  let pede = 0;
  for (const l of ativas) {
    if (l.tipo !== "PROJETO" || !l.projeto) continue;
    if (["estande", "stand"].includes((l.projeto.categoria ?? "").toLocaleLowerCase("pt-BR"))) pede += 2 * l.quantidade;
    if (/^palco show/i.test(l.projeto.nome.trim())) pede += 6 * l.quantidade;
  }
  return { "tina-contrapeso": Math.max(0, pede - total("TINA-1000")), "pallet-ferro": Math.max(0, pede - total("PALLET-FE")) };
}

/** Regras que saíram: as linhas que já estão nas atas ficam como estão (a regra não mexe mais nelas). */
const REGRAS_RETIRADAS: Record<string, string> = {
  "tina-contrapeso": "regra antiga (2 por stand + 6 por palco show); a tina agora vem dentro dos projetos",
  "pallet-ferro": "regra antiga (2 por stand + 6 por palco show); o pallet agora vem dentro dos projetos",
};

export const descricaoDaRegra = (regra: string | null | undefined) => (regra ? (REGRAS_KIT.find((r) => r.regra === regra)?.descricao ?? REGRAS_RETIRADAS[regra] ?? null) : null);
