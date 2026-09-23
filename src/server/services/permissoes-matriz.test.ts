/**
 * Matriz de permissões table-driven: cada service que altera dados é chamado por cada perfil.
 * O que a MATRIZ (src/domain/permissions.ts, lida via `pode`) permite precisa passar de verdade
 * (o fixture é montado para o caminho feliz); o que ela proíbe precisa lançar SemPermissaoError —
 * nunca outro erro, nem sucesso. Depois, escopo de área e "ver como".
 *
 * Banco: PGlite em memória com as migrações reais. Cada caso monta o próprio evento/solicitação.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
});

import { pode, podeEditarSolicitacao, PERFIS, type Acao } from "@/domain/permissions";
import { TRANSICOES_EVENTO, ACOES_EVENTO } from "@/domain/evento";
import { SemPermissaoError } from "@/domain/errors";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import type { Perfil } from "@/server/db/schema";
import {
  alterarQuantidadeLinha,
  conferirLinha,
  conferirTodasLinhas,
  criarEvento,
  editarEvento,
  incluirLinhaAta,
  salvarDadosReuniao,
  salvarObservacoesReuniao,
  transicionarEvento,
} from "./eventos";
import {
  atenderTudo,
  atualizarCabecalho,
  cancelarSolicitacao,
  criarRascunho,
  desfazerResposta,
  devolverSolicitacao,
  enviarSolicitacao as enviarRascunho,
  excluirRascunho,
  listarPendenciasCompra,
  listarSolicitacoes,
  obterSolicitacao,
  paginarSolicitacoes,
  resolverPendenciaCompra,
  responderItem,
  salvarItem,
  salvarSolicitacaoCompleta,
} from "./solicitacoes";
import { ajustarLinhaNaConferencia, ajustarPecaDoProjeto } from "./conferencia";
import { alterarAtivoPeca, criarPeca as criarPecaService, editarPeca, type DadosPeca } from "./catalogo";
import { alterarAtivoProjeto, anexarArquivo, criarProjeto as criarProjetoService, editarProjeto, removerAnexo } from "./projetos";
import { alterarAtivoUsuario, criarUsuario as criarUsuarioService, editarUsuario, gerarNovoLinkAcesso, obterConfig, salvarArea, salvarConfig } from "./admin";
import { criarArena, excluirArena, removerPlantaArena, trocarPlantaArena } from "./arenas";
import { removerPosicaoArena, restaurarPlantaArena, salvarPosicaoArena } from "./arena";
import { marcarOsEnviada } from "./os";
import { vincularAoCatalogo } from "./fora-catalogo";
import { consolidarPeriodo } from "./consolidacao";
import {
  criarPeca,
  criarProjeto,
  dia,
  enviarSolicitacao,
  eventoAberto,
  incluirPeca,
  incluirProjeto,
  itemAvulso,
  migrarBanco,
  montarElenco,
  novoEvento,
  pngMinimo,
  rascunho,
  unico,
  type Elenco,
} from "@/test/apoio";

let E: Elenco;
let pecaId: string;
let projetoId: string;
let png: Buffer;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaId = (await criarPeca()).id;
  projetoId = (await criarProjeto(pecaId, 4)).id;
  png = await pngMinimo();
}, 120_000);

/* ------------------------------------------------------------------ */
/* Tabela                                                               */
/* ------------------------------------------------------------------ */

type Caso<P> = {
  nome: string;
  /** Ação da MATRIZ que o service exige. */
  acao: Acao;
  /** Quem pode, quando não é só `pode(u, acao)` (escopo de área, duas ações). */
  permitido?: (u: UsuarioAtual) => boolean;
  /** Monta o estado do caminho feliz. Recebe quem vai agir (para quando o autor importa, ex.: desfazer). */
  preparar?: (u: UsuarioAtual) => Promise<P>;
  executar: (u: UsuarioAtual, p: P) => Promise<unknown>;
};

const casos: Caso<unknown>[] = [];
function caso<P>(c: Caso<P>) {
  casos.push(c as Caso<unknown>);
}

