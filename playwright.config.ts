import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta (E2E) com Playwright — veja docs/testes.md.
 *
 * O `webServer` (e2e/servidor.mjs) recria um banco PGlite em .data/e2e (migrações, seed de
 * demonstração, catálogo real e arena), faz o build de produção e sobe `npm run start` na porta
 * 3100 com EXIBIR_DEMO=true (usuários do seed entram sem a troca obrigatória de senha).
 *
 * Variáveis:
 * - E2E_PORT: outra porta (padrão 3100).
 * - E2E_SEM_BUILD=1: reaproveita o build atual (.next) em vez de rodar `npm run build`.
 * - E2E_REUSAR_SERVIDOR=1: usa um app já rodando na porta (sem recriar o banco — os testes criam os próprios dados).
 */
const PORTA = Number(process.env.E2E_PORT || 3100);
const BASE_URL = `http://localhost:${PORTA}`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // Um servidor só com PGlite (um processo, uma conexão): os fluxos rodam em sequência.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "celular",
      // Chromium com tela de celular (375×812, toque): o CI só instala o Chromium.
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: "node e2e/servidor.mjs",
    url: `${BASE_URL}/login`,
    // Nunca reaproveita por acaso: outro app na mesma porta daria resultados de outro banco.
    reuseExistingServer: process.env.E2E_REUSAR_SERVIDOR === "1",
    // Build de produção + seed: alguns minutos na primeira vez.
    timeout: 15 * 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { E2E_PORT: String(PORTA) },
  },
});
