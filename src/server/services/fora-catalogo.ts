import { and, desc, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, eventos, pecas, projetos, solicitacaoItens, solicitacoes, usuarios } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { criarPeca, type DadosPeca } from "./catalogo";
import { snapshotBom } from "./eventos";
import { gerarOsVersao } from "./os";
import { bloquearEvento, notificar, registrarHistorico, usuariosDaArea } from "./support";

/**
 * Itens pedidos como "Outro item (descrever)" que estão na ata/OS sem vínculo com o catálogo,
 * em eventos ainda ativos. É a fila da logística para cadastrar ou vincular.
 */
export async function listarItensForaDoCatalogo(usuario: UsuarioAtual) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db
    .select({
      id: eventoItens.id,
      descricao: eventoItens.descricaoLivre,
      quantidade: eventoItens.quantidade,
      destino: eventoItens.destino,
      criadoEm: eventoItens.criadoEm,
      area: areas.nome,
      eventoId: eventos.id,
      eventoCodigo: eventos.codigo,
      eventoNome: eventos.nome,
      eventoStatus: eventos.status,
      solicitacaoId: solicitacoes.id,
      solicitacaoCodigo: solicitacoes.codigo,
      solicitante: usuarios.nome,
    })
    .from(eventoItens)
    .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
    .leftJoin(areas, eq(eventoItens.areaId, areas.id))
    .leftJoin(solicitacaoItens, eq(eventoItens.solicitacaoItemId, solicitacaoItens.id))
    .leftJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .leftJoin(usuarios, eq(solicitacoes.criadoPorId, usuarios.id))
    .where(and(eq(eventoItens.tipo, "AVULSO"), eq(eventoItens.ativo, true), notInArray(eventos.status, ["ENCERRADO", "CANCELADO"])))
    .orderBy(desc(eventoItens.criadoEm));
}

export type ItemForaCatalogo = Awaited<ReturnType<typeof listarItensForaDoCatalogo>>[number];

export type AlvoVinculo = { tipo: "PROJETO"; projetoId: string } | { tipo: "PECA"; pecaId: string } | { tipo: "NOVA_PECA"; peca: DadosPeca };

/** O que vincular: a linha da ata/OS ou o item da solicitação (antes de virar linha, numa alteração em análise). */
export type RefVinculo = { linhaId?: string | null; solicitacaoItemId?: string | null };

const itemAvulso = (i: { projetoId: string | null; pecaId: string | null; descricaoLivre: string | null; operacao: string }) => i.operacao === "ADICIONAR" && !i.projetoId && !i.pecaId && Boolean(i.descricaoLivre);

type Executor = Awaited<ReturnType<typeof getDb>> | Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

async function resolverVinculo(ex: Executor, ref: RefVinculo) {
  let linha = ref.linhaId ? await ex.query.eventoItens.findFirst({ where: eq(eventoItens.id, ref.linhaId) }) : undefined;
  const itemId = ref.solicitacaoItemId ?? linha?.solicitacaoItemId ?? null;
  const item = itemId ? await ex.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, itemId) }) : undefined;
  if (!linha && item) linha = await ex.query.eventoItens.findFirst({ where: eq(eventoItens.solicitacaoItemId, item.id), orderBy: (t, { desc }) => [desc(t.ativo), desc(t.criadoEm)] });
  const sol = item
    ? await ex.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, item.solicitacaoId), columns: { id: true, codigo: true, criadoPorId: true, areaId: true, eventoId: true, status: true } })
    : undefined;
  const eventoId = linha?.eventoId ?? sol?.eventoId ?? null;
  // Linha fora da ata (resposta corrigida para "não atendido") também recebe o vínculo: se voltar, já volta certa.
  const linhaPendente = Boolean(linha && linha.tipo === "AVULSO");
  const itemPendente = Boolean(item && itemAvulso(item) && sol && sol.status !== "CANCELADA");
  return { linha, item, sol, eventoId, linhaPendente, itemPendente };
}

/**
 * Liga um item descrito à mão a um projeto padrão ou peça do catálogo (existente ou cadastrada agora).
 * Atualiza o pedido da área e, se já existir, a linha da ata/OS, que passa a somar peças na OS.
 * O texto original fica guardado. Quem pediu é avisado, fica registro no histórico e, com a ata
 * já fechada e a linha alterada, sai nova versão da OS.
 */
