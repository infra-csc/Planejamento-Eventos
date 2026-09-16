ALTER TABLE "evento_itens" ADD COLUMN "conferido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD COLUMN "conferido_por_id" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "reuniao_iniciada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "reuniao_presentes" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "publico_esperado" integer;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "caminhao_carrega" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "caminhao_sai" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "arena_descarrega" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "kit_descarrega" text;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_conferido_por_id_usuarios_id_fk" FOREIGN KEY ("conferido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;