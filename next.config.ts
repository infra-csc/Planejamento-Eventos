import type { NextConfig } from "next";

/**
 * Domínios do Replit. Em `npm run dev`, o Next 16 bloqueia com 403 os scripts de /_next vindos
 * de outro domínio que não localhost; `**` cobre subdomínios com vários níveis. Vale só no dev.
 */
const CURINGAS_REPLIT = ["**.replit.dev", "**.repl.co", "**.replit.app"];

/**
 * Server Actions: a própria origem (sempre aceita pelo Next) e, além dela, só os domínios exatos
 * deste app — o domínio publicado (REPLIT_DOMAINS, separado por vírgula), o do workspace
 * (REPLIT_DEV_DOMAIN) e o de APP_URL. Nada de curingas: `*.replit.app` liberaria qualquer app do
 * Replit a disparar actions com o cookie de quem estiver logado aqui.
 */
function hostDe(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}
const ORIGENS_ACTIONS = [
  ...new Set(
    [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS ?? "").split(","), hostDe(process.env.APP_URL)]
      .map((d) => d?.trim().toLowerCase())
      .filter((d): d is string => Boolean(d) && !d!.includes("*")),
  ),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: CURINGAS_REPLIT,
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