const podeResponder = (u: UsuarioAtual) => pode(u, "solicitacao.responder");
/** Solicitação da área A (a do requisitante do elenco): só a própria área e o administrador editam. */
const editaDaAreaA = (u: UsuarioAtual) => podeEditarSolicitacao(u, { areaId: E.areas.a.id });
const dadosEvento = (ev: { nome: string; cliente: string; local: string; dataInicio: string; dataReuniao: Date }) => ({ nome: `${ev.nome} (editado)`, cliente: ev.cliente, local: ev.local, dataInicio: ev.dataInicio, dataReuniao: ev.dataReuniao });
const dadosPeca = (): DadosPeca => ({ codigo: unico("NOVA").toUpperCase(), nome: "Peça nova", setor: "ESTRUTURA", familia: "", unidade: "un", descricao: null, estoqueProprio: 0, permiteEmProjeto: true });
const arquivoPng = () => new File([new Uint8Array(png)], "planta.png", { type: "image/png" });

/** Evento aberto com uma alteração pós-ata da área A (um item avulso) aguardando resposta. */
async function alteracaoEnviada(itens = [itemAvulso("Gerador extra", 2)]) {
  const { ev, linhaId } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
  const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, itens);
  return { ev, linhaId, s, itemId: s.itens[0].id };
}

/** Arena de evento criada pelo administrador (arena.ver hoje é só dele). */
async function arenaDeEvento(comPlanta = false) {
  const ev = await novoEvento(E.logistica);
  return criarArena(E.admin, { eventoId: ev.id, nome: unico("Arena"), partida: { tipo: "branco", largura: 60, profundidade: 40 } }, comPlanta ? arquivoPng() : null);
}

/* ---------- Evento ---------- */

caso({ nome: "criar evento", acao: "evento.criar", executar: (u) => novoEvento(u) });
caso({
  nome: "editar evento",
  acao: "evento.editar",
  preparar: () => novoEvento(E.logistica),
  executar: (u, ev) => editarEvento(u, ev.id, dadosEvento(ev)),
});
caso({ nome: "iniciar reunião", acao: "evento.transicionar", preparar: () => novoEvento(E.logistica), executar: (u, ev) => transicionarEvento(u, ev.id, "INICIAR_REUNIAO") });
caso({
  nome: "voltar para preparação",
  acao: "evento.transicionar",
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    return ev;
  },
  executar: (u, ev) => transicionarEvento(u, ev.id, "VOLTAR_PREPARACAO", "Reunião remarcada"),
});
caso({
  nome: "fechar ata",
  acao: "evento.transicionar",
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pecaId, 3, E.areas.a.id);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await conferirTodasLinhas(E.logistica, ev.id);
    await salvarDadosReuniao(E.logistica, ev.id, { reuniaoPresentes: "Logística", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null });
    return ev;
  },
  executar: (u, ev) => transicionarEvento(u, ev.id, "FECHAR_ATA"),
});
caso({ nome: "encerrar evento", acao: "evento.transicionar", preparar: () => eventoAberto(E.logistica, pecaId, E.areas.a.id), executar: (u, { ev }) => transicionarEvento(u, ev.id, "ENCERRAR") });
caso({
  nome: "reabrir evento encerrado",
  acao: "evento.reabrir",
  preparar: async () => {
    const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    await transicionarEvento(E.logistica, ev.id, "ENCERRAR");
    return ev;
  },
  executar: (u, ev) => transicionarEvento(u, ev.id, "REABRIR", "Exceção aprovada"),
});
caso({ nome: "cancelar evento", acao: "evento.transicionar", preparar: () => novoEvento(E.logistica), executar: (u, ev) => transicionarEvento(u, ev.id, "CANCELAR", "Cliente desistiu") });

/* ---------- Reunião, conferência e ata ---------- */

