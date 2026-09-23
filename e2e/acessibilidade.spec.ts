import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { abrirEvento, entrar, EVENTOS, USUARIOS } from "./apoio";

/**
 * (e) Acessibilidade com axe-core (WCAG 2.x A/AA) nas telas principais.
 * Falha só com violações `serious` ou `critical`; todas as encontradas (inclusive `moderate` e
 * `minor`) vão para o relatório: anexo JSON por tela, uma linha por regra no console e o resumo
 * de todas as telas em test-results/axe-violacoes.jsonl.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BLOQUEIAM = new Set(["serious", "critical"]);

/**
 * BUGS DO APP já conhecidos (encontrados por este teste em 23/09/2026). O elemento fica fora da
 * auditoria normal da tela — o resto dela continua valendo — e um `test.fixme` no fim do arquivo
 * audita a tela inteira. Ao corrigir no app, apague a entrada e o fixme correspondente.
 */
const CONHECIDAS: Record<string, Array<{ regra: string; seletor: string; bug: string }>> = {};

async function auditar(page: Page, tela: string, { comConhecidas = false } = {}) {
  // Espera a página assentar (fontes, hidratação, animações de entrada).
  await page.waitForLoadState("load");
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(400);

  let axe = new AxeBuilder({ page }).withTags(TAGS);
  if (!comConhecidas) for (const c of CONHECIDAS[tela] ?? []) axe = axe.exclude(c.seletor);
  const resultado = await axe.analyze();
  const violacoes = resultado.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact ?? "desconhecido",
    descricao: v.help,
    ajuda: v.helpUrl,
    ocorrencias: v.nodes.length,
    alvos: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")} ${n.html.replace(/\s+/g, " ").slice(0, 160)}`),
  }));

  await test.info().attach(`axe-${tela}.json`, { body: JSON.stringify(violacoes, null, 2), contentType: "application/json" });
  const resumo = path.join(test.info().project.outputDir, "axe-violacoes.jsonl");
  mkdirSync(path.dirname(resumo), { recursive: true });
  for (const v of violacoes) {
    appendFileSync(resumo, JSON.stringify({ projeto: test.info().project.name, tela, completa: comConhecidas, ...v }) + "\n");
    console.log(`[axe] ${test.info().project.name} · ${tela} · ${v.impacto} · ${v.regra} (${v.ocorrencias}×): ${v.descricao}`);
    test.info().annotations.push({ type: `axe ${v.impacto}`, description: `${tela}: ${v.regra} (${v.ocorrencias}×) — ${v.descricao}` });
  }

  const graves = violacoes.filter((v) => BLOQUEIAM.has(v.impacto));
  expect(graves, `Violações serious/critical em ${tela}:\n${graves.map((g) => `- ${g.impacto} ${g.regra}: ${g.descricao} → ${g.alvos.join(" | ")}`).join("\n")}`).toEqual([]);
}

async function abrirConferencia(page: Page) {
  await entrar(page, USUARIOS.marina);
  const id = await abrirEvento(page, EVENTOS.preparacao);
  await page.goto(`/conferencia/${id}`);
  await expect(page.getByRole("region", { name: "Conferência da ata" })).toBeVisible();
}

test.describe("acessibilidade (axe)", () => {
  test("Painel", async ({ page }) => {
    await entrar(page, USUARIOS.marina);
    await page.goto("/");
    await auditar(page, "painel");
  });

  test("Eventos", async ({ page }) => {
    await entrar(page, USUARIOS.marina);
    await page.goto("/eventos");
    await auditar(page, "eventos");
  });

  test("Solicitações", async ({ page }) => {
    await entrar(page, USUARIOS.marina);
    await page.goto("/solicitacoes");
    await auditar(page, "solicitacoes");
  });

  test("Nova solicitação", async ({ page }) => {
    await entrar(page, USUARIOS.paulo);
    await page.goto("/solicitacoes/nova");
    await expect(page.getByRole("heading", { name: "Adicione o que precisa" })).toBeVisible();
    await auditar(page, "nova-solicitacao");
  });

  test("Evento (visão geral)", async ({ page }) => {
    await entrar(page, USUARIOS.marina);
    await abrirEvento(page, EVENTOS.preparacao);
    await auditar(page, "evento");
  });

  test("Conferência", async ({ page }) => {
    await abrirConferencia(page);
    await auditar(page, "conferencia");
  });
});

test.describe("acessibilidade (axe) — regressões corrigidas", () => {
  // Regressões de acessibilidade já corrigidas: auditam a tela inteira, sem excluir nada.
  test("Conferência: filtro de área tem nome acessível (button-name)", async ({ page }) => {
    await abrirConferencia(page);
    await auditar(page, "conferencia", { comConhecidas: true });
  });

  test("Evento no celular: links da trilha com alvo de toque suficiente (target-size)", async ({ page }) => {
    await entrar(page, USUARIOS.marina);
    await abrirEvento(page, EVENTOS.preparacao);
    await auditar(page, "evento", { comConhecidas: true });
  });
});
