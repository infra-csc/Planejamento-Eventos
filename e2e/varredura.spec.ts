import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { entrar } from "./apoio";

/**
 * Varredura de QA: cada perfil abre todas as telas do app (as fixas e uma de cada tipo com id: evento, ata, OS,
 * conferência, solicitação, projeto, peça, arena, impressões). Em cada uma confere:
 *  - a página respondeu (sem 500) e não caiu na tela de erro;
 *  - nenhum erro de JavaScript na página (pageerror) nem erro no console;
 *  - no celular, nada sai da largura da tela (sem rolagem lateral da página);
 *  - toda linha clicável de tabela tem o link acessível numa célula que aparece (teclado e leitor de tela);
 *  - para onde o perfil foi parar (a própria tela, /sem-permissao, /login) — vai para o relatório
 *    test-results/varredura.jsonl, que alimenta o docs/QA_REPORT.md.
 * Só lê telas: não clica em nada que grave.
 */

const PERFIS = {
  admin: "admin@nortemkt.com.br",
  logistica: "marina.castro@nortemkt.com.br",
  gestao: "helena.prado@nortemkt.com.br",
  cenografia: "bruno.tavares@nortemkt.com.br",
  producao: "paulo.ribeiro@nortemkt.com.br",
  ativacao: "julia.fontes@nortemkt.com.br",
} as const;

const FIXAS = [
  "/",
  "/eventos",
  "/eventos/novo",
  "/calendario",
  "/solicitacoes",
  "/solicitacoes/nova",
  "/biblioteca",
  "/biblioteca?aba=pecas",
  "/catalogo",
  "/catalogo/nova",
  "/projetos",
  "/projetos/novo",
  "/arena",
  "/arena/nova",
  "/carga-descarga",
  "/carga-descarga/cadastro",
  "/consolidacao",
  "/consolidacao/pendencias",
  "/pendencias",
  "/estoque",
  "/historico",
  "/notificacoes",
  "/perfil",
  "/admin",
  "/admin/usuarios",
  "/admin/areas",
  "/admin/configuracoes",
  "/rota-que-nao-existe",
];