export async function vincularAoCatalogo(usuario: UsuarioAtual, ref: RefVinculo, alvo: AlvoVinculo) {
  exigir(usuario, "ata.consolidar");
  if (!ref.linhaId && !ref.solicitacaoItemId) throw new ValidacaoError("Item não informado.");
  const db = await getDb();

  // Confere antes de cadastrar peça nova: não deixa peça órfã se o item não puder ser vinculado.
  const previa = await resolverVinculo(db, ref);
  if (!previa.eventoId) throw new NaoEncontradoError("Item");
  if (!previa.linhaPendente && !previa.itemPendente) throw new DomainError("Este item já está vinculado ao catálogo.");

  let pecaId: string | null = null;
  let projetoId: string | null = null;
  if (alvo.tipo === "NOVA_PECA") {
    if (!pode(usuario, "catalogo.gerenciar")) throw new DomainError("Seu perfil não cadastra peças. Vincule a uma peça ou projeto existente.");
    pecaId = (await criarPeca(usuario, alvo.peca)).id;
  } else if (alvo.tipo === "PECA") {
    pecaId = alvo.pecaId;
  } else {
    projetoId = alvo.projetoId;
  }
  if (!pecaId && !projetoId) throw new ValidacaoError("Escolha a peça ou o projeto.");
  const eventoId = previa.eventoId;
  const pecaNovaId = alvo.tipo === "NOVA_PECA" ? pecaId : null;

  const vincular = () => db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const { linha, item, sol, linhaPendente, itemPendente } = await resolverVinculo(tx, ref);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status === "ENCERRADO" || ev.status === "CANCELADO") throw new DomainError("O evento está encerrado; não aceita mudanças.");
    if (!linhaPendente && !itemPendente) throw new DomainError("Este item já está vinculado ao catálogo.");

    let rotulo: string;
    if (projetoId) {
      const pr = await tx.query.projetos.findFirst({ where: and(eq(projetos.id, projetoId), eq(projetos.ativo, true)) });
      if (!pr) throw new NaoEncontradoError("Projeto padrão");
      rotulo = `${pr.codigo} · ${pr.nome}`;
      if (linhaPendente && linha) {
        const snap = await snapshotBom(tx, projetoId);
        await tx.update(eventoItens).set({ tipo: "PROJETO", projetoId, projetoVersaoId: snap.versaoId, bomSnapshot: snap.bom }).where(eq(eventoItens.id, linha.id));
      }
    } else {
      const pc = await tx.query.pecas.findFirst({ where: and(eq(pecas.id, pecaId!), eq(pecas.ativo, true)) });
      if (!pc) throw new NaoEncontradoError("Peça");
      rotulo = `${pc.codigo} · ${pc.nome}`;
      if (linhaPendente && linha) await tx.update(eventoItens).set({ tipo: "PECA", pecaId: pc.id }).where(eq(eventoItens.id, linha.id));
    }
    if (itemPendente && item) await tx.update(solicitacaoItens).set(projetoId ? { projetoId } : { pecaId }).where(eq(solicitacaoItens.id, item.id));

    const original = linha?.descricaoLivre ?? item?.descricaoLivre ?? "item";
    const texto = `“${original}” vinculado a ${rotulo}${alvo.tipo === "NOVA_PECA" ? " (peça cadastrada agora)" : ""}`;
    await registrarHistorico(tx, {
      eventoId: ev.id,
      entidade: linha ? "evento_item" : "solicitacao_item",
      entidadeId: linha?.id ?? item!.id,
      acao: "ITEM_VINCULADO",
      descricao: sol ? `${sol.codigo} · ${texto}` : texto,
      usuarioId: usuario.id,
      dadosAntes: { tipo: "AVULSO", descricaoLivre: original },
      dadosDepois: { tipo: projetoId ? "PROJETO" : "PECA", projetoId, pecaId },
    });
    if (linhaPendente && linha?.ativo && ev.status === "ABERTO") await gerarOsVersao(tx, ev.id, "AJUSTE_LOGISTICA", usuario.id, texto);
    if (sol) {
      await notificar(tx, {
        usuarioIds: [sol.criadoPorId, ...(await usuariosDaArea(tx, sol.areaId))],
        tipo: "ITEM_VINCULADO",
        titulo: `${sol.codigo}: item vinculado ao catálogo`,
        mensagem: `${texto}. Agora ele soma as peças certas na OS.`,
        link: `/solicitacoes/${sol.id}`,
        excetoUsuarioId: usuario.id,
      });
    }
    return { rotulo };
  });

  try {
    return await vincular();
  } catch (e) {
    // A peça foi criada fora da transação: se o vínculo falhou, ela não pode ficar solta no catálogo.
    if (pecaNovaId) await db.update(pecas).set({ ativo: false }).where(eq(pecas.id, pecaNovaId)).catch(() => undefined);
    throw e;
  }
}

/** Contagem para o menu/painel: quantos itens aguardam cadastro ou vínculo. */
export async function contarItensForaDoCatalogo() {
  const db = await getDb();
  const rows = await db
    .select({ id: eventoItens.id })
    .from(eventoItens)
    .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
    .where(and(eq(eventoItens.tipo, "AVULSO"), eq(eventoItens.ativo, true), notInArray(eventos.status, ["ENCERRADO", "CANCELADO"])));
  return rows.length;
}
