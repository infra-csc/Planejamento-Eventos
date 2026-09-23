import { DomainError } from "@/domain/errors";
import { ZodError, type ZodType } from "zod";

/**
 * Resultado padrão das server actions consumidas por useActionState.
 */
export type ActionResult<T = unknown> =
  | { ok: true; dados?: T; mensagem?: string }
  | { ok: false; erro: string; campos?: Record<string, string> };

export const ESTADO_INICIAL: ActionResult = { ok: true } as ActionResult;

/** Contexto opcional do log de erro: qual action e quem estava usando. */
export type ContextoErro = { acao?: string; usuarioId?: string | null };

/** Envolve a execução de uma action convertendo erros de domínio/validação em resultado amigável. */
export async function executar<T>(fn: () => Promise<T>, mensagem?: string, contexto?: ContextoErro): Promise<ActionResult<T>> {
  try {
    const dados = await fn();
    return { ok: true, dados, mensagem };
  } catch (e) {
    return tratarErro(e, contexto);
  }
}

/**
 * Uma linha JSON por erro inesperado — mesmo formato aqui (actions) e em src/instrumentation.ts
 * (onRequestError). Leva só tipo, mensagem e pilha curta: nunca o objeto cru, que pode trazer
 * parâmetros da consulta (e-mail, hash, token).
 */
export function linhaLogErro(
  e: unknown,
  extras: { ref: string; codigo?: string | null; acao?: string | null; usuarioId?: string | null; rota?: string | null; metodo?: string | null; origem?: string | null },
): string {
  const err = e instanceof Error ? e : new Error(String(e));
  return JSON.stringify({
    nivel: "erro",
    ref: extras.ref,
    codigo: extras.codigo ?? null,
    origem: extras.origem ?? null,
    acao: extras.acao ?? null,
    rota: extras.rota ?? null,
    metodo: extras.metodo ?? null,
    usuarioId: extras.usuarioId ?? null,
    tipo: err.name,
    mensagem: err.message.slice(0, 500),
    pilha: err.stack?.split("\n").slice(0, 6).join(" | "),
  });
}

export function tratarErro(e: unknown, contexto?: ContextoErro): ActionResult<never> {
  if (e instanceof DomainError) return { ok: false, erro: e.message, campos: e.campos };
  if (e instanceof ZodError) {
    const campos: Record<string, string> = {};
    for (const issue of e.issues) {
      const k = issue.path.join(".") || "_";
      if (!campos[k]) campos[k] = issue.message;
    }
    return { ok: false, erro: "Verifique os campos destacados.", campos };
  }
  // Next usa exceções para redirect(); não engolir.
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest?: unknown }).digest === "string") throw e;
  // Violação de índice único (23505): duas pessoas gravaram a mesma coisa ao mesmo tempo.
  const codigo = (e as { code?: string; cause?: { code?: string } } | null)?.code ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
  if (codigo === "23505") return { ok: false, erro: "Outra pessoa alterou este registro ao mesmo tempo. Recarregue a página e tente de novo." };
  // Erro inesperado: um código curto liga a mensagem que a pessoa viu à linha do log. O log leva só
  // tipo, mensagem e pilha (sem o objeto cru, que pode trazer parâmetros da consulta: e-mail, hash).
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(linhaLogErro(e, { ref, codigo, acao: contexto?.acao, usuarioId: contexto?.usuarioId, origem: "action" }));
  return { ok: false, erro: `Não foi possível concluir a operação. Tente novamente; se continuar, informe o código ${ref} ao administrador.` };
}

export function parseForm<T>(schema: ZodType<T>, formData: FormData): T {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("$")) continue;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      const lista = (obj[key] as unknown[] | undefined) ?? [];
      lista.push(v);
      obj[key] = lista;
    } else obj[k] = v;
  }
  return schema.parse(obj);
}
