import { expect, test } from "@playwright/test";
import { abrirEvento, criarSolicitacao, entrar, EVENTOS, PROJETOS, seguirLink, trocarUsuario, unico, USUARIOS } from "./apoio";

/** Número da versão mais recente da OS, lido na aba "Ordem de serviço" do evento. */
async function versaoAtualOs(page: import("@playwright/test").Page, eventoId: string): Promise<number> {
  await page.goto(`/eventos/${eventoId}/os`);
  const versoes = await page.getByText(/^v\d+$/).allTextContents();
  const numeros = versoes.map((v) => Number(v.slice(1))).filter(Number.isFinite);
  expect(numeros.length, "a OS do evento aberto deveria ter ao menos uma versão").toBeGreaterThan(0);
  return Math.max(...numeros);
}

/**
 * (b) Logística abre uma solicitação de alteração aberta (evento com ata fechada), atende item a
 * item e vê a OS nova. A solicitação é criada pelo solicitante no próprio teste, para o fluxo
 * não depender de quantas alterações do seed ainda estão abertas (desktop e celular rodam o mesmo teste).
 */
test("logística atende alteração item a item e a OS ganha nova versão", async ({ page }) => {
  const titulo = `E2E alteração ${unico()}`;
  const itens = [
    { projeto: PROJETOS.portico4, quantidade: 1, descricoes: ["Acesso lateral da ativação"] },
    { projeto: PROJETOS.quadroFoto, quantidade: 1, descricoes: ["Quadro extra para a área de imprensa"] },
  ];

  await entrar(page, USUARIOS.paulo);
  const eventoId = await abrirEvento(page, EVENTOS.aberto);
  const solicitacaoId = await criarSolicitacao(page, { eventoId, titulo, itens });
  await expect(page.getByText(/^Alteração pós-ata ·/)).toBeVisible();

  await trocarUsuario(page, USUARIOS.marina);
  const antes = await versaoAtualOs(page, eventoId);

  // A solicitação aparece na fila de solicitações abertas.
  await page.goto("/solicitacoes");
  await seguirLink(page, new RegExp(titulo));
  await page.waitForURL(new RegExp(`/solicitacoes/${solicitacaoId}`));
  await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();

  for (const { projeto } of itens) {
    const item = page.getByRole("group", { name: new RegExp(`^${projeto}`) });
    await item.getByRole("button", { name: /^Atender 1/ }).click();
    await expect(item.getByRole("button", { name: /^Atender/ })).toHaveCount(0);
    await expect(item).toContainText("Atendido");
  }

  const depois = await versaoAtualOs(page, eventoId);
  expect(depois).toBeGreaterThan(antes);
});
