import type { NextConfig } from "next";

/** Host (sem esquema) de uma URL; undefined se vazia ou inválida. */
function hostDe(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/** Lista separada por vírgula, sem vazios, em minúsculas. */
const lista = (valor: string | undefined) =>
  (valor ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

/**
 * Server Actions: a própria origem (sempre aceita pelo Next) e, além dela, só os domínios exatos
 * deste app — o de APP_URL e os de ORIGENS_EXTRAS (hosts separados por vírgula, ex.: um domínio
 * antigo durante a migração). Nada de curingas: liberaria outros sites a disparar actions com o
 * cookie de quem estiver logado aqui.
 */
const ORIGENS_ACTIONS = [
  ...new Set([hostDe(process.env.APP_URL), ...lista(process.env.ORIGENS_EXTRAS)].filter((d): d is string => Boolean(d) && !d!.includes("*"))),
];

/**
 * Em `npm run dev`, o Next 16 bloqueia com 403 os scripts de /_next vindos de outro domínio que não
 * localhost. Para abrir o dev por outro endereço (IP da rede, túnel), liste os hosts em DEV_ORIGENS.
 * Vale só no dev.
 */
const ORIGENS_DEV = lista(process.env.DEV_ORIGENS);

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: ORIGENS_DEV,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "9mb",
      allowedOrigins: ORIGENS_ACTIONS,
    },
    // Cache de navegação no cliente: voltar/avançar e reabrir uma página vista há menos de 30 s
    // não refaz a requisição (as actions continuam invalidando com revalidatePath).
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // A Content-Security-Policy (com nonce por requisição) é montada no proxy: src/proxy.ts.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
