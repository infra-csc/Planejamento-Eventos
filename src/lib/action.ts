import { DomainError } from "@/domain/errors";
import { ZodError, type ZodType } from "zod";

/**
 * Resultado padrão das server actions consumidas por useActionState.
 */
export type ActionResult<T = unknown> =
  | { ok: true; dados?: T; mensagem?: string }
  | { ok: false; erro: string; campos?: Record<string, string> };

export const ESTADO_INICIAL: ActionResult = { ok: true } as ActionResult;

/** Envolve a execução de uma action convertendo erros de domínio/validação em resultado amigável. */
export async function executar<T>(fn: () => Promise<T>, mensagem?: string): Promise<ActionResult<T>> {
  try {
    const dados = await fn();
    return { ok: true, dados, mensagem };
  } catch (e) {
    return tratarErro(e);
  }
}

export function tratarErro(e: unknown): ActionResult<never> {
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
  console.error(e);
  return { ok: false, erro: "Não foi possível concluir a operação. Tente novamente." };
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