caso({
  nome: "salvar dados da reunião",
  acao: "ata.consolidar",
  preparar: () => novoEvento(E.logistica),
  executar: (u, ev) => salvarDadosReuniao(u, ev.id, { reuniaoPresentes: "Todos", publicoEsperado: 100, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null }),
});
caso({ nome: "salvar observações da reunião", acao: "ata.consolidar", preparar: () => novoEvento(E.logistica), executar: (u, ev) => salvarObservacoesReuniao(u, ev.id, "Nota interna") });
caso({ nome: "incluir linha na ata (antes do fechamento)", acao: "ata.consolidar", preparar: () => novoEvento(E.logistica), executar: (u, ev) => incluirPeca(u, ev.id, pecaId, 2, E.areas.a.id) });
caso({
  nome: "incluir linha na ata (ata fechada)",
  acao: "ata.ajustar",
  preparar: () => eventoAberto(E.logistica, pecaId, E.areas.a.id),
  executar: (u, { ev }) => incluirLinhaAta(u, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId, descricaoLivre: null, quantidade: 1, destino: null, areaId: null, justificativa: "Pedido do cliente" }),
});
caso({
  nome: "ajustar quantidade de linha (ata fechada)",
  acao: "ata.ajustar",
  preparar: () => eventoAberto(E.logistica, pecaId, E.areas.a.id),
  executar: (u, { ev, linhaId }) => alterarQuantidadeLinha(u, ev.id, linhaId, 12, "Cliente pediu mais", { quantidadeEsperada: 10 }),
});
caso({
  nome: "conferir uma linha",
  acao: "ata.consolidar",
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    return { ev, linha: await incluirPeca(E.logistica, ev.id, pecaId, 2, E.areas.a.id) };
  },
  executar: (u, { ev, linha }) => conferirLinha(u, ev.id, linha.id, true),
});
caso({
  nome: "conferir as restantes",
  acao: "ata.consolidar",
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    return { ev, linha: await incluirPeca(E.logistica, ev.id, pecaId, 2, E.areas.a.id) };
  },
  executar: (u, { ev, linha }) => conferirTodasLinhas(u, ev.id, [linha.id]),
});
caso({
  nome: "ajustar linha na conferência",
  acao: "ata.consolidar",
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    return { ev, linha: await incluirPeca(E.logistica, ev.id, pecaId, 5, E.areas.a.id) };
  },
  executar: (u, { ev, linha }) => ajustarLinhaNaConferencia(u, ev.id, linha.id, 4, "Uma reservada", { quantidadeEsperada: 5 }),
});
caso({
  nome: "ajustar peça de um projeto na ata",
  acao: "ata.consolidar",
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    return { ev, linha: await incluirProjeto(E.logistica, ev.id, projetoId, 2, E.areas.a.id) };
  },
  executar: (u, { ev, linha }) => ajustarPecaDoProjeto(u, ev.id, linha.id, pecaId, 3, "Espaço menor"),
});
caso({ nome: "marcar OS enviada ao carregamento", acao: "ata.ajustar", preparar: () => eventoAberto(E.logistica, pecaId, E.areas.a.id), executar: (u, { ev }) => marcarOsEnviada(u, ev.id) });

/* ---------- Resposta da logística ---------- */

caso({ nome: "responder item", acao: "solicitacao.responder", preparar: () => alteracaoEnviada(), executar: (u, { itemId }) => responderItem(u, itemId, { status: "ATENDIDO" }) });
caso({
  nome: "corrigir resposta",
  acao: "solicitacao.responder",
  preparar: async () => {
    const r = await alteracaoEnviada();
    await responderItem(E.logistica, r.itemId, { status: "ATENDIDO" });
    return r;
  },
  executar: (u, { itemId }) => responderItem(u, itemId, { status: "NAO_ATENDIDO", observacaoLogistica: "Sem estoque" }, "Respondi errado"),
});
caso({
  nome: "desfazer resposta",
  acao: "solicitacao.responder",
  // Só o autor desfaz: quem pode responder responde no preparo; os demais tentam desfazer a da logística.
  preparar: async (u) => {
    const r = await alteracaoEnviada();
    await responderItem(podeResponder(u) ? u : E.logistica, r.itemId, { status: "ATENDIDO" });
    return r;
  },
  executar: (u, { itemId }) => desfazerResposta(u, itemId),
});
caso({ nome: "devolver solicitação", acao: "solicitacao.responder", preparar: () => alteracaoEnviada(), executar: (u, { s }) => devolverSolicitacao(u, s.id, "Falta o destino") });
caso({ nome: "atender tudo", acao: "solicitacao.responder", preparar: () => alteracaoEnviada([itemAvulso("A"), itemAvulso("B", 2)]), executar: (u, { s }) => atenderTudo(u, s.id) });
caso({
  nome: "resolver pendência de compra",
  acao: "pendencias.resolver",
  preparar: async () => {
    const r = await alteracaoEnviada([itemAvulso("Tenda", 5)]);
    await responderItem(E.logistica, r.itemId, { status: "PARCIAL", quantidadeAtendida: 3, observacaoLogistica: "Só 3", pendenciaCompra: true });
    return r;
  },
  executar: (u, { itemId }) => resolverPendenciaCompra(u, itemId, "2 locadas"),
});
caso({ nome: "listar pendências de compra", acao: "pendencias.ver", executar: (u) => listarPendenciasCompra(u) });
caso({ nome: "vincular item fora do catálogo a uma peça", acao: "ata.consolidar", preparar: () => alteracaoEnviada(), executar: (u, { itemId }) => vincularAoCatalogo(u, { solicitacaoItemId: itemId }, { tipo: "PECA", pecaId }) });

