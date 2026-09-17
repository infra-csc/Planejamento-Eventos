CREATE TABLE "arena_posicoes" (
	"id" text PRIMARY KEY NOT NULL,
	"arena_slug" text NOT NULL,
	"chave" text NOT NULL,
	"tipo" text NOT NULL,
	"nome" text,
	"categoria" text,
	"rotulo_tipo" text,
	"item_ata" text,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"atualizado_por_id" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arena_posicoes" ADD CONSTRAINT "arena_posicoes_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_posicoes_chave_idx" ON "arena_posicoes" USING btree ("arena_slug","chave");