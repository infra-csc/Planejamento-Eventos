/**
 * Itens que entram em toda ata como padrão, sem ninguém pedir: a logística só confere na reunião
 * (pode ajustar ou tirar como qualquer linha). Pela peça do catálogo (código) e quantidade.
 * Quantidade 0 = "a definir": a linha vem pré-preenchida, a ata fecha mesmo assim e o número entra
 * depois (estaiamento: a projetista). Enquanto for 0, não entra na OS.
 */
export const ITENS_PADRAO_ATA: ReadonlyArray<{ codigoPeca: string; quantidade: number }> = [
  { codigoPeca: "GARFO", quantidade: 2 },
  // Estaiamento: a projetista define a quantidade.
  { codigoPeca: "ESTACA", quantidade: 0 },
  { codigoPeca: "CORDA", quantidade: 0 },
  // Quadro de metalon e grades 2×1: entram "a definir" para conferir na reunião.
  { codigoPeca: "QUADRO-METAL", quantidade: 0 },
  { codigoPeca: "GRADE-2X1", quantidade: 0 },
];

const CODIGOS = new Set(ITENS_PADRAO_ATA.map((i) => i.codigoPeca));

/** Linha sem pedido de origem que é de uma peça padrão da ata. */
export const ehItemPadraoAta = (l: { tipo: string; codigo: string | null; temOrigem: boolean }) => !l.temOrigem && l.tipo === "PECA" && l.codigo !== null && CODIGOS.has(l.codigo);

/** Estaiamento: a projetista define depois; não precisa estar conferido para fechar a ata. */
export const CODIGOS_CONFERENCIA_OPCIONAL: readonly string[] = ["ESTACA", "CORDA", "MALOTE", "GANCHO-MALOTE"];

/**
 * Linha que não trava o fechamento da ata: "a definir" (quantidade 0) ou estaiamento (estaca, corda,
 * malote). Pode ser conferida normalmente; só não é exigida.
 */
export const conferenciaOpcional = (l: { tipo: string; codigo: string | null | undefined; quantidade: number }) => l.quantidade === 0 || (l.tipo === "PECA" && !!l.codigo && CODIGOS_CONFERENCIA_OPCIONAL.includes(l.codigo));