/* ---------- Solicitação da área ---------- */

caso({
  nome: "criar solicitação (rascunho completo)",
  acao: "solicitacao.criar",
  preparar: () => novoEvento(E.logistica),
  // O administrador escolhe a área; os demais pedem pela própria (o areaId é ignorado).
  executar: (u, ev) => salvarSolicitacaoCompleta(u, { eventoId: ev.id, areaId: u.areaId ?? E.areas.a.id, titulo: "Pedido", observacao: null, enviar: false, itens: [itemAvulso("Palco")] }),
});
caso({ nome: "criar rascunho vazio", acao: "solicitacao.criar", preparar: () => novoEvento(E.logistica), executar: (u, ev) => criarRascunho(u, ev.id, u.areaId ?? E.areas.a.id) });
caso({
  nome: "enviar rascunho da área A",
  acao: "solicitacao.criar",
  permitido: editaDaAreaA,
  preparar: async () => rascunho(E.requisitante, (await novoEvento(E.logistica)).id),
  executar: (u, r) => enviarRascunho(u, r.id),
});
caso({
  nome: "autosave do rascunho da área A (formulário completo)",
  acao: "solicitacao.criar",
  permitido: editaDaAreaA,
  preparar: async () => {
    const ev = await novoEvento(E.logistica);
    return { ev, r: await rascunho(E.requisitante, ev.id) };
  },
  executar: (u, { ev, r }) => salvarSolicitacaoCompleta(u, { id: r.id, eventoId: ev.id, titulo: "Mudou", observacao: null, enviar: false, itens: [itemAvulso("Outro")] }),
});
caso({
  nome: "salvar item do rascunho da área A",
  acao: "solicitacao.criar",
  permitido: editaDaAreaA,
  preparar: async () => rascunho(E.requisitante, (await novoEvento(E.logistica)).id),
  executar: (u, r) => salvarItem(u, r.id, null, itemAvulso("Mais um")),
});
caso({
  nome: "editar cabeçalho do rascunho da área A",
  acao: "solicitacao.criar",
  permitido: editaDaAreaA,
  preparar: async () => rascunho(E.requisitante, (await novoEvento(E.logistica)).id),
  executar: (u, r) => atualizarCabecalho(u, r.id, { titulo: "Novo título", observacao: null }),
});
caso({
  nome: "excluir rascunho da área A",
  acao: "solicitacao.criar",
  permitido: editaDaAreaA,
  preparar: async () => rascunho(E.requisitante, (await novoEvento(E.logistica)).id),
  executar: (u, r) => excluirRascunho(u, r.id),
});
caso({
  nome: "cancelar solicitação enviada da área A",
  acao: "solicitacao.criar",
  permitido: editaDaAreaA,
  preparar: () => alteracaoEnviada(),
  executar: (u, { s }) => cancelarSolicitacao(u, s.id, "Mudou o plano"),
});

/* ---------- Catálogo e projetos ---------- */

