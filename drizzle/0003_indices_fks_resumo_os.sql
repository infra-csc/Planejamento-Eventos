ALTER TABLE "historico" DROP CONSTRAINT "historico_evento_id_eventos_id_fk";
--> statement-breakpoint
DROP INDEX "historico_evento_idx";--> statement-breakpoint
ALTER TABLE "os_versoes" ADD COLUMN "resumo" text;--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_solicitacao_item_id_solicitacao_itens_id_fk" FOREIGN KEY ("solicitacao_item_id") REFERENCES "public"."solicitacao_itens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico" ADD CONSTRAINT "historico_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_evento_item_gerado_id_evento_itens_id_fk" FOREIGN KEY ("evento_item_gerado_id") REFERENCES "public"."evento_itens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evento_itens_projeto_ativo_idx" ON "evento_itens" USING btree ("projeto_id") WHERE "evento_itens"."ativo";--> statement-breakpoint
CREATE INDEX "eventos_periodo_idx" ON "eventos" USING btree ("data_montagem","data_desmontagem");--> statement-breakpoint
CREATE INDEX "notificacoes_usuario_criado_idx" ON "notificacoes" USING btree ("usuario_id","criado_em");--> statement-breakpoint
CREATE INDEX "solicitacao_itens_evento_item_idx" ON "solicitacao_itens" USING btree ("evento_item_id");--> statement-breakpoint
CREATE INDEX "solicitacao_itens_pendencia_idx" ON "solicitacao_itens" USING btree ("respondido_em") WHERE "solicitacao_itens"."pendencia_compra";--> statement-breakpoint
CREATE INDEX "solicitacoes_atualizado_idx" ON "solicitacoes" USING btree ("atualizado_em") WHERE not "solicitacoes"."excluida";--> statement-breakpoint
CREATE INDEX "solicitacoes_prazo_abertas_idx" ON "solicitacoes" USING btree ("prazo_resposta_em") WHERE "solicitacoes"."status" in ('ENVIADA', 'EM_ANALISE') and not "solicitacoes"."excluida";--> statement-breakpoint
CREATE INDEX "historico_evento_idx" ON "historico" USING btree ("evento_id","criado_em");--> statement-breakpoint
ALTER TABLE "evento_itens" ADD CONSTRAINT "evento_itens_quantidade_chk" CHECK ("evento_itens"."quantidade" >= 0);--> statement-breakpoint
ALTER TABLE "projeto_itens" ADD CONSTRAINT "projeto_itens_quantidade_chk" CHECK ("projeto_itens"."quantidade" > 0);--> statement-breakpoint
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_quantidade_chk" CHECK ("solicitacao_itens"."quantidade_solicitada" >= 0);