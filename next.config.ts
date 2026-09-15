import type { NextConfig } from "next";

/**
 * Domínios do Replit. Em `npm run dev`, o Next 16 bloqueia com 403 os scripts de /_next vindos
 * de outro domínio que não localhost; `**` cobre subdomínios com vários níveis.
 */
const CURINGAS_REPLIT = ["**.replit.dev", "**.repl.co", "**.replit.app"];

/**
 * Server Actions: só a origem deste app. A origem inclui a porta quando a URL tem ":porta"
 * (ex.: webview na 5000), por isso os domínios reais entram também com as portas usadas.
 * Os curingas (que liberariam qualquer app do Replit) só entram se o Replit não informar os domínios.
 */
const DOMINIOS_ENV = [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS ?? "").split(","), process.env.APP_URL ? new URL(process.env.APP_URL).host : undefined]
  .map((d) => d?.trim())
  .filter((d): d is string => Boolean(d) && d !== "localhost:3000");
const ORIGENS_ACTIONS = DOMINIOS_ENV.length > 0 ? DOMINIOS_ENV.flatMap((d) => [d, `${d}:3000`, `${d}:5000`, `${d}:443`]) : CURINGAS_REPLIT;

/** O Replit mostra o app num iframe do próprio editor; fora dele, ninguém pode embutir o app. */
const ANCESTRAIS = ["'self'", "https://replit.com", "https://*.replit.com", "https://*.replit.dev"].join(" ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: CURINGAS_REPLIT,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: ORIGENS_ACTIONS,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: `frame-ancestors ${ANCESTRAIS}; base-uri 'self'; form-action 'self'; object-src 'none'` },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
