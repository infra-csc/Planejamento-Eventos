import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, eventos, historico, pecas, projetos, solicitacaoItens, solicitacoes, type AjusteBom } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { tipoSolicitacaoParaStatus } from "@/domain/evento";
import { pode } from "@/domain/permissions";
import { podeEditarPreReuniaoEnviada, validarItem, type ItemRascunho } from "@/domain/solicitacao";
import { podeEditarSolicitacao } from "@/domain/permissions";
import { snapshotBom } from "../eventos";
import { bloquearEvento, notificar, proximoCodigo, registrarHistorico, usuariosLogistica, type Executor } from "../support";
import { ACOES_COM_MOTIVO } from "../eventos";
import { descricoesParaGravar, faltamDescricoes } from "@/domain/descricoes-itens";
import { extrasPermitidosTenda } from "@/domain/tendas";
import { carregarEditavel, MSG_DESCRICOES, MSG_TITULO_OBRIGATORIO, verificarJanelaPreReuniao } from "./comum";
import { enviarSolicitacao, registrarPreReuniaoNaAta } from "./envio";

/* ------------------------------------------------------------------ */
/* Rascunho                                                             */
/* ------------------------------------------------------------------ */

async function criarRascunhoTx(tx: Executor, usuario: UsuarioAtual, eventoId: string, areaEscolhida?: string | null) {
  exigir(usuario, "solicitacao.criar");
  // Quem pede escolhe a área em nome da qual está pedindo (a área fixa do cadastro vem sugerida).
  // No "ver como" o administrador fica preso à área que escolheu ver.
  const areaId = usuario.verComo ? usuario.areaId : (areaEscolhida ?? usuario.areaId);
  if (!areaId) throw new ValidacaoError("Escolha a área que está pedindo.", { areaId: "Escolha a área." });
  const area = await tx.query.areas.findFirst({ where: and(eq(areas.id, areaId), eq(areas.ativo, true)), columns: { id: true } });
  if (!area) throw new ValidacaoError("Área inativa ou inexistente.", { areaId: "Escolha outra área." });
  const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
  if (!ev) throw new NaoEncontradoError("Evento");
  const tipo = tipoSolicitacaoParaStatus(ev.status);
  if (!tipo) throw new DomainError("Este evento não está aceitando solicitações no momento.");
  if (tipo === "PRE_REUNIAO") await verificarJanelaPreReuniao(tx, ev);
  const codigo = await proximoCodigo(tx, "solicitacao");
  const [s] = await tx.insert(solicitacoes).values({ codigo, eventoId, areaId, tipo, status: "RASCUNHO", criadoPorId: usuario.id, atualizadoPorId: usuario.id }).returning();
  await registrarHistorico(tx, {
    eventoId,
    entidade: "solicitacao",
    entidadeId: s.id,
    acao: "RASCUNHO_CRIADO",
    descricao: `Rascunho ${s.codigo} criado — ${tipo === "PRE_REUNIAO" ? "necessidade pré-reunião" : "alteração pós-ata"}`,
    usuarioId: usuario.id,
  });
  return s;
}

export async function criarRascunho(usuario: UsuarioAtual, eventoId: string, areaId?: string | null) {
  const db = await getDb();
  return db.transaction((tx) => criarRascunhoTx(tx, usuario, eventoId, areaId));
}

export async function atualizarCabecalho(usuario: UsuarioAtual, id: string, dados: { titulo: string | null; observacao: string | null }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await carregarEditavel(tx, usuario, id, { travar: true });
    await tx.update(solicitacoes).set({ ...dados, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
  });
}

type DadosItem = ItemRascunho & { justificativa?: string | null };

