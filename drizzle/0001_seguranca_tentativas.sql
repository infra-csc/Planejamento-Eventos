CREATE TABLE "tentativas_acesso" (
	"id" text PRIMARY KEY NOT NULL,
	"chave" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tentativas_acesso_chave_idx" ON "tentativas_acesso" USING btree ("chave","criado_em");