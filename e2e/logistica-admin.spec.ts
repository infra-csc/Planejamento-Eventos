import { expect, test } from "@playwright/test";
import { abrirEvento, entrar, EVENTOS, USUARIOS } from "./apoio";

/** Logística de materiais (V1 do briefing): por enquanto só o administrador vê; para os outros perfis o app segue como antes. */
const ROTAS = ["/projecao", "/projecao/previstas", "/contagem", "/cadastros", "/saneamento"];

test("quem não é administrador não vê o menu, a aba nem as telas", async ({ page }) => {
  await entrar(page, USUARIOS.marina);
  await expect(page.getByRole("link", { name: "Projeção", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Cadastros logísticos", exact: true })).toHaveCount(0);
  const id = await abrirEvento(page, EVENTOS.preparacao);
  await expect(page.getByRole("link", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Logística", exact: true })).toHaveCount(0);
  await expect(page.getByText("Vai do nosso galpão")).toHaveCount(0);
  for (const rota of [...ROTAS, `/eventos/${id}/logistica`, `/impressao/fornecedor/${id}`]) {
    await page.goto(rota);
    await expect(page, rota).toHaveURL(/sem-permissao/);
  }
  expect((await page.request.get("/api/projecao/excel")).status()).toBe(403);
  expect((await page.request.get(`/api/eventos/${id}/fornecedor`)).status()).toBe(403);
});

test("o administrador vê o menu, as telas e a aba do evento", async ({ page }) => {
  await entrar(page, "admin@nortemkt.com.br");
  for (const rota of ROTAS) {
    await page.goto(rota);
    await expect(page, rota).toHaveURL(new RegExp(rota));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await abrirEvento(page, EVENTOS.preparacao);
  await expect(page.getByRole("link", { name: "Logística", exact: true })).toBeVisible();
});