/** Valida e resolve as referências de um item (projeto/peça/avulso/linha da ata). */
async function prepararItem(tx: Executor, s: { eventoId: string; tipo: "PRE_REUNIAO" | "ALTERACAO"; areaId: string }, dados: DadosItem, usuario?: UsuarioAtual) {
  validarItem(dados);
  if (s.tipo === "PRE_REUNIAO" && dados.operacao !== "ADICIONAR") throw new DomainError("Necessidades pré-reunião só podem adicionar itens.");
  const valores: Partial<typeof solicitacaoItens.$inferInsert> = {
    operacao: dados.operacao,
    quantidadeSolicitada: dados.operacao === "REMOVER" ? 0 : dados.quantidadeSolicitada,
    destino: dados.destino ?? null,
    justificativa: dados.justificativa ?? null,
    descricoes: descricoesParaGravar(dados.operacao, dados.quantidadeSolicitada, dados.descricoes, Boolean(dados.semDescricao)),
    semDescricao: dados.operacao === "ADICIONAR" && Boolean(dados.semDescricao),
    projetoId: null,
    projetoVersaoId: null,
    pecaId: null,
    descricaoLivre: null,
    eventoItemId: null,
    ajustesBom: null,
  };
  if (dados.operacao === "ADICIONAR") {
    if (dados.projetoId) {
      const p = await tx.query.projetos.findFirst({ where: eq(projetos.id, dados.projetoId) });
      if (!p || !p.ativo) throw new DomainError("Projeto padrão inativo ou inexistente.");
      const snap = await snapshotBom(tx, p.id);
      valores.projetoId = p.id;
      valores.projetoVersaoId = snap.versaoId;
      // Ajustes só sobre peças que fazem parte do projeto; o resultado nunca fica negativo.
      // Exceção: tenda aceita as peças por local do próprio kit (fechamento, calha) como extra.
      const ajustes: AjusteBom[] = [];
      const extras = extrasPermitidosTenda(snap.bom.map((l) => l.codigo));
      for (const a of dados.ajustesBom ?? []) {
        if (!a.quantidade) continue;
        const linha = snap.bom.find((l) => l.pecaId === a.pecaId);
        if (!linha && extras.length > 0 && a.quantidade > 0) {
          const extra = await tx.query.pecas.findFirst({ where: and(eq(pecas.id, a.pecaId), eq(pecas.ativo, true)) });
          if (extra && extras.includes(extra.codigo)) {
            ajustes.push({ pecaId: extra.id, codigo: extra.codigo, nome: extra.nome, quantidade: a.quantidade, setor: extra.setor, unidade: extra.unidade });
            continue;
          }
        }
        if (!linha) throw new ValidacaoError("Só dá para ajustar peças que fazem parte do projeto.");
        if (linha.quantidade + a.quantidade < 0) throw new ValidacaoError(`${linha.nome}: o projeto tem ${linha.quantidade}; não dá para tirar ${Math.abs(a.quantidade)}.`);
        ajustes.push({ pecaId: linha.pecaId, codigo: linha.codigo, nome: linha.nome, quantidade: a.quantidade });
      }
      valores.ajustesBom = ajustes.length ? ajustes : null;
    } else if (dados.pecaId) {
      const pc = await tx.query.pecas.findFirst({ where: eq(pecas.id, dados.pecaId) });
      if (!pc || !pc.ativo) throw new DomainError("Peça inativa ou inexistente.");
      valores.pecaId = pc.id;
    } else {
      valores.descricaoLivre = (dados.descricaoLivre ?? "").trim();
    }
  } else {
    const linha = await tx.query.eventoItens.findFirst({
      where: and(eq(eventoItens.id, dados.eventoItemId ?? ""), eq(eventoItens.eventoId, s.eventoId), eq(eventoItens.ativo, true)),
    });
    if (!linha) throw new DomainError("A linha da ata escolhida não existe mais.");
    // Uma área não altera nem remove o que outra pediu; linha sem área é da logística e fica com ela.
    const podeMexer = (usuario && pode(usuario, "solicitacao.ver_todas")) || linha.areaId === s.areaId;
    if (!podeMexer) throw new DomainError("Esta linha da ata é de outra área. Peça a alteração à logística.");
    valores.eventoItemId = linha.id;
    if (dados.operacao === "ALTERAR_QUANTIDADE" && dados.quantidadeSolicitada === linha.quantidade) {
      throw new ValidacaoError("A nova quantidade é igual à atual.", { quantidadeSolicitada: "Informe uma quantidade diferente." });
    }
  }
  return valores as typeof solicitacaoItens.$inferInsert;
}

export async function salvarItem(usuario: UsuarioAtual, solicitacaoId: string, itemId: string | null, dados: DadosItem) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await carregarEditavel(tx, usuario, solicitacaoId, { travar: true });
    const valores = await prepararItem(tx, s, dados, usuario);
    if (itemId) {
      if (!s.itens.some((i) => i.id === itemId)) throw new NaoEncontradoError("Item");
      await tx.update(solicitacaoItens).set(valores).where(eq(solicitacaoItens.id, itemId));
    }
    const id = itemId ?? (await tx.insert(solicitacaoItens).values({ ...valores, solicitacaoId, ordem: s.itens.length }).returning())[0].id;
    await tx.update(solicitacoes).set({ atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(solicitacoes.id, solicitacaoId));
    return id;
  });
}

