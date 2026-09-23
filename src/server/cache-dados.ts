import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas } from "@/server/db/schema";
import { obterConfiguracoes } from "@/server/services/support";

/**
 * Cache entre requisições para dados que quase não mudam (catálogo de peças, projetos com a lista de
 * peças da versão atual, áreas, configurações). Cada leitura tem uma tag; as actions que alteram
 * esses dados chamam `invalidarDados` com a tag, e a próxima leitura vai ao banco.
 *
 * - Fora do Next (scripts, vitest) não há cache: a função original roda direto.
 * - O cache do Next grava JSON; datas são codificadas à parte para a leitura devolver `Date` de novo,
 *   igual à consulta original.
 * - Cada instância do Autoscale tem o próprio cache: a invalidação vale na instância que atendeu a
 *   action; nas outras, o dado fica velho por no máximo `REVALIDAR_S` segundos.
 */
export const TAGS_DADOS = {
  catalogo: "dados:catalogo",
  projetos: "dados:projetos",
  areas: "dados:areas",
  config: "dados:config",
} as const;

export type TagDados = (typeof TAGS_DADOS)[keyof typeof TAGS_DADOS];

const REVALIDAR_S = 60;
const MARCA_DATA = "$npeData";

function codificar(valor: unknown): string {
  return JSON.stringify(valor, function (this: Record<string, unknown>, chave, v) {
    const bruto = this[chave];
    return bruto instanceof Date ? { [MARCA_DATA]: bruto.toISOString() } : v;
  });
}

function decodificar<T>(texto: string): T {
  return JSON.parse(texto, (_chave, v) => {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof v[MARCA_DATA] === "string" && Object.keys(v).length === 1) return new Date(v[MARCA_DATA]);
    return v;
  }) as T;
}

/**
 * Versão com cache de `fn`. `chave` identifica a consulta (única no app); os argumentos entram na
 * chave, então precisam ser serializáveis (filtros simples, nunca o usuário).
 */
export function cacheDados<A extends unknown[], R>(fn: (...args: A) => Promise<R>, chave: string, tags: TagDados[]): (...args: A) => Promise<R> {
  const emCache = unstable_cache(async (...args: A) => codificar(await fn(...args)), ["npe-dados", chave], { tags, revalidate: REVALIDAR_S });
  return async (...args: A) => {
    if (!process.env.NEXT_RUNTIME) return fn(...args);
    return decodificar<R>(await emCache(...args));
  };
}

/** Só em Server Actions: expira as tags na hora (quem salvou já vê o dado novo) e atualiza a tela atual. */
export function invalidarDados(...tags: TagDados[]) {
  for (const t of new Set(tags)) updateTag(t);
}

/**
 * Só em Server Actions, depois de mudar pedido, ata, OS ou fase de evento. As páginas do app são
 * dinâmicas (leem a sessão): qualquer revalidação na action já faz a resposta trazer a tela atual
 * renderizada de novo desde o layout raiz (contadores do menu e do sino inclusos) e limpa o cache de
 * navegação do cliente, então as outras telas também vêm atualizadas. Antes era `revalidatePath("/",
 * "layout")`, que além disso expirava o cache de dados acima em todas as páginas; caminhos de página
 * (sem "layout") só marcam as leituras feitas nessas páginas.
 */
export function revalidarTelasOperacao(...extras: string[]) {
  for (const caminho of new Set(["/", "/solicitacoes", "/eventos", ...extras])) revalidatePath(caminho);
}

/** Áreas ativas (mesmo resultado de `listarAreas()`). */
export const listarAreasAtivasCache = cacheDados(
  async () => {
    const db = await getDb();
    return db.query.areas.findMany({ where: eq(areas.ativo, true), orderBy: [asc(areas.criadoEm)] });
  },
  "areas-ativas",
  [TAGS_DADOS.areas],
);

/** Configurações do sistema (mesmo resultado de `obterConfiguracoes`). */
export const obterConfiguracoesCache = cacheDados(async () => obterConfiguracoes(await getDb()), "configuracoes", [TAGS_DADOS.config]);
