ALTER TABLE "pecas" ADD COLUMN "grupo_id" text;
--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_grupo_id_projeto_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."projeto_grupos"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "peca_anexos" (
  "id" text PRIMARY KEY NOT NULL,
  "peca_id" text NOT NULL,
  "tipo" "anexo_tipo" NOT NULL,
  "nome_arquivo" text NOT NULL,
  "mime" text NOT NULL,
  "tamanho" integer NOT NULL,
  "conteudo" bytea NOT NULL,
  "criado_por_id" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peca_anexos" ADD CONSTRAINT "peca_anexos_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "peca_anexos" ADD CONSTRAINT "peca_anexos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "peca_anexos_peca_tipo_criado_idx" ON "peca_anexos" USING btree ("peca_id","tipo","criado_em");