export async function excluirRascunho(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const s = await carregarEditavel(tx, usuario, id, { permitirEventoFechado: true, travar: true });
    if (s.status !== "RASCUNHO") throw new DomainError("Só rascunhos podem ser excluídos. Use cancelar.");
    await tx.update(solicitacoes).set({ excluida: true }).where(and(eq(solicitacoes.id, id), eq(solicitacoes.status, "RASCUNHO")));
  });
}

export type DadosSolicitacaoCompleta = {
  id?: string | null;
  eventoId: string;
  /** Área em nome da qual se pede (escolhida no formulário). */
  areaId?: string | null;
  titulo: string | null;
  observacao: string | null;
  enviar: boolean;
  itens: DadosItem[];
};

/** O que precisa estar preenchido para enviar (título, ao menos um item, descrições das unidades). */
function validarParaEnvio(dados: Pick<DadosSolicitacaoCompleta, "titulo" | "itens">) {
  const campos: Record<string, string> = {};
  if (!dados.titulo) campos.titulo = MSG_TITULO_OBRIGATORIO;
  if (dados.itens.length === 0) campos.itens = "Adicione ao menos um item.";
  const semDescricao = dados.itens.filter((i) => faltamDescricoes(i) > 0).length;
  if (semDescricao) campos.descricoes = MSG_DESCRICOES(semDescricao);
  const faltas = Object.values(campos);
  if (faltas.length) throw new ValidacaoError(faltas.length === 1 ? faltas[0] : "Falta preencher antes de enviar.", campos);
}

/**
 * Necessidade pré-reunião já enviada, editada antes da reunião (evento em preparação). Tudo numa
 * transação só: as linhas que ela tinha gerado na ata saem (ficam inativas, para consulta), os itens
 * são trocados e o pedido é registrado de novo na ata. Se qualquer passo falhar, nada muda — o pedido
 * original continua valendo. Linhas que a logística já ajustou travam a edição (o ajuste não se perde).
 */
export async function editarPreReuniaoEnviada(usuario: UsuarioAtual, dados: DadosSolicitacaoCompleta & { id: string }): Promise<{ id: string; codigo: string }> {
  exigir(usuario, "solicitacao.criar");
  validarParaEnvio(dados);
  dados.itens.forEach((i) => validarItem(i));
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, dados.id), eq(solicitacoes.excluida, false)), columns: { eventoId: true, areaId: true } });
    if (!previa) throw new NaoEncontradoError("Solicitação");
    if (!podeEditarSolicitacao(usuario, previa)) throw new SemPermissaoError("Só usuários da área da solicitação podem editá-la.");
    await bloquearEvento(tx, previa.eventoId);
    const s = await tx.query.solicitacoes.findFirst({
      where: eq(solicitacoes.id, dados.id),
      with: { evento: true, area: { columns: { nome: true } }, itens: { columns: { id: true, eventoItemGeradoId: true, quantidadeAtendida: true, quantidadeSolicitada: true } } },
    });
    if (!s) throw new NaoEncontradoError("Solicitação");
    if (!podeEditarPreReuniaoEnviada(s.tipo, s.status, s.evento.status)) {
      throw new DomainError(s.evento.status === "PREPARACAO" ? "Esta solicitação não pode mais ser editada." : "A reunião de OS já começou: a partir de agora, mudanças entram como alteração depois da ata.");
    }
    await verificarJanelaPreReuniao(tx, s.evento);

    // Linhas da ata geradas por este pedido: se a logística já mexeu, a edição espera por ela.
    const geradas = s.itens.map((i) => i.eventoItemGeradoId).filter((x): x is string => Boolean(x));
    if (geradas.length) {
      const linhas = await tx.query.eventoItens.findMany({ where: inArray(eventoItens.id, geradas), columns: { id: true, ativo: true, quantidade: true, conferidoEm: true } });
      const esperada = new Map(s.itens.map((i) => [i.eventoItemGeradoId, i.quantidadeAtendida ?? i.quantidadeSolicitada]));
      const ajustesLogistica = await tx.query.historico.findMany({ where: and(eq(historico.entidade, "evento_item"), inArray(historico.entidadeId, geradas), inArray(historico.acao, ACOES_COM_MOTIVO)), columns: { id: true } });
      const mexidas = linhas.filter((l) => !l.ativo || l.conferidoEm || l.quantidade !== esperada.get(l.id));
      if (mexidas.length || ajustesLogistica.length) {
        throw new DomainError("A logística já ajustou itens deste pedido na ata. Para mudar, fale com a logística ou envie outra solicitação com o que falta.");
      }
      await tx.update(eventoItens).set({ ativo: false, removidoEm: new Date(), removidoPorId: usuario.id }).where(inArray(eventoItens.id, geradas));
    }

    const antes = s.itens.length;
    await tx.delete(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, s.id));
    let ordem = 0;
    for (const item of dados.itens) {
      const valores = await prepararItem(tx, s, item, usuario);
      await tx.insert(solicitacaoItens).values({ ...valores, solicitacaoId: s.id, ordem: ordem++ });
    }
    await tx.update(solicitacoes).set({ titulo: dados.titulo, observacao: dados.observacao, status: "ENVIADA", atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(solicitacoes.id, s.id));
    await registrarPreReuniaoNaAta(tx, usuario, s.id);
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: s.id,
      acao: "EDITADA",
      descricao: `${s.codigo} editada antes da reunião pela ${s.area.nome} — ${dados.itens.length} ${dados.itens.length === 1 ? "item" : "itens"} (antes ${antes}); a ata foi atualizada`,
      usuarioId: usuario.id,
    });
    await notificar(tx, {
      usuarioIds: await usuariosLogistica(tx),
      tipo: "SOLICITACAO_EDITADA",
      titulo: `Pedido alterado: ${s.codigo} · ${s.area.nome}`,
      mensagem: `${s.evento.nome} · agora com ${dados.itens.length} ${dados.itens.length === 1 ? "item" : "itens"}. A ata já está atualizada; confira na reunião de OS.`,
      link: `/solicitacoes/${s.id}`,
      excetoUsuarioId: usuario.id,
    });
    return { id: s.id, codigo: s.codigo };
  });
}

