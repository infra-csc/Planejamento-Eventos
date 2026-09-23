import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, HEADER_CAMINHO } from "@/server/auth/cookies";
import { gerarNonce, montarCsp } from "@/server/auth/csp";

/** Sem sessão, abrem só estas. /api/cron se protege sozinha (Authorization: Bearer CRON_SECRET). */
const PUBLICAS = ["/login", "/recuperar-senha", "/redefinir-senha", "/api/cron"];

/**
 * Verificação otimista: só checa a presença do cookie de sessão. A validação real
 * acontece no servidor (requireUsuario) em cada página e action.
 *
 * Também monta a Content-Security-Policy com nonce novo a cada requisição (o Next lê o nonce do
 * cabeçalho da requisição e o aplica aos próprios scripts) e informa ao servidor o caminho pedido
 * (troca de senha obrigatória: requireUsuario só libera /perfil).
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
  const temCookie = Boolean(request.cookies.get(COOKIE_SESSAO)?.value);
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!temCookie && !publica) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Não redireciona /login → / só porque existe cookie: o proxy não sabe se a sessão ainda vale
  // (expirada, revogada na troca de senha, banco recarregado) e isso criava um loop /login ↔ /.
  // A própria página de login valida a sessão no banco e manda para dentro quem já está logado.
  const cabecalhos = new Headers(request.headers);
  // Rotas de API não são documentos: sem CSP daqui (as que servem arquivos, como a planta da
  // arena e os anexos, mandam a própria CSP com sandbox, que não pode ser sobrescrita).
  if (pathname.startsWith("/api/")) {
    cabecalhos.set(HEADER_CAMINHO, pathname);
    return NextResponse.next({ request: { headers: cabecalhos } });
  }
  const nonce = gerarNonce();
  const csp = montarCsp(nonce);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);
  // Sobrescreve o que o cliente mandar: o servidor confia neste valor.
  cabecalhos.set(HEADER_CAMINHO, pathname);
  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export const config = {
  // /api/anexos fica de fora: responde com a própria CSP (sandbox) e é validado na rota.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/anexos|.*\.(?:png|jpg|svg|ico|webp)$).*)"],
};
