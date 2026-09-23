import { expect, type Page } from "@playwright/test";

/** Usuários do seed (scripts/seed.ts). Senha de todos: norte1234. */
export const USUARIOS = {
  paulo: "paulo.ribeiro@nortemkt.com.br", // Requisitante · Produção
  marina: "marina.castro@nortemkt.com.br", // Logística
  rafael: "rafael.nunes@nortemkt.com.br", // Logística
} as const;
export const SENHA = "norte1234";

/** Eventos do seed usados como ponto de partida. */
export const EVENTOS = {
  aberto: "Festival Praia Sonora 2026", // EVT-0001 · ata fechada, aceita alterações
  preparacao: "Convenção Anual TechNorte", // EVT-0002 · em preparação, com pedidos (nenhum teste fecha a ata dele)
} as const;

export const PROJETOS = {
  portico4: "Pórtico boca de 4 m com orelha",
  quadroFoto: "Quadro de fotos 4×3 m",
  palco: "Palco 8×4 m com escada e rampa",
} as const;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** Sufixo único por execução/projeto, para nomes de eventos e títulos não colidirem entre desktop e celular. */
export const unico = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function idDaUrl(url: string): string {
  const m = url.match(UUID);
  if (!m) throw new Error(`Sem id na URL: ${url}`);
  return m[0];
}

/** Entra pela tela de login (rótulos acessíveis) e espera sair dela. */
export async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Troca de usuário na mesma aba: descarta os cookies da sessão atual e entra com outro e-mail. */
export async function trocarUsuario(page: Page, email: string) {
  await page.context().clearCookies();
  await entrar(page, email);
}

/**
 * Segue o link de uma linha de tabela/lista. As linhas são clicáveis inteiras e o link acessível
 * ("Abrir EVT-0001 — …") é visualmente oculto: ativa pelo teclado, como um leitor de tela faria.
 */
export async function seguirLink(page: Page, nome: RegExp) {
  await page.getByRole("link", { name: nome }).first().press("Enter");
}

/** Abre um evento pela lista de eventos e devolve o id. */
export async function abrirEvento(page: Page, nome: string): Promise<string> {
  await page.goto("/eventos");
  await seguirLink(page, new RegExp(nome));
  await page.waitForURL(/\/eventos\/[0-9a-f-]{36}/);
  return idDaUrl(page.url());
}

/** Data (AAAA-MM-DD) daqui a `dias` dias. */
export const diaISO = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Logística cria um evento em preparação (reunião daqui a 10 dias, evento em 20).
 * `alteracoesAte` vazio reproduz o bug de e2e/eventos.spec.ts; os fluxos passam uma data.
 */
export async function criarEvento(page: Page, nome: string, { alteracoesAte = diaISO(18) }: { alteracoesAte?: string } = {}): Promise<string> {
  await page.goto("/eventos/novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Cliente").fill("Cliente E2E");
  await page.getByLabel("Data do evento").fill(diaISO(20));
  await page.getByLabel("Reunião de OS").fill(`${diaISO(10)}T14:00`);
  if (alteracoesAte) await page.getByLabel("Alterações até").fill(alteracoesAte);
  await page.getByRole("button", { name: "Criar evento" }).click();
  await page.waitForURL(/\/eventos\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();
  return idDaUrl(page.url());
}

/**
 * Fecha os avisos (toasts) abertos. No celular eles aparecem no rodapé, por cima da barra fixa de
 * envio, e ficam até 8 s ("… adicionado · Descrever"): sem isso o clique em "Enviar" cai no aviso.
 */
export async function fecharAvisos(page: Page) {
  const fechar = page.getByRole("button", { name: "Fechar aviso" });
  for (let i = 0; i < 10 && (await fechar.count()) > 0; i++) {
    await fechar.first().click({ timeout: 2_000 }).catch(() => undefined);
  }
}

/** Envia o formulário de nova solicitação: "Enviar solicitação" (desktop) ou "Enviar" na barra fixa (celular/tablet). */
export async function enviarFormulario(page: Page) {
  await fecharAvisos(page);
  await page.getByRole("button", { name: /^Enviar( solicitação)?$/ }).filter({ visible: true }).first().click();
}

export type ItemPedido = { projeto: string; quantidade: number; descricoes: string[] };

/**
 * Nova solicitação pela tela: evento já escolhido pela URL (?evento=), cada projeto buscado no
 * catálogo, quantidade no cartão, descrição de cada unidade, título e envio. Devolve o id.
 */
export async function criarSolicitacao(page: Page, { eventoId, titulo, itens }: { eventoId: string; titulo: string; itens: ItemPedido[] }): Promise<string> {
  await page.goto(`/solicitacoes/nova?evento=${eventoId}`);
  await expect(page.getByRole("heading", { name: "Adicione o que precisa" })).toBeVisible();

  for (const item of itens) {
    const busca = page.getByRole("searchbox", { name: "Buscar projeto padrão" });
    await busca.fill(item.projeto);
    const quantidade = page.getByRole("spinbutton", { name: `Quantidade de ${item.projeto}`, exact: true });
    await quantidade.fill(String(item.quantidade));
    await expect(quantidade).toHaveValue(String(item.quantidade));
    await page.getByRole("button", { name: `Adicionar ${item.projeto}`, exact: true }).click();

    if (item.quantidade === 1) {
      await page.getByRole("textbox", { name: `Descrição de ${item.projeto}`, exact: true }).fill(item.descricoes[0]);
    } else {
      for (let n = 0; n < item.quantidade; n++) {
        await page.getByRole("textbox", { name: `Descrição da unidade ${n + 1} de ${item.projeto}`, exact: true }).fill(item.descricoes[n]);
      }
    }
  }

  await page.getByRole("textbox", { name: /^Título/ }).fill(titulo);
  await expect(page.getByText("Pronto para enviar").filter({ visible: true }).first()).toBeVisible();
  await enviarFormulario(page);
  await page.waitForURL(/\/solicitacoes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();
  return idDaUrl(page.url());
}
