ALTER TABLE "arena_posicoes" ADD COLUMN "rotacao" double precision;--> statement-breakpoint
CREATE TABLE "arenas" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"evento_id" text,
	"nome" text NOT NULL,
	"base" jsonb NOT NULL,
	"planta_mime" text,
	"planta_imagem" "bytea",
	"criado_por_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arenas" ADD CONSTRAINT "arenas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arenas" ADD CONSTRAINT "arenas_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arenas_slug_idx" ON "arenas" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "arenas_evento_idx" ON "arenas" USING btree ("evento_id");