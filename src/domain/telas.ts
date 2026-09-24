/**
 * Telas desligadas por enquanto, a pedido da operação. Uma tela desligada some do menu, dos atalhos
 * do painel e responde "não encontrado"; o código fica para religar quando fizer sentido.
 */
export const TELAS_INATIVAS = {
  /** Demanda de peças (/consolidacao): dependia de estoque próprio, que o app não controla. */
  consolidacao: true,
  /** Pendências de compra (/pendencias) e a opção "gerar pendência" na resposta da solicitação. */
  pendencias: true,
} as const;
