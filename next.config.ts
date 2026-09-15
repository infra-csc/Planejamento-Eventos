import type { NextConfig } from "next";

/**
 * Domínios do Replit. Em `npm run dev`, o Next 16 bloqueia com 403 os scripts de /_next vindos
 * de outro domínio que não localhost: a página aparece, mas nenhum botão funciona.
 * `**` cobre subdomínios com vários níveis, como `<id>.kirk.replit.dev`.
 */
const DOMINIOS_REPLIT = ["**.replit.dev", "**.repl.co", "**.replit.app"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: DOMINIOS_REPLIT,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      // O proxy do Replit pode repassar um host diferente da origem do navegador.
      allowedOrigins: DOMINIOS_REPLIT,
    },
  },
};

export default nextConfig;
