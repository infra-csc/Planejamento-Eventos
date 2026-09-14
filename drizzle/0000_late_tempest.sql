CREATE TYPE "public"."anexo_tipo" AS ENUM('IMAGEM', 'PDF');--> statement-breakpoint
CREATE TYPE "public"."evento_item_origem" AS ENUM('SOLICITACAO', 'AJUSTE_LOGISTICA');--> statement-breakpoint
CREATE TYPE "public"."evento_item_tipo" AS ENUM('PROJETO', 'PECA', 'AVULSO');--> statement-breakpoint
CREATE TYPE "public"."evento_status" AS ENUM('PREPARACAO', 'EM_REUNIAO', 'ABERTO', 'ENCERRADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."item_operacao" AS ENUM('ADICIONAR', 'ALTERAR_QUANTIDADE', 'REMOVER');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('EM_ANALISE', 'ATENDIDO', 'PARCIAL', 'NAO_ATENDIDO');--> statement-breakpoint
CREATE TYPE "public"."os_gatilho" AS ENUM('ATA_FECHADA', 'RESPOSTA_SOLICITACAO', 'CORRECAO_RESPOSTA', 'AJUSTE_LOGISTICA', 'ATUALIZACAO_PROJETO', 'REABERTURA', 'ENCERRAMENTO');--> statement-breakpoint
CREATE TYPE "public"."perfil" AS ENUM('REQUISITANTE', 'CENOGRAFIA', 'LOGISTICA', 'GESTAO', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."setor" AS ENUM('ESTRUTURA', 'TENDA', 'MARCENARIA');--> statement-breakpoint
CREATE TYPE "public"."solicitacao_status" AS ENUM('RASCUNHO', 'ENVIADA', 'EM_ANALISE', 'RESPONDIDA', 'DEVOLVIDA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."solicitacao_tipo" AS ENUM('PRE_REUNIAO', 'ALTERACAO');--> statement-breakpoint
CREATE TABLE "anexos" (
	"id" text PRIMARY KEY NOT NULL,
	"projeto_id" text NOT NULL,
	"tipo" "anexo_tipo" NOT NULL,
	"nome_arquivo" text NOT NULL,
	"mime" text NOT NULL,
	"tamanho" integer NOT NULL,
	"conteudo" "bytea" NOT NULL,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "ata_versoes" (
	"id" text PRIMARY KEY NOT NULL,
	"evento_id" text NOT NULL,
	"numero" integer NOT NULL,
	"conteudo" jsonb NOT NULL,
	"fechada_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_itens" (
	"id" text PRIMARY KEY NOT NULL,
	"evento_id" text NOT NULL,
	"tipo" "evento_item_tipo" NOT NULL,
	"projeto_id" text,
	"projeto_versao_id" text,
	"bom_snapshot" jsonb,
	"peca_id" text,
	"descricao_livre" text,
	"quantidade" integer NOT NULL,
	"destino" text,
	"area_id" text,
	"origem" "evento_item_origem" NOT NULL,
	"solicitacao_item_id" text,
	"justificativa_ajuste" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"removido_em" timestamp with time zone,
	"removido_por_id" text,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"cliente" text DEFAULT '' NOT NULL,
	"local" text DEFAULT '' NOT NULL,
	"data_montagem" date NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"data_desmontagem" date NOT NULL,
	"data_reuniao" timestamp with time zone NOT NULL,
	"data_carga" date,
	"responsavel_id" text NOT NULL,
	"status" "evento_status" DEFAULT 'PREPARACAO' NOT NULL,
	"observacoes_reuniao" text,
	"ata_fechada_em" timestamp with time zone,
	"ata_fechada_por_id" text,
	"encerrado_em" timestamp with time zone,
	"encerrado_por_id" text,
	"reaberto_vezes" integer DEFAULT 0 NOT NULL,
	"cancelado_em" timestamp with time zone,
	"cancelado_por_id" text,
	"cancelado_motivo" text,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "historico" (
	"id" text PRIMARY KEY NOT NULL,
	"evento_id" text,
	"entidade" text NOT NULL,
	"entidade_id" text NOT NULL,
	"acao" text NOT NULL,
	"descricao" text NOT NULL,
	"dados_antes" jsonb,
	"dados_depois" jsonb,
	"usuario_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"link" text,
	"lida_em" timestamp with time zone,
	"chave_dedupe" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os_versoes" (
	"id" text PRIMARY KEY NOT NULL,
	"evento_id" text NOT NULL,
	"numero" integer NOT NULL,
	"gatilho" "os_gatilho" NOT NULL,
	"descricao" text,
	"conteudo" jsonb NOT NULL,
	"gerada_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pecas" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"setor" "setor" NOT NULL,
	"familia" text DEFAULT '' NOT NULL,
	"unidade" text DEFAULT 'un' NOT NULL,
	"descricao" text,
	"estoque_proprio" integer DEFAULT 0 NOT NULL,
	"permite_em_projeto" boolean DEFAULT true NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pecas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "projeto_itens" (
	"id" text PRIMARY KEY NOT NULL,
	"versao_id" text NOT NULL,
	"peca_id" text NOT NULL,
	"quantidade" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projeto_versoes" (
	"id" text PRIMARY KEY NOT NULL,
	"projeto_id" text NOT NULL,
	"numero" integer NOT NULL,
	"observacao" text,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projetos" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"categoria" text DEFAULT '' NOT NULL,
	"descricao" text,
	"versao_atual" integer DEFAULT 1 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projetos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "sequencias" (
	"nome" text PRIMARY KEY NOT NULL,
	"valor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"user_agent" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "solicitacao_itens" (
	"id" text PRIMARY KEY NOT NULL,
	"solicitacao_id" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"operacao" "item_operacao" DEFAULT 'ADICIONAR' NOT NULL,
	"evento_item_id" text,
	"projeto_id" text,
	"projeto_versao_id" text,
	"peca_id" text,
	"descricao_livre" text,
	"quantidade_solicitada" integer NOT NULL,
	"destino" text,
	"justificativa" text,
	"status" "item_status" DEFAULT 'EM_ANALISE' NOT NULL,
	"quantidade_atendida" integer,
	"quantidade_anterior" integer,
	"observacao_logistica" text,
	"pendencia_compra" boolean DEFAULT false NOT NULL,
	"respondido_por_id" text,
	"respondido_em" timestamp with time zone,
	"evento_item_gerado_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"evento_id" text NOT NULL,
	"area_id" text NOT NULL,
	"tipo" "solicitacao_tipo" NOT NULL,
	"status" "solicitacao_status" DEFAULT 'RASCUNHO' NOT NULL,
	"titulo" text,
	"observacao" text,
	"criado_por_id" text NOT NULL,
	"atualizado_por_id" text,
	"enviada_em" timestamp with time zone,
	"prazo_resposta_em" timestamp with time zone,
	"respondida_em" timestamp with time zone,
	"devolvida_motivo" text,
	"cancelada_em" timestamp with time zone,
	"cancelada_motivo" text,
	"excluida" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitacoes_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "tokens_recuperacao" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_recuperacao_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"perfil" "perfil" NOT NULL,
	"area_id" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata_versoes" ADD CONSTRAINT "ata_versoes_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata_versoes" ADD CONSTRAINT "ata_versoes_fechada_por_id_usuarios_id_fk" FOREIGN KEY ("fechada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_projeto_versao_id_projeto_versoes_id_fk" FOREIGN KEY ("projeto_versao_id") REFERENCES "public"."projeto_versoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_removido_por_id_usuarios_id_fk" FOREIGN KEY ("removido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_ata_fechada_por_id_usuarios_id_fk" FOREIGN KEY ("ata_fechada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_encerrado_por_id_usuarios_id_fk" FOREIGN KEY ("encerrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_cancelado_por_id_usuarios_id_fk" FOREIGN KEY ("cancelado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico" ADD CONSTRAINT "historico_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico" ADD CONSTRAINT "historico_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_versoes" ADD CONSTRAINT "os_versoes_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_versoes" ADD CONSTRAINT "os_versoes_gerada_por_id_usuarios_id_fk" FOREIGN KEY ("gerada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_itens" ADD CONSTRAINT "projeto_itens_versao_id_projeto_versoes_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."projeto_versoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_itens" ADD CONSTRAINT "projeto_itens_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_versoes" ADD CONSTRAINT "projeto_versoes_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_versoes" ADD CONSTRAINT "projeto_versoes_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_solicitacao_id_solicitacoes_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_evento_item_id_evento_itens_id_fk" FOREIGN KEY ("evento_item_id") REFERENCES "public"."evento_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_projeto_versao_id_projeto_versoes_id_fk" FOREIGN KEY ("projeto_versao_id") REFERENCES "public"."projeto_versoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_respondido_por_id_usuarios_id_fk" FOREIGN KEY ("respondido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens_recuperacao" ADD CONSTRAINT "tokens_recuperacao_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anexos_projeto_idx" ON "anexos" USING btree ("projeto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ata_versoes_numero_idx" ON "ata_versoes" USING btree ("evento_id","numero");--> statement-breakpoint
CREATE INDEX "evento_itens_evento_idx" ON "evento_itens" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "eventos_status_idx" ON "eventos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "eventos_data_inicio_idx" ON "eventos" USING btree ("data_inicio");--> statement-breakpoint
CREATE INDEX "historico_evento_idx" ON "historico" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "historico_entidade_idx" ON "historico" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "notificacoes_usuario_idx" ON "notificacoes" USING btree ("usuario_id","lida_em");--> statement-breakpoint
CREATE UNIQUE INDEX "notificacoes_dedupe_idx" ON "notificacoes" USING btree ("usuario_id","chave_dedupe");--> statement-breakpoint
CREATE UNIQUE INDEX "os_versoes_numero_idx" ON "os_versoes" USING btree ("evento_id","numero");--> statement-breakpoint
CREATE INDEX "projeto_itens_versao_idx" ON "projeto_itens" USING btree ("versao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projeto_versoes_numero_idx" ON "projeto_versoes" USING btree ("projeto_id","numero");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "solicitacao_itens_solicitacao_idx" ON "solicitacao_itens" USING btree ("solicitacao_id");--> statement-breakpoint
CREATE INDEX "solicitacoes_evento_idx" ON "solicitacoes" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "solicitacoes_area_idx" ON "solicitacoes" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "solicitacoes_status_idx" ON "solicitacoes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_idx" ON "usuarios" USING btree (lower("email"));