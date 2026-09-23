// Sobe o app para os testes E2E (usado pelo `webServer` do playwright.config.ts).
//
// 1. Banco PGlite novo em .data/e2e (apagado a cada execução; o banco local .data/pglite não é tocado)
//    e cache de dados do Next (.next/cache/fetch-cache) limpo junto.
// 2. Migrações, seed de demonstração, catálogo real e arena Eco Run.
// 3. `npm run build` (pule com E2E_SEM_BUILD=1 se o build atual já serve) e `npm run start` na porta E2E_PORT (padrão 3100).
//
// EXIBIR_DEMO=true: os usuários do seed entram com norte1234 sem a troca obrigatória de senha.
import { rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const PORTA = process.env.E2E_PORT || "3100";
const DIR_BANCO = ".data/e2e";

const env = { ...process.env, PGLITE_DATA_DIR: DIR_BANCO, EXIBIR_DEMO: "true", APP_URL: `http://localhost:${PORTA}` };
// Nunca contra um Postgres de verdade: o seed tem senha fixa e o banco é apagado a cada execução.
delete env.DATABASE_URL;
delete env.SEED_DEMO;

function npm(...args) {
  console.log(`[e2e] npm run ${args.join(" ")}`);
  const r = spawnSync(`npm run ${args.join(" ")}`, { env, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`[e2e] falhou: npm run ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

rmSync(DIR_BANCO, { recursive: true, force: true });
// Cache de dados do Next (unstable_cache: projetos, catálogo, áreas) sobrevive ao build e é servido
// "velho" por até 60 s: com o banco recriado, os ids de projeto seriam os do banco anterior
// ("Projeto padrão inativo ou inexistente" ao salvar). Banco novo, cache novo.
rmSync(".next/cache/fetch-cache", { recursive: true, force: true });
npm("db:migrate");
npm("db:seed");
npm("importar:catalogo");
npm("importar:arena");
if (!process.env.E2E_SEM_BUILD) npm("build");

console.log(`[e2e] subindo o app em http://localhost:${PORTA}`);
// O último -p vence o -p 3000 do script "start".
const app = spawn(`npm run start -- -p ${PORTA}`, { env, stdio: "inherit", shell: true });
const encerrar = () => {
  if (!app.killed) app.kill();
};
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
process.on("exit", encerrar);
app.on("exit", (code) => process.exit(code ?? 0));
