CREATE TABLE "estoque_anexos" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"reforma_id" text,
	"tipo" "anexo_tipo" NOT NULL,
	"nome_arquivo" text NOT NULL,
	"mime" text NOT NULL,
	"tamanho" integer NOT NULL,
	"conteudo" "bytea" NOT NULL,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estoque_reformas" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"evento_id" text,
	"quantidade" integer NOT NULL,
	"motivo" text,
	"local" text,
	"previsao" text,
	"status" text DEFAULT 'ABERTA' NOT NULL,
	"consertados" integer,
	"baixados" integer,
	"concluida_em" timestamp with time zone,
	"concluida_por_id" text,
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_reformas_quantidade_chk" CHECK ("estoque_reformas"."quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "estoque_retornos" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"evento_id" text NOT NULL,
	"levou" integer NOT NULL,
	"voltaram" integer NOT NULL,
	"reforma" integer DEFAULT 0 NOT NULL,
	"perdidos" integer DEFAULT 0 NOT NULL,
	"observacao" text,
	"reforma_id" text,
	"registrado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_retornos_quantidades_chk" CHECK ("estoque_retornos"."levou" >= 0 and "estoque_retornos"."voltaram" >= 0 and "estoque_retornos"."reforma" >= 0 and "estoque_retornos"."perdidos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "estoque_anexos" ADD CONSTRAINT "estoque_anexos_item_id_estoque_itens_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."estoque_itens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_anexos" ADD CONSTRAINT "estoque_anexos_reforma_id_estoque_reformas_id_fk" FOREIGN KEY ("reforma_id") REFERENCES "public"."estoque_reformas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_anexos" ADD CONSTRAINT "estoque_anexos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_reformas" ADD CONSTRAINT "estoque_reformas_item_id_estoque_itens_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."estoque_itens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_reformas" ADD CONSTRAINT "estoque_reformas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_reformas" ADD CONSTRAINT "estoque_reformas_concluida_por_id_usuarios_id_fk" FOREIGN KEY ("concluida_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_reformas" ADD CONSTRAINT "estoque_reformas_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_retornos" ADD CONSTRAINT "estoque_retornos_item_id_estoque_itens_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."estoque_itens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_retornos" ADD CONSTRAINT "estoque_retornos_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_retornos" ADD CONSTRAINT "estoque_retornos_reforma_id_estoque_reformas_id_fk" FOREIGN KEY ("reforma_id") REFERENCES "public"."estoque_reformas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_retornos" ADD CONSTRAINT "estoque_retornos_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estoque_anexos_item_tipo_criado_idx" ON "estoque_anexos" USING btree ("item_id","tipo","criado_em");--> statement-breakpoint
CREATE INDEX "estoque_anexos_reforma_idx" ON "estoque_anexos" USING btree ("reforma_id");--> statement-breakpoint
CREATE INDEX "estoque_reformas_item_idx" ON "estoque_reformas" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "estoque_reformas_status_idx" ON "estoque_reformas" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "estoque_retornos_item_evento_idx" ON "estoque_retornos" USING btree ("item_id","evento_id");--> statement-breakpoint
CREATE INDEX "estoque_retornos_evento_idx" ON "estoque_retornos" USING btree ("evento_id");