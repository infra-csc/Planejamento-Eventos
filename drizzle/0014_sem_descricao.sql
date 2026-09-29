-- Item de solicitação pode dispensar a descrição por unidade (quem pede marca "não precisa").
ALTER TABLE "solicitacao_itens" ADD COLUMN IF NOT EXISTS "sem_descricao" boolean DEFAULT false NOT NULL;
