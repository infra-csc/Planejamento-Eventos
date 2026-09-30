ALTER TABLE "evento_itens" ADD COLUMN IF NOT EXISTS "regra" text;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD COLUMN IF NOT EXISTS "regra_manual" boolean DEFAULT false NOT NULL;