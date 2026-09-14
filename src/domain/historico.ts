/**
 * Classifica registros de histórico para a linha de atividade do evento
 * (marcadores do handoff §5.5: marco, resposta, solicitação, ajuste).
 */
export type TipoHistorico = "marco" | "resposta" | "solicitacao" | "ajuste";

export const COR_HISTORICO: Record<TipoHistorico, string> = {
  marco: "#2a1418",
  resposta: "#136c41",
  solicitacao: "#8e2740",
  ajuste: "#7a5f00",
};

export function classificarHistorico(h: { entidade: string; acao: string; descricao: string }): { tipo: TipoHistorico; titulo: string; detalhe: string } {
  let tipo: TipoHistorico = "marco";
  if (h.entidade === "solicitacao_item") tipo = "resposta";
  else if (h.entidade === "solicitacao") tipo = "solicitacao";
  else if (h.entidade === "evento_item") tipo = "ajuste";
  else if (h.entidade === "evento" && (h.acao === "REABRIR" || h.acao === "EDITADO")) tipo = "ajuste";
  const idx = h.descricao.indexOf(" — ");
  const titulo = (idx >= 0 ? h.descricao.slice(0, idx) : h.descricao).replace(/\.$/, "");
  const detalhe = idx >= 0 ? h.descricao.slice(idx + 3) : "";
  return { tipo, titulo, detalhe };
}
