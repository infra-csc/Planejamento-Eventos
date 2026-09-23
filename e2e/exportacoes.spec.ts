import { expect, test, type Page } from "@playwright/test";
import { abrirEvento, entrar, EVENTOS, USUARIOS } from "./apoio";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Segue o link de exportação com os cookies da sessão e confere status, tipo e assinatura ZIP (xlsx). */
async function conferirXlsx(page: Page, nomeLink: RegExp) {
  const link = page.getByRole("link", { name: nomeLink }).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href, `link ${nomeLink} sem href`).toBeTruthy();
  const r = await page.request.get(href!);
  expect(r.status(), `${href} deveria responder 200`).toBe(200);
  expect(r.headers()["content-type"]).toContain(XLSX);
  const corpo = await r.body();
  expect(corpo.subarray(0, 2).toString("latin1"), `${href} não parece um .xlsx`).toBe("PK");
}

/** (d) Exportações de um evento com ata fechada: OS em Excel, planilha de estrutura e ata em Excel. */
test("exportações da OS e da ata respondem 200 com xlsx", async ({ page }) => {
  await entrar(page, USUARIOS.marina);
  const eventoId = await abrirEvento(page, EVENTOS.aberto);

  await page.goto(`/eventos/${eventoId}/os`);
  await conferirXlsx(page, /^Excel completo/);
  await conferirXlsx(page, /^Planilha de estrutura/);

  await page.goto(`/eventos/${eventoId}/ata`);
  await conferirXlsx(page, /^Excel da ata/);
});
