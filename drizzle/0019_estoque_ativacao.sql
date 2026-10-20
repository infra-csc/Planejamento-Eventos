CREATE TABLE "estoque_itens" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" text DEFAULT 'Ativação' NOT NULL,
	"quantidade" integer DEFAULT 0 NOT NULL,
	"comprar" integer,
	"observacao" text,
	"peca_id" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por_id" text,
	"atualizado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_itens_quantidade_chk" CHECK ("estoque_itens"."quantidade" >= 0)
);--> statement-breakpoint
ALTER TABLE "estoque_itens" ADD CONSTRAINT "estoque_itens_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_itens" ADD CONSTRAINT "estoque_itens_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_itens" ADD CONSTRAINT "estoque_itens_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estoque_itens_peca_idx" ON "estoque_itens" USING btree ("peca_id");