caso({ nome: "cadastrar peça", acao: "catalogo.gerenciar", executar: (u) => criarPecaService(u, dadosPeca()) });
caso({ nome: "editar peça", acao: "catalogo.gerenciar", preparar: () => criarPeca(), executar: (u, p) => editarPeca(u, p.id, { ...dadosPeca(), codigo: p.codigo, nome: "Renomeada" }) });
caso({ nome: "inativar peça", acao: "catalogo.gerenciar", preparar: () => criarPeca(), executar: (u, p) => alterarAtivoPeca(u, p.id, false) });
caso({ nome: "criar projeto padrão", acao: "projeto.gerenciar", executar: (u) => criarProjetoService(u, { nome: unico("Projeto"), categoria: "Estrutura", descricao: null, observacaoVersao: null, itens: [{ pecaId, quantidade: 2 }] }) });
caso({
  nome: "editar projeto padrão",
  acao: "projeto.gerenciar",
  preparar: () => criarProjeto(pecaId),
  executar: (u, p) => editarProjeto(u, p.id, { nome: `${p.nome} v2`, categoria: "Estrutura", descricao: null, observacaoVersao: "Mais peças", itens: [{ pecaId, quantidade: 6 }] }),
});
caso({ nome: "inativar projeto padrão", acao: "projeto.gerenciar", preparar: () => criarProjeto(pecaId), executar: (u, p) => alterarAtivoProjeto(u, p.id, false) });
caso({ nome: "anexar arquivo ao projeto", acao: "projeto.gerenciar", preparar: () => criarProjeto(pecaId), executar: (u, p) => anexarArquivo(u, p.id, new File([new Uint8Array(png)], "foto.png", { type: "image/png" })) });
caso({
  nome: "remover anexo do projeto",
  acao: "projeto.gerenciar",
  preparar: async () => anexarArquivo(E.admin, (await criarProjeto(pecaId)).id, new File([new Uint8Array(png)], "foto.png", { type: "image/png" })),
  executar: (u, a) => removerAnexo(u, a.id),
});

/* ---------- Administração ---------- */

caso({ nome: "criar área", acao: "admin.areas", executar: (u) => salvarArea(u, null, { nome: unico("Área nova"), ativo: true }) });
caso({
  nome: "criar usuário",
  acao: "admin.usuarios",
  executar: (u) => criarUsuarioService(u, { nome: "Pessoa nova", email: `${unico("nova")}@teste.local`, perfil: "GESTAO", areaId: null, senha: "senha-inicial-123", ativo: true }),
});
caso({
  nome: "editar usuário",
  acao: "admin.usuarios",
  executar: (u) => editarUsuario(u, E.requisitanteB.id, { nome: E.requisitanteB.nome, email: E.requisitanteB.email, perfil: "REQUISITANTE", areaId: E.areas.b.id, senha: null, ativo: true }),
});
caso({ nome: "reativar usuário", acao: "admin.usuarios", executar: (u) => alterarAtivoUsuario(u, E.requisitanteB.id, true) });
caso({ nome: "gerar link de acesso", acao: "admin.usuarios", executar: (u) => gerarNovoLinkAcesso(u, E.requisitanteB.id) });
caso({
  nome: "salvar configurações",
  acao: "admin.configuracoes",
  // Grava o valor que já está lá: o caso não muda o comportamento dos demais.
  preparar: () => obterConfig(),
  executar: (u, cfg) => salvarConfig(u, { sla_resposta_horas: cfg.sla_resposta_horas }),
});

/* ---------- Arena e consolidação ---------- */

caso({
  nome: "criar arena de evento",
  acao: "arena.ver",
  preparar: () => novoEvento(E.logistica),
  executar: (u, ev) => criarArena(u, { eventoId: ev.id, nome: unico("Arena"), partida: { tipo: "branco", largura: 50, profundidade: 30 } }, null),
});
caso({ nome: "trocar planta da arena", acao: "arena.ver", preparar: () => arenaDeEvento(), executar: (u, a) => trocarPlantaArena(u, a.slug, arquivoPng()) });
caso({ nome: "remover planta da arena", acao: "arena.ver", preparar: () => arenaDeEvento(true), executar: (u, a) => removerPlantaArena(u, a.slug) });
caso({ nome: "excluir arena", acao: "arena.ver", preparar: () => arenaDeEvento(), executar: (u, a) => excluirArena(u, a.slug) });
caso({
  nome: "marcar ponto no mapa da arena",
  acao: "arena.ver",
  permitido: (u) => pode(u, "arena.ver") && pode(u, "ata.consolidar"),
  preparar: () => arenaDeEvento(),
  executar: (u, a) => salvarPosicaoArena(u, a.slug, { chave: unico("novo"), tipo: "NOVO", x: 1, z: 2, nome: "Tenda extra" }),
});
caso({
  nome: "remover ponto do mapa da arena",
  acao: "arena.ver",
  permitido: (u) => pode(u, "arena.ver") && pode(u, "ata.consolidar"),
  preparar: async () => {
    const a = await arenaDeEvento();
    const chave = unico("novo");
    await salvarPosicaoArena(E.admin, a.slug, { chave, tipo: "NOVO", x: 1, z: 2, nome: "Tenda extra" });
    return { a, chave };
  },
  executar: (u, { a, chave }) => removerPosicaoArena(u, a.slug, chave),
});
caso({
  nome: "restaurar planta original da arena",
  acao: "arena.ver",
  permitido: (u) => pode(u, "arena.ver") && pode(u, "ata.consolidar"),
  preparar: async () => {
    const a = await arenaDeEvento();
    await salvarPosicaoArena(E.admin, a.slug, { chave: unico("novo"), tipo: "NOVO", x: 1, z: 2, nome: "Tenda extra" });
    return a;
  },
  executar: (u, a) => restaurarPlantaArena(u, a.slug),
});
caso({ nome: "consolidar período", acao: "consolidacao.ver", executar: (u) => consolidarPeriodo(u, { inicio: dia(0), fim: dia(30) }) });

