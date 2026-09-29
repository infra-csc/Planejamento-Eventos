/**
 * Itens que entram em toda ata como padrão, sem ninguém pedir: a logística só confere na reunião
 * (pode ajustar ou tirar como qualquer linha). Pela peça do catálogo (código) e quantidade.
 */
export const ITENS_PADRAO_ATA: ReadonlyArray<{ codigoPeca: string; quantidade: number }> = [{ codigoPeca: "GARFO", quantidade: 2 }];

const CODIGOS = new Set(ITENS_PADRAO_ATA.map((i) => i.codigoPeca));

/** Linha sem pedido de origem que é de uma peça padrão da ata. */
export const ehItemPadraoAta = (l: { tipo: string; codigo: string | null; temOrigem: boolean }) => !l.temOrigem && l.tipo === "PECA" && l.codigo !== null && CODIGOS.has(l.codigo);
