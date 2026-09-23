ALTER TABLE "historico" ADD COLUMN IF NOT EXISTS "ver_como" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "trocar_senha" boolean DEFAULT false NOT NULL;