/* ------------------------------------------------------------------ */
/* Execução                                                             */
/* ------------------------------------------------------------------ */

describe("matriz perfil × service", { timeout: 60_000 }, () => {
  for (const c of casos) {
    describe(c.nome, () => {
      it.each([...PERFIS])("%s", async (perfil) => {
        const u = E.porPerfil[perfil as Perfil];
        const permitido = (c.permitido ?? ((x: UsuarioAtual) => pode(x, c.acao)))(u);
        const p = c.preparar ? await c.preparar(u) : undefined;
        if (permitido) {
          await expect(c.executar(u, p)).resolves.not.toThrow();
        } else {
          await expect(c.executar(u, p)).rejects.toBeInstanceOf(SemPermissaoError);
        }
      });
    });
  }

  it("cada perfil tem ao menos uma ação permitida e uma barrada na tabela (a tabela não é vazia)", () => {
    for (const perfil of PERFIS) {
      const u = E.porPerfil[perfil];
      const resultados = casos.map((c) => (c.permitido ?? ((x: UsuarioAtual) => pode(x, c.acao)))(u));
      expect(resultados.some(Boolean)).toBe(true);
      if (perfil !== "ADMIN") expect(resultados.some((r) => !r)).toBe(true);
    }
  });

  it("máquina de estados do evento e MATRIZ concordam sobre quem transiciona", () => {
    for (const acao of ACOES_EVENTO) {
      const exigida: Acao = acao === "REABRIR" ? "evento.reabrir" : "evento.transicionar";
      const pelaMatriz = PERFIS.filter((p) => pode({ perfil: p, areaId: null }, exigida));
      expect([...TRANSICOES_EVENTO[acao].perfis].sort(), acao).toEqual([...pelaMatriz].sort());
    }
  });
});

/* ------------------------------------------------------------------ */
/* Escopo de área                                                       */
/* ------------------------------------------------------------------ */

