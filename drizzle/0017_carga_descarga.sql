CREATE TABLE "veiculos_carga" (
  "id" text PRIMARY KEY NOT NULL,
  "evento_id" text NOT NULL,
  "tipo" text NOT NULL,
  "ident" text DEFAULT '' NOT NULL,
  "ida" jsonb NOT NULL,
  "volta" jsonb NOT NULL,
  "criado_por_id" text,
  "atualizado_por_id" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "veiculos_carga" ADD CONSTRAINT "veiculos_carga_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "veiculos_carga" ADD CONSTRAINT "veiculos_carga_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "veiculos_carga" ADD CONSTRAINT "veiculos_carga_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "veiculos_carga_evento_idx" ON "veiculos_carga" USING btree ("evento_id");
