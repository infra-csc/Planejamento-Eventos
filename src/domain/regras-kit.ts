/**
 * Regras da logística que dependem do que está na ata (observações das reuniões de OS):
 * - tina de 500 l (contrapeso): 2 por estande + 6 por palco show;
 * - pallet de ferro: 2 por estande;
 * - saco de ráfia: 1 por lixeira ultra bag.
 * A linha da regra acompanha a ata sozinha até a ata fechar; se a logística ajustar à mão, fica como ela deixou.
 */
export type RegraKit = { regra: string; codigoPeca: string; descricao: string };

export const REGRAS_KIT: readonly RegraKit[] = [
  { regra: "tina-contrapeso", codigoPeca: "TINA-500", descricao: "2 por estande + 6 por palco show" },
  { regra: "pallet-ferro", codigoPeca: "PALLET-FE", descricao: "2 por estande" },
  { regra: "saco-rafia", codigoPeca: "SACO-RAFIA", descricao: "1 por lixeira ultra bag" },
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

const ehEstande = (p: { nome: string; categoria?: string | null }) => (p.categoria ?? "").toLocaleLowerCase("pt-BR") === "estande";
const ehPalcoShow = (p: { nome: string }) => /^palco show/i.test(p.nome.trim());

/** Quantas unidades cada regra pede, a partir das linhas ativas da ata (sem as linhas das próprias regras). */
export function calcularRegrasKit(linhas: readonly LinhaParaRegra[]): Array<RegraKit & { quantidade: number }> {
  let estandes = 0;
  let palcosShow = 0;
  let ultrabags = 0;
  for (const l of linhas) {
    if (l.quantidade <= 0) continue;
    if (l.tipo === "PROJETO" && l.projeto) {
      if (ehEstande(l.projeto)) estandes += l.quantidade;
      if (ehPalcoShow(l.projeto)) palcosShow += l.quantidade;
      ultrabags += (l.bom ?? []).filter((b) => b.codigo === CODIGO_ULTRABAG).reduce((a, b) => a + b.quantidade, 0) * l.quantidade;
    } else if (l.tipo === "PECA" && l.pecaCodigo === CODIGO_ULTRABAG) {
      ultrabags += l.quantidade;
    }
  }
  const qtd: Record<string, number> = {
    "tina-contrapeso": estandes * 2 + palcosShow * 6,
    "pallet-ferro": estandes * 2,
    "saco-rafia": ultrabags,
  };
  return REGRAS_KIT.map((r) => ({ ...r, quantidade: qtd[r.regra] ?? 0 }));
}

export const descricaoDaRegra = (regra: string | null | undefined) => (regra ? (REGRAS_KIT.find((r) => r.regra === regra)?.descricao ?? null) : null);
