import { expect, test } from "@playwright/test";
import { criarEvento, criarSolicitacao, entrar, PROJETOS, trocarUsuario, unico, USUARIOS } from "./apoio";

/**
 * (c) Conferência da ata de um evento em preparação: marca uma linha, confere as restantes,
 * registra os dados da reunião e fecha a ata (a OS v1 nasce e a tela vai para ela).
 * O evento e os pedidos são criados no próprio teste: o fechamento da ata não tem volta.
 */
test("logística confere a ata, registra a reunião e fecha a ata", async ({ page }) => {
  const nomeEvento = `E2E Conferência ${unico()}`;

  await entrar(page, USUARIOS.marina);
  const eventoId = await criarEvento(page, nomeEvento);

  // Três linhas na ata: uma marcada à mão e duas pelo "conferir as restantes".
  await trocarUsuario(page, USUARIOS.paulo);
  await criarSolicitacao(page, {
    eventoId,
    titulo: `Estruturas ${nomeEvento}`,
    itens: [
      { projeto: PROJETOS.portico4, quantidade: 1, descricoes: ["Entrada"] },
      { projeto: PROJETOS.quadroFoto, quantidade: 1, descricoes: ["Área de fotos"] },
      { projeto: PROJETOS.palco, quantidade: 1, descricoes: ["Palco principal"] },
    ],
  });

  await trocarUsuario(page, USUARIOS.marina);
  await page.goto(`/conferencia/${eventoId}`);
  await expect(page.getByRole("heading", { name: `Conferência · ${nomeEvento}`, level: 1 })).toBeVisible();

  // Em preparação: inicia a reunião (bloqueia novos envios).
  await page.getByRole("button", { name: "Iniciar reunião" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Iniciar reunião" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Reunião de OS em andamento", { exact: false })).toBeVisible();

  const conferencia = page.getByRole("region", { name: "Conferência da ata" });
  const progresso = conferencia.getByRole("progressbar", { name: "Linhas conferidas" });
  await expect(progresso).toHaveAttribute("aria-valuemax", "3");
  await expect(progresso).toHaveAttribute("aria-valuenow", "0");

  // Uma linha à mão.
  const check = conferencia.getByRole("checkbox", { name: `${PROJETOS.portico4}: marcar como conferido` });
  await check.click();
  await expect(conferencia.getByRole("checkbox", { name: `${PROJETOS.portico4}: conferido, clique para desfazer` })).toBeChecked();
  await expect(progresso).toHaveAttribute("aria-valuenow", "1");

  // As restantes em lote (com confirmação).
  await conferencia.getByRole("button", { name: "Conferir as 2 restantes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Marcar 2 como conferidas" }).click();
  await expect(progresso).toHaveAttribute("aria-valuenow", "3");

  // Dados da reunião: salvam sozinhos ao digitar/sair do campo.
  const painel = page.getByRole("complementary", { name: "Dados da reunião" });
  await painel.getByRole("textbox", { name: /Pessoas presentes/ }).fill("Marina (Logística), Paulo (Produção)");
  await painel.getByRole("textbox", { name: "Público esperado" }).fill("1200");
  await painel.getByRole("textbox", { name: "Caminhão sai" }).fill("véspera, 6h");
  await painel.getByRole("textbox", { name: "Caminhão sai" }).blur();
  await expect(painel.getByText("salvo automaticamente", { exact: true })).toBeVisible();

  // O fechamento libera depois que a página reflete os presentes gravados.
  await page.reload();
  await page.getByRole("region", { name: "Andamento da reunião" }).getByRole("button", { name: "Fechar ata e gerar OS" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fechar ata e gerar OS" }).click();

  await page.waitForURL(new RegExp(`/eventos/${eventoId}/os`));
  await expect(page.getByText(/^v1$/).first()).toBeVisible();
});