const SAIDA = path.join("test-results", "varredura.jsonl");
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** Telas com id, descobertas pelo admin a partir das listas (uma de cada tipo). */
async function telasComId(page: Page): Promise<string[]> {
  const primeiroLink = async (lista: string, padrao: RegExp) => {
    await page.goto(lista);
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    return hrefs.find((h) => padrao.test(h)) ?? null;
  };
  const telas: string[] = [];
  const evento = await primeiroLink("/eventos", /^\/eventos\/[0-9a-f-]{36}$/);
  if (evento) {
    const id = evento.match(UUID)![0];
    telas.push(evento, `${evento}/ata`, `${evento}/os`, `${evento}/solicitacoes`, `${evento}/historico`, `${evento}/editar`, `${evento}/carga`, `${evento}/reuniao`, `/conferencia/${id}`, `/impressao/os/${id}`, `/impressao/ata/${id}`);
    const linha = await primeiroLink(`${evento}/ata`, /^\/eventos\/[0-9a-f-]{36}\/itens\/[0-9a-f-]{36}$/);
    if (linha) telas.push(linha);
  }
  const sol = await primeiroLink("/solicitacoes", /^\/solicitacoes\/[0-9a-f-]{36}$/);
  if (sol) telas.push(sol);
  const proj = await primeiroLink("/biblioteca", /^\/projetos\/[0-9a-f-]{36}$/);
  if (proj) telas.push(proj, `${proj}/editar`, `/projetos/novo?de=${proj.match(UUID)![0]}`);
  const peca = await primeiroLink("/biblioteca?aba=pecas", /^\/catalogo\/[0-9a-f-]{36}\/editar/);
  if (peca) telas.push(peca.split("?")[0]);
  const arena = await primeiroLink("/arena", /^\/arena\/(?!nova)[^/?#]+$/);
  if (arena) telas.push(arena, arena.replace("/arena/", "/impressao/arena/"));
  return telas;
}

let dinamicas: string[] = [];

test.beforeAll(async ({ browser }) => {
  mkdirSync("test-results", { recursive: true });
  const page = await browser.newPage();
  await entrar(page, PERFIS.admin);
  dinamicas = await telasComId(page);
  await page.close();
});

for (const [perfil, email] of Object.entries(PERFIS)) {
  test(`varredura · ${perfil}`, async ({ page }, info) => {
    test.setTimeout(15 * 60_000);
    const celular = info.project.name === "celular";
    await entrar(page, email);
    const falhas: string[] = [];
    for (const rota of [...FIXAS, ...dinamicas]) {
      const errosJs: string[] = [];
      const errosConsole: string[] = [];
      const onErro = (e: Error) => errosJs.push(e.message.slice(0, 200));
      const onConsole = (m: { type(): string; text(): string }) => {
        // Recurso que o próprio teste não controla (favicon, extensões) não conta; 4xx de rota protegida também não.
        if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of (401|403|404)/.test(m.text())) errosConsole.push(m.text().slice(0, 200));
      };
      page.on("pageerror", onErro);
      page.on("console", onConsole);
      let status = 0;
      try {
        const r = await page.goto(rota, { waitUntil: "load" });
        status = r?.status() ?? 0;
        await page.waitForTimeout(300);
      } catch (e) {
        errosJs.push(`navegação: ${(e as Error).message.slice(0, 160)}`);
      }
      page.off("pageerror", onErro);
      page.off("console", onConsole);
      const final = new URL(page.url()).pathname;
      const titulo = (await page.locator("h1").first().textContent({ timeout: 2_000 }).catch(() => null))?.trim() ?? "";
      const telaDeErro = /Não foi possível (carregar esta página|montar a versão para impressão)/.test(titulo);
      // Compara com a largura do aparelho (375), não com window.innerWidth: com a emulação de celular a página
      // que transborda "amplia" o layout e innerWidth cresce junto (o estoque passava com 559 px numa tela de 375).
      const telaAparelho = info.project.use.viewport?.width ?? 375;
      const largura = celular ? await page.evaluate((tela) => ({ doc: document.documentElement.scrollWidth, tela: Math.min(window.innerWidth, tela) }), telaAparelho) : null;
      const transborda = largura ? largura.doc > largura.tela + 1 : false;
      // Link da linha (LinhaLink) dentro de célula escondida nesta largura: a linha fica sem link para teclado/leitor de tela.
      const linksOcultos = await page.evaluate(() => [...document.querySelectorAll("a[data-linha-link]")].filter((a) => { const c = a.closest("td,th"); return c && getComputedStyle(c).display === "none"; }).length);
      const registro = { projeto: info.project.name, perfil, rota, final, status, titulo, telaDeErro, errosJs, errosConsole, transborda, largura, linksOcultos };
      appendFileSync(SAIDA, JSON.stringify(registro) + "\n");
      const esperado404 = rota === "/rota-que-nao-existe";
      if (status >= 500 || telaDeErro) falhas.push(`${rota}: ${status} ${titulo}`);
      if (status === 404 && !esperado404) falhas.push(`${rota}: 404 inesperado`);
      if (errosJs.length) falhas.push(`${rota}: erro JS ${errosJs.join(" | ")}`);
      if (errosConsole.length) falhas.push(`${rota}: console ${errosConsole.join(" | ")}`);
      if (linksOcultos) falhas.push(`${rota}: ${linksOcultos} linha(s) com o link acessível numa célula escondida`);
      if (transborda) falhas.push(`${rota}: página mais larga que a tela (${largura!.doc}px > ${largura!.tela}px)`);
    }
    expect(falhas, falhas.join("\n")).toEqual([]);
  });
}
