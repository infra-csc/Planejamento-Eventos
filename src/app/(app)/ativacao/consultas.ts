import "server-only";
import { cache } from "react";
import { listarReformas, listarRetornos, obterItemAtivacao } from "@/server/services/ativacao";

/*
 * Leituras da Ativação memoizadas por requisição: o layout das abas conta retornos e reformas e a aba aberta lê a
 * mesma lista; o título (generateMetadata) e a página do item leem o mesmo item. Antes cada um consultava de novo
 * (auditoria 28/10, D-P2-1 e D-P2-3, nº 45). O usuário vem de `requireUsuario` (memoizado), então a chave bate.
 */
export const listarRetornosCache = cache(listarRetornos);
export const listarReformasCache = cache(listarReformas);
export const obterItemAtivacaoCache = cache(obterItemAtivacao);
