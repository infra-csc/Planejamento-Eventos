import "server-only";
import { cache } from "react";
import { obterEvento } from "./services/eventos";

/**
 * Leituras memoizadas por requisição para as páginas: `generateMetadata`, layout e page do evento
 * pedem o mesmo evento, e com isto a consulta acontece uma vez só. Scripts e services usam as
 * funções originais.
 */
export const obterEventoCache = cache(obterEvento);
