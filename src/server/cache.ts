import "server-only";
import { cache } from "react";
import { obterEvento } from "./services/eventos";
import { obterSolicitacao } from "./services/solicitacoes";
import { obterProjeto } from "./services/projetos";

/**
 * Leituras memoizadas por requisição para as páginas: `generateMetadata`, layout e page pedem o
 * mesmo registro, e com isto a consulta acontece uma vez só. Scripts e services usam as funções
 * originais. O usuário vem de `getUsuarioAtual` (também memoizado), então a chave bate.
 */
export const obterEventoCache = cache(obterEvento);
export const obterSolicitacaoCache = cache(obterSolicitacao);
export const obterProjetoCache = cache(obterProjeto);
