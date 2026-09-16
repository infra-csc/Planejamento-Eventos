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
export const OS_GATILHOS = [
  "ATA_FECHADA",
  "RESPOSTA_SOLICITACAO",
  "CORRECAO_RESPOSTA",
  "AJUSTE_LOGISTICA",
  "ATUALIZACAO_PROJETO",
  "REABERTURA",
  "ENCERRAMENTO",
] as const;
