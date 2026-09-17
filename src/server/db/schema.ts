import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

import {
  ANEXO_TIPOS,
  EVENTO_ITEM_ORIGENS,
  EVENTO_ITEM_TIPOS,
  EVENTO_STATUS,
  ITEM_OPERACOES,
  ITEM_STATUS,
  OS_GATILHOS,
  PERFIS,
  SETORES,
  SOLICITACAO_STATUS,
  SOLICITACAO_TIPOS,
} from "@/domain/constantes";

export { ANEXO_TIPOS, EVENTO_ITEM_ORIGENS, EVENTO_ITEM_TIPOS, EVENTO_STATUS, ITEM_OPERACOES, ITEM_STATUS, OS_GATILHOS, PERFIS, SETORES, SOLICITACAO_STATUS, SOLICITACAO_TIPOS };

export const perfilEnum = pgEnum("perfil", PERFIS);
export const setorEnum = pgEnum("setor", SETORES);
export const eventoStatusEnum = pgEnum("evento_status", EVENTO_STATUS);
export const solicitacaoTipoEnum = pgEnum("solicitacao_tipo", SOLICITACAO_TIPOS);
export const solicitacaoStatusEnum = pgEnum("solicitacao_status", SOLICITACAO_STATUS);
export const itemOperacaoEnum = pgEnum("item_operacao", ITEM_OPERACOES);
export const itemStatusEnum = pgEnum("item_status", ITEM_STATUS);
export const eventoItemTipoEnum = pgEnum("evento_item_tipo", EVENTO_ITEM_TIPOS);
export const eventoItemOrigemEnum = pgEnum("evento_item_origem", EVENTO_ITEM_ORIGENS);
export const anexoTipoEnum = pgEnum("anexo_tipo", ANEXO_TIPOS);
export const osGatilhoEnum = pgEnum("os_gatilho", OS_GATILHOS);

