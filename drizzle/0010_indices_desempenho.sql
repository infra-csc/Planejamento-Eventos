CREATE INDEX IF NOT EXISTS "anexos_projeto_tipo_criado_idx" ON "anexos" USING btree ("projeto_id","tipo","criado_em");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evento_itens_area_idx" ON "evento_itens" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitacao_itens_solicitacao_pendencia_idx" ON "solicitacao_itens" USING btree ("solicitacao_id","pendencia_compra");
