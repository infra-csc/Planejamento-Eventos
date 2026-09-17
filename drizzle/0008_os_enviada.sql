ALTER TABLE "os_versoes" ADD COLUMN "enviada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "os_versoes" ADD COLUMN "enviada_por_id" text;--> statement-breakpoint
ALTER TABLE "os_versoes" ADD CONSTRAINT "os_versoes_enviada_por_id_usuarios_id_fk" FOREIGN KEY ("enviada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;