export type Perfil = (typeof PERFIS)[number];
export type Setor = (typeof SETORES)[number];
export type EventoStatus = (typeof EVENTO_STATUS)[number];
export type SolicitacaoTipo = (typeof SOLICITACAO_TIPOS)[number];
export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[number];
export type ItemOperacao = (typeof ITEM_OPERACOES)[number];
export type ItemStatus = (typeof ITEM_STATUS)[number];
export type EventoItemTipo = (typeof EVENTO_ITEM_TIPOS)[number];
export type EventoItemOrigem = (typeof EVENTO_ITEM_ORIGENS)[number];
export type AnexoTipo = (typeof ANEXO_TIPOS)[number];
export type OsGatilho = (typeof OS_GATILHOS)[number];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
});

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const criadoEm = () => timestamp("criado_em", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const atualizadoEm = () =>
  timestamp("atualizado_em", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------------ */
/* Cadastros                                                            */
/* ------------------------------------------------------------------ */

export const areas = pgTable("areas", {
  id: id(),
  nome: text("nome").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: id(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    senhaHash: text("senha_hash").notNull(),
    perfil: perfilEnum("perfil").notNull(),
    areaId: text("area_id").references(() => areas.id),
    ativo: boolean("ativo").notNull().default(true),
    ultimoAcessoEm: ts("ultimo_acesso_em"),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [uniqueIndex("usuarios_email_idx").on(sql`lower(${t.email})`)],
);

export const sessoes = pgTable(
  "sessoes",
  {
    id: id(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiraEm: ts("expira_em").notNull(),
    userAgent: text("user_agent"),
    criadoEm: criadoEm(),
  },
  (t) => [index("sessoes_usuario_idx").on(t.usuarioId)],
);

export const tokensRecuperacao = pgTable("tokens_recuperacao", {
  id: id(),
  usuarioId: text("usuario_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiraEm: ts("expira_em").notNull(),
  usadoEm: ts("usado_em"),
  criadoEm: criadoEm(),
});

/**
 * Tentativas de login e de recuperação de senha, para limitar força bruta por e-mail e por IP.
 * Fica no banco (não em memória) para valer entre instâncias do deployment Autoscale.
 */
export const tentativasAcesso = pgTable(
  "tentativas_acesso",
  {
    id: id(),
    chave: text("chave").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("tentativas_acesso_chave_idx").on(t.chave, t.criadoEm)],
);

export const pecas = pgTable("pecas", {
  id: id(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  setor: setorEnum("setor").notNull(),
  familia: text("familia").notNull().default(""),
  unidade: text("unidade").notNull().default("un"),
  descricao: text("descricao"),
  estoqueProprio: integer("estoque_proprio").notNull().default(0),
  permiteEmProjeto: boolean("permite_em_projeto").notNull().default(true),
  ativo: boolean("ativo").notNull().default(true),
  criadoPorId: text("criado_por_id").references(() => usuarios.id),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const projetos = pgTable("projetos", {
  id: id(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  categoria: text("categoria").notNull().default(""),
  descricao: text("descricao"),
  versaoAtual: integer("versao_atual").notNull().default(1),
  ativo: boolean("ativo").notNull().default(true),
  criadoPorId: text("criado_por_id").references(() => usuarios.id),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const projetoVersoes = pgTable(
  "projeto_versoes",
  {
    id: id(),
    projetoId: text("projeto_id")
      .notNull()
      .references(() => projetos.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    observacao: text("observacao"),
    criadoPorId: text("criado_por_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("projeto_versoes_numero_idx").on(t.projetoId, t.numero)],
);

export const projetoItens = pgTable(
  "projeto_itens",
  {
    id: id(),
    versaoId: text("versao_id")
      .notNull()
      .references(() => projetoVersoes.id, { onDelete: "cascade" }),
    pecaId: text("peca_id")
      .notNull()
      .references(() => pecas.id),
    quantidade: integer("quantidade").notNull(),
  },
  (t) => [index("projeto_itens_versao_idx").on(t.versaoId), check("projeto_itens_quantidade_chk", sql`${t.quantidade} > 0`)],
);

export const anexos = pgTable(
  "anexos",
  {
    id: id(),
    projetoId: text("projeto_id")
      .notNull()
      .references(() => projetos.id, { onDelete: "cascade" }),
    tipo: anexoTipoEnum("tipo").notNull(),
    nomeArquivo: text("nome_arquivo").notNull(),
    mime: text("mime").notNull(),
    tamanho: integer("tamanho").notNull(),
    conteudo: bytea("conteudo").notNull(),
    criadoPorId: text("criado_por_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("anexos_projeto_idx").on(t.projetoId)],
);

/* ------------------------------------------------------------------ */
/* Eventos                                                              */
/* ------------------------------------------------------------------ */

export const eventos = pgTable(
  "eventos",
  {
    id: id(),
    codigo: text("codigo").notNull().unique(),
    nome: text("nome").notNull(),
    cliente: text("cliente").notNull().default(""),
    local: text("local").notNull().default(""),
    dataMontagem: date("data_montagem", { mode: "string" }).notNull(),
    dataInicio: date("data_inicio", { mode: "string" }).notNull(),
    dataFim: date("data_fim", { mode: "string" }).notNull(),
    dataDesmontagem: date("data_desmontagem", { mode: "string" }).notNull(),
    dataReuniao: ts("data_reuniao").notNull(),
    dataCarga: date("data_carga", { mode: "string" }),
    /** Até quando alterações pós-ata entram no fluxo normal; depois disso ainda entram, mas marcadas "fora da janela". */
    janelaAlteracoesAte: date("janela_alteracoes_ate", { mode: "string" }),
    responsavelId: text("responsavel_id")
      .notNull()
      .references(() => usuarios.id),
    status: eventoStatusEnum("status").notNull().default("PREPARACAO"),
    observacoesReuniao: text("observacoes_reuniao"),
    /** Dados da reunião de OS (campos da ata): quando começou, quem estava e a logística de carga. */
    reuniaoIniciadaEm: ts("reuniao_iniciada_em"),
    reuniaoPresentes: text("reuniao_presentes"),
    publicoEsperado: integer("publico_esperado"),
    caminhaoCarrega: text("caminhao_carrega"),
    caminhaoSai: text("caminhao_sai"),
    arenaDescarrega: text("arena_descarrega"),
    kitDescarrega: text("kit_descarrega"),
    ataFechadaEm: ts("ata_fechada_em"),
    ataFechadaPorId: text("ata_fechada_por_id").references(() => usuarios.id),
    encerradoEm: ts("encerrado_em"),
    encerradoPorId: text("encerrado_por_id").references(() => usuarios.id),
    reabertoVezes: integer("reaberto_vezes").notNull().default(0),
    canceladoEm: ts("cancelado_em"),
    canceladoPorId: text("cancelado_por_id").references(() => usuarios.id),
    canceladoMotivo: text("cancelado_motivo"),
    criadoPorId: text("criado_por_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("eventos_status_idx").on(t.status), index("eventos_data_inicio_idx").on(t.dataInicio), index("eventos_periodo_idx").on(t.dataMontagem, t.dataDesmontagem)],
);

export const solicitacoes = pgTable(
  "solicitacoes",
  {
    id: id(),
    codigo: text("codigo").notNull().unique(),
    eventoId: text("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    areaId: text("area_id")
      .notNull()
      .references(() => areas.id),
    tipo: solicitacaoTipoEnum("tipo").notNull(),
    status: solicitacaoStatusEnum("status").notNull().default("RASCUNHO"),
    titulo: text("titulo"),
    observacao: text("observacao"),
    criadoPorId: text("criado_por_id")
      .notNull()
      .references(() => usuarios.id),
    atualizadoPorId: text("atualizado_por_id").references(() => usuarios.id),
    enviadaEm: ts("enviada_em"),
    prazoRespostaEm: ts("prazo_resposta_em"),
    respondidaEm: ts("respondida_em"),
    devolvidaMotivo: text("devolvida_motivo"),
    canceladaEm: ts("cancelada_em"),
    canceladaMotivo: text("cancelada_motivo"),
    excluida: boolean("excluida").notNull().default(false),
    /** Alteração enviada depois da janela definida pela logística: entra, mas com destaque para decisão. */
    foraDaJanela: boolean("fora_da_janela").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("solicitacoes_evento_idx").on(t.eventoId),
    index("solicitacoes_area_idx").on(t.areaId),
    index("solicitacoes_status_idx").on(t.status),
    // Lista padrão (mais recentes) e verificação de prazo a cada 5 minutos.
    index("solicitacoes_atualizado_idx").on(t.atualizadoEm).where(sql`not ${t.excluida}`),
    index("solicitacoes_prazo_abertas_idx").on(t.prazoRespostaEm).where(sql`${t.status} in ('ENVIADA', 'EM_ANALISE') and not ${t.excluida}`),
  ],
);

export const eventoItens = pgTable(
  "evento_itens",
  {
    id: id(),
    eventoId: text("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    tipo: eventoItemTipoEnum("tipo").notNull(),
    projetoId: text("projeto_id").references(() => projetos.id),
    projetoVersaoId: text("projeto_versao_id").references(() => projetoVersoes.id),
    bomSnapshot: jsonb("bom_snapshot").$type<BomSnapshotLinha[]>(),
    pecaId: text("peca_id").references(() => pecas.id),
    descricaoLivre: text("descricao_livre"),
    quantidade: integer("quantidade").notNull(),
    destino: text("destino"),
    areaId: text("area_id").references(() => areas.id),
    origem: eventoItemOrigemEnum("origem").notNull(),
    solicitacaoItemId: text("solicitacao_item_id").references((): AnyPgColumn => solicitacaoItens.id, { onDelete: "set null" }),
    justificativaAjuste: text("justificativa_ajuste"),
    /** Conferida na reunião de OS: a ata só fecha com todas as linhas conferidas. */
    conferidoEm: ts("conferido_em"),
    conferidoPorId: text("conferido_por_id").references(() => usuarios.id),
    ativo: boolean("ativo").notNull().default(true),
    removidoEm: ts("removido_em"),
    removidoPorId: text("removido_por_id").references(() => usuarios.id),
    criadoPorId: text("criado_por_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("evento_itens_evento_idx").on(t.eventoId),
    // Uma resposta gera no máximo uma linha: barra duplicata mesmo se duas respostas escaparem da trava.
    uniqueIndex("evento_itens_solicitacao_item_idx").on(t.solicitacaoItemId).where(sql`${t.solicitacaoItemId} is not null`),
    // Uso de projetos (biblioteca, versões defasadas).
    index("evento_itens_projeto_ativo_idx").on(t.projetoId).where(sql`${t.ativo}`),
    check("evento_itens_quantidade_chk", sql`${t.quantidade} >= 0`),
  ],
);

export const solicitacaoItens = pgTable(
  "solicitacao_itens",
  {
    id: id(),
    solicitacaoId: text("solicitacao_id")
      .notNull()
      .references(() => solicitacoes.id, { onDelete: "cascade" }),
    ordem: integer("ordem").notNull().default(0),
    operacao: itemOperacaoEnum("operacao").notNull().default("ADICIONAR"),
    eventoItemId: text("evento_item_id").references(() => eventoItens.id),
    projetoId: text("projeto_id").references(() => projetos.id),
    projetoVersaoId: text("projeto_versao_id").references(() => projetoVersoes.id),
    pecaId: text("peca_id").references(() => pecas.id),
    descricaoLivre: text("descricao_livre"),
    quantidadeSolicitada: integer("quantidade_solicitada").notNull(),
    destino: text("destino"),
    /** Ajustes nas peças do projeto pedido: unidades a mais (ou a menos) por peça, em cima da lista padrão. */
    ajustesBom: jsonb("ajustes_bom").$type<AjusteBom[]>(),
    justificativa: text("justificativa"),
    status: itemStatusEnum("status").notNull().default("EM_ANALISE"),
    quantidadeAtendida: integer("quantidade_atendida"),
    quantidadeAnterior: integer("quantidade_anterior"),
    observacaoLogistica: text("observacao_logistica"),
    pendenciaCompra: boolean("pendencia_compra").notNull().default(false),
    respondidoPorId: text("respondido_por_id").references(() => usuarios.id),
    respondidoEm: ts("respondido_em"),
    eventoItemGeradoId: text("evento_item_gerado_id").references((): AnyPgColumn => eventoItens.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("solicitacao_itens_solicitacao_idx").on(t.solicitacaoId),
    index("solicitacao_itens_evento_item_idx").on(t.eventoItemId),
    index("solicitacao_itens_pendencia_idx").on(t.respondidoEm).where(sql`${t.pendenciaCompra}`),
    check("solicitacao_itens_quantidade_chk", sql`${t.quantidadeSolicitada} >= 0`),
  ],
);

export const ataVersoes = pgTable(
  "ata_versoes",
  {
    id: id(),
    eventoId: text("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    conteudo: jsonb("conteudo").$type<AtaConteudo>().notNull(),
    fechadaPorId: text("fechada_por_id").references(() => usuarios.id),
    fechadaEm: criadoEm(),
  },
  (t) => [uniqueIndex("ata_versoes_numero_idx").on(t.eventoId, t.numero)],
);

export const osVersoes = pgTable(
  "os_versoes",
  {
    id: id(),
    eventoId: text("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    gatilho: osGatilhoEnum("gatilho").notNull(),
    descricao: text("descricao"),
    /** O que mudou em relação à versão anterior, calculado na geração (lista de versões sem carregar o JSON). */
    resumo: text("resumo"),
    conteudo: jsonb("conteudo").$type<OsConteudo>().notNull(),
    geradaPorId: text("gerada_por_id").references(() => usuarios.id),
    geradaEm: criadoEm(),
  },
  (t) => [uniqueIndex("os_versoes_numero_idx").on(t.eventoId, t.numero)],
);

/* ------------------------------------------------------------------ */
/* Suporte                                                              */
/* ------------------------------------------------------------------ */

/**
 * Posições editadas na Arena 3D, aplicadas por cima da planta importada.
 * MOVER: ponto que já existe foi arrastado (chave = id do ponto).
 * NOVO: item sem posição na planta/ata ganhou um lugar no mapa.
 */
export const arenaPosicoes = pgTable(
  "arena_posicoes",
  {
    id: id(),
    arenaSlug: text("arena_slug").notNull(),
    chave: text("chave").notNull(),
    tipo: text("tipo").$type<"MOVER" | "NOVO">().notNull(),
    nome: text("nome"),
    categoria: text("categoria"),
    rotuloTipo: text("rotulo_tipo"),
    /** Linha da ata materializada pelo ponto novo ("SEÇÃO|item"), quando veio da ata. */
    itemAta: text("item_ata"),
    x: doublePrecision("x").notNull(),
    z: doublePrecision("z").notNull(),
    atualizadoPorId: text("atualizado_por_id").references(() => usuarios.id),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("arena_posicoes_chave_idx").on(t.arenaSlug, t.chave)],
);

export const historico = pgTable(
  "historico",
  {
    id: id(),
    // Auditoria não some junto com o evento.
    eventoId: text("evento_id").references(() => eventos.id, { onDelete: "set null" }),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id").notNull(),
    acao: text("acao").notNull(),
    descricao: text("descricao").notNull(),
    dadosAntes: jsonb("dados_antes"),
    dadosDepois: jsonb("dados_depois"),
    usuarioId: text("usuario_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("historico_evento_idx").on(t.eventoId, t.criadoEm), index("historico_entidade_idx").on(t.entidade, t.entidadeId)],
);

export const notificacoes = pgTable(
  "notificacoes",
  {
    id: id(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    mensagem: text("mensagem").notNull(),
    link: text("link"),
    lidaEm: ts("lida_em"),
    chaveDedupe: text("chave_dedupe"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("notificacoes_usuario_idx").on(t.usuarioId, t.lidaEm),
    index("notificacoes_usuario_criado_idx").on(t.usuarioId, t.criadoEm),
    uniqueIndex("notificacoes_dedupe_idx").on(t.usuarioId, t.chaveDedupe),
  ],
);

export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull(),
  atualizadoEm: atualizadoEm(),
});

export const sequencias = pgTable("sequencias", {
  nome: text("nome").primaryKey(),
  valor: integer("valor").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* Tipos JSON                                                           */
/* ------------------------------------------------------------------ */

/** Delta por peça aplicado à lista padrão do projeto numa solicitação. */
export type AjusteBom = { pecaId: string; codigo: string; nome: string; quantidade: number };

export type BomSnapshotLinha = {
  pecaId: string;
  codigo: string;
  nome: string;
  setor: Setor;
  unidade: string;
  quantidade: number;
};

export type AtaReuniao = {
  iniciadaEm: string | null;
  fechadaEm: string;
  fechadaPor: string | null;
  conduzidaPor: string;
  presentes: string | null;
  publicoEsperado: number | null;
  caminhaoCarrega: string | null;
  caminhaoSai: string | null;
  arenaDescarrega: string | null;
  kitDescarrega: string | null;
};

export type AtaConteudo = {
  observacoes: string | null;
  /** Ausente em atas fechadas antes destes campos. */
  reuniao?: AtaReuniao;
  linhas: Array<{
    id: string;
    conferidoPor?: string | null;
    tipo: EventoItemTipo;
    descricao: string;
    codigo: string | null;
    versao: number | null;
    quantidade: number;
    destino: string | null;
    area: string | null;
    origem: EventoItemOrigem;
  }>;
  solicitacoesPreReuniao: Array<{
    codigo: string;
    area: string;
    itens: Array<{ descricao: string; solicitada: number; atendida: number; status: ItemStatus; observacao: string | null }>;
  }>;
};

export type OsLinha = {
  pecaId: string;
  codigo: string;
  nome: string;
  unidade: string;
  total: number;
  origens: Array<{ descricao: string; quantidade: number }>;
};

export type OsSetor = {
  setor: Setor;
  linhas: OsLinha[];
  avulsos: Array<{ descricao: string; quantidade: number; destino: string | null; area: string | null }>;
};

/** Projeto padrão na OS: quantas unidades e o que cada unidade leva (lista já com os ajustes da área). */
export type OsProjeto = {
  codigo: string;
  nome: string;
  versao: number;
  quantidade: number;
  destino: string | null;
  area: string | null;
  pecas: Array<{ codigo: string; nome: string; setor: Setor; unidade: string; porUnidade: number; total: number }>;
};

export type OsConteudo = {
  setores: OsSetor[];
  semSetor: Array<{ descricao: string; quantidade: number; destino: string | null; area: string | null }>;
  /** Visão "por projeto" (ausente em OS geradas antes desta versão). */
  projetos?: OsProjeto[];
  /** Peças pedidas soltas, fora de projeto (ausente em OS antigas). */
  individuais?: Array<{ codigo: string; nome: string; setor: Setor; unidade: string; quantidade: number; destino: string | null; area: string | null }>;
};

/* ------------------------------------------------------------------ */
/* Relations                                                            */
/* ------------------------------------------------------------------ */

export const areasRelations = relations(areas, ({ many }) => ({
  usuarios: many(usuarios),
}));

export const usuariosRelations = relations(usuarios, ({ one }) => ({
  area: one(areas, { fields: [usuarios.areaId], references: [areas.id] }),
}));

export const pecasRelations = relations(pecas, ({ many }) => ({
  projetoItens: many(projetoItens),
}));

export const projetosRelations = relations(projetos, ({ many, one }) => ({
  versoes: many(projetoVersoes),
  anexos: many(anexos),
  criadoPor: one(usuarios, { fields: [projetos.criadoPorId], references: [usuarios.id] }),
}));

export const projetoVersoesRelations = relations(projetoVersoes, ({ one, many }) => ({
  projeto: one(projetos, { fields: [projetoVersoes.projetoId], references: [projetos.id] }),
  itens: many(projetoItens),
  criadoPor: one(usuarios, { fields: [projetoVersoes.criadoPorId], references: [usuarios.id] }),
}));

export const projetoItensRelations = relations(projetoItens, ({ one }) => ({
  versao: one(projetoVersoes, { fields: [projetoItens.versaoId], references: [projetoVersoes.id] }),
  peca: one(pecas, { fields: [projetoItens.pecaId], references: [pecas.id] }),
}));

export const anexosRelations = relations(anexos, ({ one }) => ({
  projeto: one(projetos, { fields: [anexos.projetoId], references: [projetos.id] }),
}));

export const eventosRelations = relations(eventos, ({ one, many }) => ({
  responsavel: one(usuarios, { fields: [eventos.responsavelId], references: [usuarios.id] }),
  itens: many(eventoItens),
  solicitacoes: many(solicitacoes),
  osVersoes: many(osVersoes),
  ataVersoes: many(ataVersoes),
}));

export const eventoItensRelations = relations(eventoItens, ({ one }) => ({
  evento: one(eventos, { fields: [eventoItens.eventoId], references: [eventos.id] }),
  projeto: one(projetos, { fields: [eventoItens.projetoId], references: [projetos.id] }),
  projetoVersao: one(projetoVersoes, { fields: [eventoItens.projetoVersaoId], references: [projetoVersoes.id] }),
  peca: one(pecas, { fields: [eventoItens.pecaId], references: [pecas.id] }),
  area: one(areas, { fields: [eventoItens.areaId], references: [areas.id] }),
}));

export const solicitacoesRelations = relations(solicitacoes, ({ one, many }) => ({
  evento: one(eventos, { fields: [solicitacoes.eventoId], references: [eventos.id] }),
  area: one(areas, { fields: [solicitacoes.areaId], references: [areas.id] }),
  criadoPor: one(usuarios, { fields: [solicitacoes.criadoPorId], references: [usuarios.id] }),
  itens: many(solicitacaoItens),
}));

export const solicitacaoItensRelations = relations(solicitacaoItens, ({ one }) => ({
  solicitacao: one(solicitacoes, { fields: [solicitacaoItens.solicitacaoId], references: [solicitacoes.id] }),
  projeto: one(projetos, { fields: [solicitacaoItens.projetoId], references: [projetos.id] }),
  projetoVersao: one(projetoVersoes, { fields: [solicitacaoItens.projetoVersaoId], references: [projetoVersoes.id] }),
  peca: one(pecas, { fields: [solicitacaoItens.pecaId], references: [pecas.id] }),
  eventoItem: one(eventoItens, { fields: [solicitacaoItens.eventoItemId], references: [eventoItens.id] }),
  respondidoPor: one(usuarios, { fields: [solicitacaoItens.respondidoPorId], references: [usuarios.id] }),
}));

export const osVersoesRelations = relations(osVersoes, ({ one }) => ({
  evento: one(eventos, { fields: [osVersoes.eventoId], references: [eventos.id] }),
  geradaPor: one(usuarios, { fields: [osVersoes.geradaPorId], references: [usuarios.id] }),
}));

export const ataVersoesRelations = relations(ataVersoes, ({ one }) => ({
  evento: one(eventos, { fields: [ataVersoes.eventoId], references: [eventos.id] }),
  fechadaPor: one(usuarios, { fields: [ataVersoes.fechadaPorId], references: [usuarios.id] }),
}));

export const historicoRelations = relations(historico, ({ one }) => ({
  usuario: one(usuarios, { fields: [historico.usuarioId], references: [usuarios.id] }),
}));

export const notificacoesRelations = relations(notificacoes, ({ one }) => ({
  usuario: one(usuarios, { fields: [notificacoes.usuarioId], references: [usuarios.id] }),
}));
