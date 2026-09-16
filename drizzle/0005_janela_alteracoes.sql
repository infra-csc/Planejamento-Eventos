ALTER TABLE "eventos" ADD COLUMN "janela_alteracoes_ate" date;--> statement-breakpoint
ALTER TABLE "solicitacoes" ADD COLUMN "fora_da_janela" boolean DEFAULT false NOT NULL;