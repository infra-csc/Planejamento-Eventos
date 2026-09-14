import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "npe_sessao";
const PUBLICAS = ["/login", "/recuperar-senha", "/redefinir-senha"];

/**
 * Verificação otimista: só checa a presença do cookie de sessão. A validação real
 * acontece no servidor (requireUsuario) em cada página e action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
