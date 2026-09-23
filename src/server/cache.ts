import "server-only";
import { cache } from "react";
import { obterEvento } from "./services/eventos";
import { obterSolicitacaoMemo } from "./services/solicitacoes";
import { obterProjeto } from "./services/projetos";

/**
 * Leituras memoizadas por requisição para as páginas: `generateMetadata`, layout e page pedem o
 * mesmo registro, e com isto a consulta acontece uma vez só. Scripts e services usam as funções
 * originais. O usuário vem de `getUsuarioAtual` (também memoizado), então a chave bate.
 */
export const obterEventoCache = cache(obterEvento);
/** A mesma instância que a linha do tempo da solicitação usa (services/linha-do-tempo.ts). */
export const obterSolicitacaoCache = obterSolicitacaoMemo;
export const obterProjetoCache = cache(obterProjeto);

/**
 * Dados estáveis com cache entre requisições (invalidados pelas actions de admin): trocar por estes
 * as chamadas a `listarAreas()` e `getDb().then(obterConfiguracoes)` nas páginas.
 */
export { listarAreasAtivasCache as listarAreasCache, obterConfiguracoesCache } from "./cache-dados";