describe("escopo de área", { timeout: 60_000 }, () => {
  it("requisitante da área B não vê, não edita, não envia nem cancela solicitação da área A", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await rascunho(E.requisitante, ev.id);
    await expect(obterSolicitacao(E.requisitanteB, r.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(salvarSolicitacaoCompleta(E.requisitanteB, { id: r.id, eventoId: ev.id, titulo: "Invasão", observacao: null, enviar: false, itens: [] })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(salvarItem(E.requisitanteB, r.id, null, itemAvulso("Invasão"))).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(atualizarCabecalho(E.requisitanteB, r.id, { titulo: "Invasão", observacao: null })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(enviarRascunho(E.requisitanteB, r.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(excluirRascunho(E.requisitanteB, r.id)).rejects.toBeInstanceOf(SemPermissaoError);

    const { s } = await alteracaoEnviada();
    await expect(obterSolicitacao(E.requisitanteB, s.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(cancelarSolicitacao(E.requisitanteB, s.id, "não é minha")).rejects.toBeInstanceOf(SemPermissaoError);
    // O rascunho e a enviada continuam intactos.
    expect((await obterSolicitacao(E.requisitante, r.id)).titulo).toBe("Rascunho de teste");
    expect((await obterSolicitacao(E.requisitante, s.id)).status).toBe("ENVIADA");
  });

  it("listas e paginação da área B não trazem nada da área A", async () => {
    const { s } = await alteracaoEnviada();
    const lista = await listarSolicitacoes(E.requisitanteB);
    expect(lista.some((x) => x.id === s.id)).toBe(false);
    expect(lista.every((x) => x.areaId === E.areas.b.id)).toBe(true);
    const pagina = await paginarSolicitacoes(E.requisitanteB, { filtro: "TODAS", porPagina: 100 });
    expect(pagina.itens.every((x) => x.areaId === E.areas.b.id)).toBe(true);
  });

  it("área B não pede alteração sobre linha da ata que é da área A", async () => {
    const { ev, linhaId } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    const tentativa = salvarSolicitacaoCompleta(E.requisitanteB, { eventoId: ev.id, titulo: "Mexer na da A", observacao: null, enviar: false, itens: [{ operacao: "ALTERAR_QUANTIDADE", eventoItemId: linhaId, quantidadeSolicitada: 2 }] });
    await expect(tentativa).rejects.toThrow(/outra área/);
  });

  it("rascunho não enviado da área A: a logística e a gestão não veem; o administrador vê", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await rascunho(E.requisitante, ev.id);
    await expect(obterSolicitacao(E.logistica, r.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(obterSolicitacao(E.gestao, r.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(obterSolicitacao(E.admin, r.id)).resolves.toMatchObject({ id: r.id });
  });

  it("cenografia (área própria) não edita rascunho da área A, mas cria na própria", async () => {
    const ev = await novoEvento(E.logistica);
    const r = await rascunho(E.requisitante, ev.id);
    await expect(excluirRascunho(E.cenografia, r.id)).rejects.toBeInstanceOf(SemPermissaoError);
    const proprio = await rascunho(E.cenografia, ev.id);
    expect((await obterSolicitacao(E.cenografia, proprio.id)).areaId).toBe(E.cenografia.areaId);
  });
});

/* ------------------------------------------------------------------ */
/* "Ver como" não eleva privilégio                                      */
/* ------------------------------------------------------------------ */

describe('"ver como" (usuário já resolvido pela sessão)', { timeout: 60_000 }, () => {
  /** Como getUsuarioAtual entrega o administrador vendo como requisitante da área A. */
  const adminComoRequisitanteA = (): UsuarioAtual => ({ ...E.admin, perfil: "REQUISITANTE", areaId: E.areas.a.id, areaNome: E.areas.a.nome, verComo: { perfilReal: "ADMIN" } });

  it("administrador vendo como requisitante perde as ações de administrador e de logística", async () => {
    const u = adminComoRequisitanteA();
    const { itemId, ev } = await alteracaoEnviada();
    await expect(responderItem(u, itemId, { status: "ATENDIDO" })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(transicionarEvento(u, ev.id, "ENCERRAR")).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(criarUsuarioService(u, { nome: "X", email: `${unico("x")}@teste.local`, perfil: "ADMIN", areaId: null, senha: "senha-inicial-123", ativo: true })).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(salvarConfig(u, {})).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(criarEvento(u, { nome: "X", cliente: null, local: null, dataInicio: dia(5), dataReuniao: new Date(Date.now() + 86_400_000) })).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it("administrador vendo como requisitante da área A fica preso à área A", async () => {
    const u = adminComoRequisitanteA();
    const ev = await novoEvento(E.logistica);
    const daB = await rascunho(E.requisitanteB, ev.id);
    await expect(obterSolicitacao(u, daB.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(excluirRascunho(u, daB.id)).rejects.toBeInstanceOf(SemPermissaoError);
    // Pede pela área vista, mesmo informando outra.
    const r = await salvarSolicitacaoCompleta(u, { eventoId: ev.id, areaId: E.areas.b.id, titulo: "Pelo ver como", observacao: null, enviar: false, itens: [itemAvulso("Item")] });
    expect((await obterSolicitacao(E.admin, r.id)).areaId).toBe(E.areas.a.id);
  });

  it("administrador vendo como logística não reabre evento (ação só de gestão/admin)", async () => {
    const u: UsuarioAtual = { ...E.admin, perfil: "LOGISTICA", areaId: E.areas.logistica.id, areaNome: E.areas.logistica.nome, verComo: { perfilReal: "ADMIN" } };
    const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    await transicionarEvento(u, ev.id, "ENCERRAR");
    await expect(transicionarEvento(u, ev.id, "REABRIR", "Exceção")).rejects.toBeInstanceOf(SemPermissaoError);
  });
});

