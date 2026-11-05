CREATE TABLE "almoxarifados" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"endereco" text,
	"area_id" text,
	"principal" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "almoxarifados_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "coberturas_previstas" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"peca_id" text NOT NULL,
	"almoxarifado_id" text NOT NULL,
	"quantidade" integer NOT NULL,
	"locador_id" text,
	"data_entrada" date NOT NULL,
	"data_devolucao" date,
	"evento_id" text,
	"observacao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coberturas_previstas_quantidade_chk" CHECK ("coberturas_previstas"."quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "contagem_linhas" (
	"id" text PRIMARY KEY NOT NULL,
	"contagem_id" text NOT NULL,
	"peca_id" text NOT NULL,
	"locador_id" text,
	"contado" integer NOT NULL,
	"anterior" integer NOT NULL,
	CONSTRAINT "contagem_linhas_contado_chk" CHECK ("contagem_linhas"."contado" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contagens" (
	"id" text PRIMARY KEY NOT NULL,
	"almoxarifado_id" text NOT NULL,
	"data_contagem" date NOT NULL,
	"responsavel_id" text NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_pai" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_pai_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "locadores" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"contato" text,
	"cnpj" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locadores_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "movimentacao_linhas" (
	"id" text PRIMARY KEY NOT NULL,
	"movimentacao_id" text NOT NULL,
	"peca_id" text NOT NULL,
	"quantidade" integer NOT NULL,
	"locador_id" text,
	"condicao" text DEFAULT 'OK' NOT NULL,
	"serial" text,
	CONSTRAINT "movimentacao_linhas_quantidade_chk" CHECK ("movimentacao_linhas"."quantidade" <> 0)
);
--> statement-breakpoint
CREATE TABLE "movimentacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"tipo" text NOT NULL,
	"almoxarifado_id" text NOT NULL,
	"contagem_id" text,
	"data_movimento" date NOT NULL,
	"justificativa" text,
	"usuario_id" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimentacoes_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "perfis_veiculo" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"nome" text NOT NULL,
	"comprimento_m" double precision NOT NULL,
	"largura_m" double precision NOT NULL,
	"altura_m" double precision NOT NULL,
	"redutor_pct" integer DEFAULT 15 NOT NULL,
	"referencia" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perfis_veiculo_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "tours" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tours_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "evento_itens" ADD COLUMN "atende_por" text;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD COLUMN "almoxarifado_id" text;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD COLUMN "montador" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "saida_prevista" date;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "retorno_previsto" date;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "evento_pai_id" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "tour_id" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "tour_ordem" integer;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "estrutura" text DEFAULT 'PROPRIA' NOT NULL;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "fornecedor_estrutura" text;--> statement-breakpoint
ALTER TABLE "pecas" ADD COLUMN "tipo_item" text;--> statement-breakpoint
ALTER TABLE "pecas" ADD COLUMN "volume_m3" double precision;--> statement-breakpoint
ALTER TABLE "pecas" ADD COLUMN "codigo_barras" text;--> statement-breakpoint
ALTER TABLE "pecas" ADD COLUMN "apelidos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pecas" ADD COLUMN "estoque_minimo" integer;--> statement-breakpoint
ALTER TABLE "almoxarifados" ADD CONSTRAINT "almoxarifados_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coberturas_previstas" ADD CONSTRAINT "coberturas_previstas_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coberturas_previstas" ADD CONSTRAINT "coberturas_previstas_almoxarifado_id_almoxarifados_id_fk" FOREIGN KEY ("almoxarifado_id") REFERENCES "public"."almoxarifados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coberturas_previstas" ADD CONSTRAINT "coberturas_previstas_locador_id_locadores_id_fk" FOREIGN KEY ("locador_id") REFERENCES "public"."locadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coberturas_previstas" ADD CONSTRAINT "coberturas_previstas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coberturas_previstas" ADD CONSTRAINT "coberturas_previstas_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contagem_linhas" ADD CONSTRAINT "contagem_linhas_contagem_id_contagens_id_fk" FOREIGN KEY ("contagem_id") REFERENCES "public"."contagens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contagem_linhas" ADD CONSTRAINT "contagem_linhas_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contagem_linhas" ADD CONSTRAINT "contagem_linhas_locador_id_locadores_id_fk" FOREIGN KEY ("locador_id") REFERENCES "public"."locadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contagens" ADD CONSTRAINT "contagens_almoxarifado_id_almoxarifados_id_fk" FOREIGN KEY ("almoxarifado_id") REFERENCES "public"."almoxarifados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contagens" ADD CONSTRAINT "contagens_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacao_linhas" ADD CONSTRAINT "movimentacao_linhas_movimentacao_id_movimentacoes_id_fk" FOREIGN KEY ("movimentacao_id") REFERENCES "public"."movimentacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacao_linhas" ADD CONSTRAINT "movimentacao_linhas_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacao_linhas" ADD CONSTRAINT "movimentacao_linhas_locador_id_locadores_id_fk" FOREIGN KEY ("locador_id") REFERENCES "public"."locadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_almoxarifado_id_almoxarifados_id_fk" FOREIGN KEY ("almoxarifado_id") REFERENCES "public"."almoxarifados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_contagem_id_contagens_id_fk" FOREIGN KEY ("contagem_id") REFERENCES "public"."contagens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "almoxarifados_principal_idx" ON "almoxarifados" USING btree ("principal") WHERE "almoxarifados"."principal";--> statement-breakpoint
CREATE INDEX "coberturas_previstas_peca_idx" ON "coberturas_previstas" USING btree ("peca_id","ativo");--> statement-breakpoint
CREATE INDEX "contagem_linhas_contagem_idx" ON "contagem_linhas" USING btree ("contagem_id");--> statement-breakpoint
CREATE INDEX "contagem_linhas_peca_idx" ON "contagem_linhas" USING btree ("peca_id");--> statement-breakpoint
CREATE INDEX "contagens_almoxarifado_idx" ON "contagens" USING btree ("almoxarifado_id","data_contagem");--> statement-breakpoint
CREATE INDEX "movimentacao_linhas_mov_idx" ON "movimentacao_linhas" USING btree ("movimentacao_id");--> statement-breakpoint
CREATE INDEX "movimentacao_linhas_peca_idx" ON "movimentacao_linhas" USING btree ("peca_id");--> statement-breakpoint
CREATE INDEX "movimentacoes_almoxarifado_idx" ON "movimentacoes" USING btree ("almoxarifado_id","data_movimento");--> statement-breakpoint
CREATE UNIQUE INDEX "perfis_veiculo_referencia_idx" ON "perfis_veiculo" USING btree ("tipo") WHERE "perfis_veiculo"."referencia";--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_almoxarifado_id_almoxarifados_id_fk" FOREIGN KEY ("almoxarifado_id") REFERENCES "public"."almoxarifados"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_evento_pai_id_eventos_pai_id_fk" FOREIGN KEY ("evento_pai_id") REFERENCES "public"."eventos_pai"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE set null ON UPDATE no action;