/**
 * A ata não tem mais itens padrão (garfo, estaca, corda, quadro de metalon e grade 2×1 deixaram de
 * entrar sozinhos em todo evento). Fica aqui só a regra de quais linhas não travam o fechamento.
 */

/** Estaiamento: a projetista define depois; não precisa estar conferido para fechar a ata. */
export const CODIGOS_CONFERENCIA_OPCIONAL: readonly string[] = ["ESTACA", "CORDA", "MALOTE", "GANCHO-MALOTE"];

/**
 * Linha que não trava o fechamento da ata: "a definir" (quantidade 0) ou estaiamento (estaca, corda,
 * malote). Pode ser conferida normalmente; só não é exigida.
 */
export const conferenciaOpcional = (l: { tipo: string; codigo: string | null | undefined; quantidade: number }) => l.quantidade === 0 || (l.tipo === "PECA" && !!l.codigo && CODIGOS_CONFERENCIA_OPCIONAL.includes(l.codigo));
