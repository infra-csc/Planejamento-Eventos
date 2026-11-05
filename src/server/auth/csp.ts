// Sem "server-only": usado pelo proxy (src/proxy.ts) e pelos testes.

/** Nonce novo a cada requisição (128 bits aleatórios em base64). */
export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

type Ambiente = { NODE_ENV?: string };

/** Quem pode embutir o app num iframe: ninguém (`frame-ancestors 'none'`). */
export function ancestraisPermitidos(): string {
  return "'none'";
}

/**
 * Content-Security-Policy com nonce (guia do Next 16: docs/01-app/02-guides/content-security-policy.md).
 * - script-src: só scripts com o nonce desta resposta; 'strict-dynamic' deixa os chunks que eles
 *   carregam (Next/React, three.js da arena) rodarem sem listar URLs. Em dev, React usa eval.
 * - style-src 'unsafe-inline': Radix (posicionamento de menus/diálogos), o three.js e vários
 *   componentes usam atributo style; sem nonce em style-src para o 'unsafe-inline' valer.
 * - img-src data:/blob: e worker-src blob:: texturas e capturas do canvas da arena.
 */
export function montarCsp(nonce: string, env: Ambiente = process.env): string {
  const dev = env.NODE_ENV === "development";
  const diretivas: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob:",
    "font-src": "'self' data:",
    // Em dev, o recarregamento automático usa WebSocket.
    "connect-src": dev ? "'self' ws: wss:" : "'self'",
    "worker-src": "'self' blob:",
    "frame-ancestors": ancestraisPermitidos(),
    "base-uri": "'self'",
    "form-action": "'self'",
    "object-src": "'none'",
  };
  return Object.entries(diretivas)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ");
}
