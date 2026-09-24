import { NextResponse } from "next/server";
import { entrarPeloPortal } from "@/server/auth/portal-entrada";

/*
 * Entrada pelo Portal NORTE: GET /api/auth/portal?portal_sso=<jwt>. O token é validado, o usuário é
 * criado ou atualizado pelo e-mail e a sessão é aberta. Qualquer falha cai na tela de login com o
 * motivo, nunca num erro cru. A rota é pública (proxy.ts); sem PORTAL_SSO_SECRET ela fica desligada.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jwt = url.searchParams.get("portal_sso") ?? "";
  const r = await entrarPeloPortal(jwt);
  if (!r.ok) {
    console.warn(`[portal] entrada recusada: ${r.motivo}`);
    const erro = r.motivo === "expirado" || r.motivo === "reutilizado" ? "portal-expirado" : r.motivo === "desativado" ? "portal-desativado" : r.motivo === "inativo" ? "portal-inativo" : "portal-invalido";
    return NextResponse.redirect(new URL(`/login?erro=${erro}`, url.origin), 303);
  }
  return NextResponse.redirect(new URL(r.destino, url.origin), 303);
}
