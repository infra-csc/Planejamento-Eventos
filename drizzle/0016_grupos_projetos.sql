CREATE TABLE "projeto_grupos" (
  "id" text PRIMARY KEY NOT NULL,
  "nome" text NOT NULL,
  "nome_normalizado" text NOT NULL,
  "criado_por_id" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projeto_grupos_nome_normalizado_unique" UNIQUE("nome_normalizado")
);
--> statement-breakpoint
ALTER TABLE "projeto_grupos" ADD CONSTRAINT "projeto_grupos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projetos" ADD COLUMN "grupo_id" text;
--> statement-breakpoint
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_grupo_id_projeto_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."projeto_grupos"("id") ON DELETE restrict ON UPDATE no action;
