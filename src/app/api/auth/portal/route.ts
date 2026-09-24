import { NextResponse } from "next/server";
import { entrarPeloPortal } from "@/server/auth/portal-entrada";

/*
 * Entrada pelo Portal NORTE: GET /api/auth/portal?portal_sso=<jwt>. O token é validado, o usuário é
 * criado ou atualizado pelo e-mail e a sessão é aberta. Qualquer falha cai na tela de login com o
 * motivo, nunca num erro cru. A rota é pública (proxy.ts); sem PORTAL_SSO_SECRET ela fica desligada.
 */

/**
 * Endereço público do app para o redirecionamento. Atrás do proxy do Replit, `request.url` traz o
 * host interno (0.0.0.0:3000) — redirecionar para ele manda a pessoa a uma página que não abre.
 * Ordem: APP_URL; depois os cabeçalhos x-forwarded-*; por fim a própria requisição.
 */
export function origemPublica(request: Request): string {
  const configurada = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configurada && /^https?:\/\//.test(configurada)) return configurada;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(request.url).protocol.replace(":", "");
  if (host && !/^(0\.0\.0\.0|\[::\])/.test(host)) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jwt = url.searchParams.get("portal_sso") ?? "";
  const r = await entrarPeloPortal(jwt);
  const base = origemPublica(request);
  if (!r.ok) {
    console.warn(`[portal] entrada recusada: ${r.motivo}`);
    const erro = r.motivo === "expirado" || r.motivo === "reutilizado" ? "portal-expirado" : r.motivo === "desativado" ? "portal-desativado" : r.motivo === "inativo" ? "portal-inativo" : "portal-invalido";
    return NextResponse.redirect(`${base}/login?erro=${erro}`, 303);
  }
  return NextResponse.redirect(`${base}${r.destino}`, 303);
}
