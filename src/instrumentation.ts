import type { Instrumentation } from "next";

/**
 * Observabilidade: todo erro de servidor que o Next captura (render, route handler, action, proxy)
 * vira uma linha JSON no log — o mesmo formato de `tratarErro` (src/lib/action.ts). O `ref` é o
 * digest que a tela de erro mostra, então a pessoa pode informar o código e achamos a linha.
 * Nada sensível: sem cabeçalhos, cookies, query string nem corpo da requisição.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { linhaLogErro } = await import("@/lib/action");
    const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
    // Redirect/notFound também passam por aqui como "erros" de controle de fluxo: não são falhas.
    if (digest && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "DYNAMIC_SERVER_USAGE")) return;
    const usuarioId = await usuarioDaRequisicao(request.headers);
    console.error(
      linhaLogErro(err, {
        ref: digest ?? Math.random().toString(36).slice(2, 8).toUpperCase(),
        rota: context.routePath,
        metodo: request.method,
        origem: context.routeType,
        usuarioId,
      }),
    );
  } catch {
    // O log de erro nunca pode derrubar a resposta.
  }
};

/** Id do usuário da sessão (só o id; nunca o token). Falha em silêncio: o log sai mesmo sem ele. */
async function usuarioDaRequisicao(headers: Record<string, string | string[] | undefined>): Promise<string | null> {
  try {
    const bruto = headers["cookie"];
    const cookie = Array.isArray(bruto) ? bruto.join("; ") : (bruto ?? "");
    const { COOKIE_SESSAO } = await import("@/server/auth/cookies");
    const token = cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${COOKIE_SESSAO}=`))
      ?.slice(COOKIE_SESSAO.length + 1);
    if (!token) return null;
    // Banco só no runtime Node (o bloco some do bundle edge).
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const [{ hashToken }, { getDb }, { sessoes }, { eq }] = await Promise.all([import("@/server/auth/password"), import("@/server/db"), import("@/server/db/schema"), import("drizzle-orm")]);
      const db = await getDb();
      const [s] = await db.select({ usuarioId: sessoes.usuarioId }).from(sessoes).where(eq(sessoes.tokenHash, hashToken(decodeURIComponent(token)))).limit(1);
      return s?.usuarioId ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
