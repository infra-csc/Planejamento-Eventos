import type { NextConfig } from "next";

/**
 * Domínios do Replit. Em `npm run dev`, o Next 16 bloqueia com 403 os scripts de /_next vindos
 * de outro domínio que não localhost; e as Server Actions exigem que a origem do navegador
 * esteja liberada quando o proxy troca o host. `**` cobre subdomínios com vários níveis.
 */
const CURINGAS_REPLIT = ["**.replit.dev", "**.repl.co", "**.replit.app"];

/**
 * A origem inclui a porta quando a URL tem ":porta" (ex.: webview na 5000), e o curinga não
 * cobre porta. Por isso os domínios reais do Replit entram também com as portas usadas.
 */
const DOMINIOS_ENV = [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS ?? "").split(",")]
  .map((d) => d?.trim())
  .filter((d): d is string => Boolean(d));
const ORIGENS_REPLIT = [...CURINGAS_REPLIT, ...DOMINIOS_ENV.flatMap((d) => [d, `${d}:3000`, `${d}:5000`, `${d}:443`])];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: CURINGAS_REPLIT,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: ORIGENS_REPLIT,
    },
  },
};

export default nextConfig;
