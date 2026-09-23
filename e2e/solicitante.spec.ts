import { expect, test } from "@playwright/test";
import { entrar, enviarFormulario, EVENTOS, PROJETOS, unico, USUARIOS } from "./apoio";

/**
 * (a) Solicitante cria uma necessidade pré-reunião: escolhe o evento em preparação na busca,
 * adiciona um projeto padrão com quantidade 2, descreve as 2 unidades, dá o título e envia.
 * Pré-reunião entra direto na ata: a solicitação aparece "Na ata".
 */
test("solicitante envia necessidade com 2 unidades descritas e ela fica na ata", async ({ page }) => {
  const titulo = `E2E pórticos ${unico()}`;
  const descricoes = ["Entrada principal, testeira com logo do cliente", "Saída de emergência, testeira lisa"];

  await entrar(page, USUARIOS.paulo);
  await page.goto("/solicitacoes/nova");

  // 1 · Evento: busca no combobox e escolhe a opção.
  const evento = page.getByRole("combobox", { name: /Evento/ });
  await evento.click();
  await evento.fill("TechNorte");
  await page.getByRole("option", { name: new RegExp(EVENTOS.preparacao) }).click();
  await expect(page.getByText("pré-reunião", { exact: true }).first()).toBeVisible();

  // 2 · Projeto padrão com quantidade 2.
  await page.getByRole("searchbox", { name: "Buscar projeto padrão" }).fill(PROJETOS.portico4);
  const qtd = page.getByRole("spinbutton", { name: `Quantidade de ${PROJETOS.portico4}`, exact: true });
  await page.getByRole("listitem").filter({ has: qtd }).getByRole("button", { name: "Aumentar" }).click();
  await expect(qtd).toHaveValue("2");
  await page.getByRole("button", { name: `Adicionar ${PROJETOS.portico4}`, exact: true }).click();

  // 3 · Uma descrição por unidade (sem elas o envio fica bloqueado).
  await expect(page.getByText("0 de 2 descritas")).toBeVisible();
  for (const [n, d] of descricoes.entries()) {
    await page.getByRole("textbox", { name: `Descrição da unidade ${n + 1} de ${PROJETOS.portico4}`, exact: true }).fill(d);
  }
  await expect(page.getByText("2 de 2 descritas")).toBeVisible();
  await page.getByRole("textbox", { name: `Onde vai ficar`, exact: false }).first().fill("Entradas");

  // 4 · Título e envio.
  await page.getByRole("textbox", { name: /^Título/ }).fill(titulo);
  await expect(page.getByText("Pronto para enviar").filter({ visible: true }).first()).toBeVisible();
  await enviarFormulario(page);

  await page.waitForURL(/\/solicitacoes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();
  // Selo da solicitação e do item: pré-reunião já entra na ata, aguardando a conferência.
  await expect(page.getByText("Na ata", { exact: true }).first()).toBeVisible();
  const item = page.getByRole("group", { name: new RegExp(`^${PROJETOS.portico4}`) });
  await expect(item).toContainText("Na ata");
  for (const d of descricoes) await expect(item.getByText(d)).toBeVisible();
});
