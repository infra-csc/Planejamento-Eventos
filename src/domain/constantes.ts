/**
 * Listas de valores dos enums do banco, sem dependência do Drizzle.
 * Componentes de cliente importam daqui; `schema.ts` re-exporta para o servidor.
 * (Importar do schema em um client component arrasta o drizzle inteiro para o bundle.)
 */
export const PERFIS = ["REQUISITANTE", "CENOGRAFIA", "LOGISTICA", "GESTAO", "ADMIN"] as const;
export const SETORES = ["ESTRUTURA", "TENDA", "MARCENARIA", "ARENA"] as const;
export const EVENTO_STATUS = ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO", "CANCELADO"] as const;
export const SOLICITACAO_TIPOS = ["PRE_REUNIAO", "ALTERACAO"] as const;
export const SOLICITACAO_STATUS = ["RASCUNHO", "ENVIADA", "EM_ANALISE", "RESPONDIDA", "DEVOLVIDA", "CANCELADA"] as const;
export const ITEM_OPERACOES = ["ADICIONAR", "ALTERAR_QUANTIDADE", "REMOVER"] as const;
export const ITEM_STATUS = ["EM_ANALISE", "ATENDIDO", "PARCIAL", "NAO_ATENDIDO"] as const;
export const EVENTO_ITEM_TIPOS = ["PROJETO", "PECA", "AVULSO"] as const;
export const EVENTO_ITEM_ORIGENS = ["SOLICITACAO", "AJUSTE_LOGISTICA"] as const;
export const ANEXO_TIPOS = ["IMAGEM", "PDF"] as const;
/** Logística de materiais (briefing NorteLog v2): listas fixas no código, sem tela de configuração. */
export const TIPOS_ITEM = ["RETORNAVEL", "CONSUMIVEL"] as const;
export const ESTRUTURAS_EVENTO = ["PROPRIA", "TERCEIRIZADA", "A_DEFINIR"] as const;
export const ATENDE_POR = ["GALPAO_NORTE", "FORNECEDOR_EXTERNO", "LOCACAO_VIA_GALPAO", "COMPRA_CONSUMO"] as const;
/** A Fase 2 acrescenta os outros tipos; nesta fase o saldo só nasce de contagem. */
export const TIPOS_MOVIMENTACAO = ["SALDO_INICIAL", "AJUSTE_INVENTARIO"] as const;
export const TIPOS_COBERTURA = ["LOCACAO", "COMPRA"] as const;
export const OS_GATILHOS = [
  "ATA_FECHADA",
  "RESPOSTA_SOLICITACAO",
  "CORRECAO_RESPOSTA",
  "AJUSTE_LOGISTICA",
  "ATUALIZACAO_PROJETO",
  "REABERTURA",
  "ENCERRAMENTO",
] as const;

/**
 * Limites de texto dos formulários. Os schemas Zod (`lib/schemas.ts`) validam com eles e os campos
 * usam os mesmos valores em `maxLength` — um número só para tela e servidor.
 */
export const LIMITES = {
  /** Nome de evento, peça, projeto, usuário, arena. */
  nome: 120,
  codigoPeca: 30,
  unidade: 10,
  /** Família/categoria de peça e projeto. */
  categoria: 60,
  /** Descrição de item fora do catálogo e local do evento. */
  descricaoLivre: 160,
  destino: 60,
  /** Justificativa, motivo e observação curta. */
  justificativa: 500,
  observacoesReuniao: 10_000,
} as const;
