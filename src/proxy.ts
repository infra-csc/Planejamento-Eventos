import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "npe_sessao";
const PUBLICAS = ["/login", "/recuperar-senha", "/redefinir-senha"];

/**
 * Verificação otimista: só checa a presença do cookie de sessão. A validação real
 * acontece no servidor (requireUsuario) em cada página e action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Diagnóstico de proxy (Replit): o Next recusa Server Actions quando origin e host não batem.
  if (request.method === "POST" && request.headers.has("next-action")) {
    const origem = request.headers.get("origin");
    const hostEncaminhado = request.headers.get("x-forwarded-host");
    const host = request.headers.get("host");
    const hostOrigem = origem && origem !== "null" ? new URL(origem).host : origem;
    if (hostOrigem !== (hostEncaminhado?.split(",")[0]?.trim() ?? host)) {
      console.warn(`[origem-action] origin=${origem ?? "(ausente)"} x-forwarded-host=${hostEncaminhado ?? "(ausente)"} host=${host ?? "(ausente)"}`);
    }
  }
  const temCookie = Boolean(request.cookies.get(COOKIE)?.value);
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!temCookie && !publica) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (temCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/anexos|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