/**
 * Formulário único de solicitação (handoff §5.11): cria ou atualiza o rascunho com todos os
 * itens de uma vez (uma transação só: ou grava tudo, ou nada) e, se pedido, envia. Se o envio
 * falhar por regra do evento, o rascunho fica salvo e o erro volta em `erroEnvio`.
 */
export async function salvarSolicitacaoCompleta(usuarioSessao: UsuarioAtual, dados: DadosSolicitacaoCompleta): Promise<{ id: string; codigo: string; enviada: boolean; erroEnvio: string | null }> {
  exigir(usuarioSessao, "solicitacao.criar");
  // A área escolhida agora passa a ser do usuário já nesta gravação (a sessão só a vê na próxima requisição).
  let usuario = usuarioSessao;
  if (dados.enviar) validarParaEnvio(dados);
  dados.itens.forEach((i) => validarItem(i));

  const db = await getDb();
  const { id, codigo } = await db.transaction(async (tx) => {
    let s;
    if (dados.id) {
      s = await carregarEditavel(tx, usuario, dados.id, { travar: true });
      if (s.eventoId !== dados.eventoId) throw new DomainError("Para trocar de evento, exclua este rascunho e crie outro.");
    } else {
      const novo = await criarRascunhoTx(tx, usuario, dados.eventoId, dados.areaId);
      usuario = { ...usuario, areasPedidas: [...(usuario.areasPedidas ?? []), novo.areaId] };
      s = await carregarEditavel(tx, usuario, novo.id);
    }
    await tx
      .update(solicitacoes)
      .set({ titulo: dados.titulo, observacao: dados.observacao, atualizadoPorId: usuario.id, atualizadoEm: new Date() })
      .where(eq(solicitacoes.id, s.id));
    await tx.delete(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, s.id));
    let ordem = 0;
    for (const item of dados.itens) {
      const valores = await prepararItem(tx, s, item, usuario);
      await tx.insert(solicitacaoItens).values({ ...valores, solicitacaoId: s.id, ordem: ordem++ });
    }
    return { id: s.id, codigo: s.codigo };
  });

  if (!dados.enviar) return { id, codigo, enviada: false, erroEnvio: null };
  try {
    await enviarSolicitacao(usuario, id);
    return { id, codigo, enviada: true, erroEnvio: null };
  } catch (e) {
    if (e instanceof DomainError) return { id, codigo, enviada: false, erroEnvio: e.message };
    throw e;
  }
}
