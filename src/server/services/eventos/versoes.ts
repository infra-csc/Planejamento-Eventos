import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventoItens, eventos, historico, projetoVersoes, projetos, solicitacaoItens } from "@/server/db/schema";
import { aplicarAjustesBom } from "@/domain/os";
import { contrapesoDaRegraAntiga } from "@/domain/regras-kit";
import { gerarOsVersao } from "../os";
import { bloquearEvento, notificar, registrarHistorico, usuariosComPedidoNoEvento, type Executor } from "../support";
import { snapshotBom } from "./ata";
import { sincronizarRegrasAta } from "./regras-kit";

/** Eventos que ainda recebem a versão nova do projeto: antes da ata e com a ata fechada (aí sai nova OS). */
const STATUS_ATUALIZAVEIS = ["PREPARACAO", "EM_REUNIAO", "ABERTO"] as const;

export type ResultadoAtualizacao = {
  /** Códigos dos eventos que tiveram linhas atualizadas. */
  eventos: string[];
  linhas: number;
  /** Linhas que ficaram na versão anterior: peças ajustadas uma a uma no evento (a logística decide na ata). */
  pendentes: Array<{ evento: string; projeto: string }>;
};

/**
 * Projeto editado (nova versão) vale nos eventos que usam ele: cada linha ativa em versão anterior passa para a
 * versão atual, com os ajustes de peças que vieram do pedido (como "atualizar para vN" da aba Ata). Linha com
 * peças ajustadas uma a uma no evento fica como está (o ajuste se perderia) e volta em `pendentes`.
 * Com a ata fechada sai uma versão nova da OS por evento. As linhas da regra antiga de tina e pallet diminuem
 * o que os projetos passaram a trazer, para o contrapeso não contar duas vezes.
 */
export async function atualizarProjetosNosEventos(tx: Executor, opcoes: { projetoId?: string; usuarioId: string | null }): Promise<ResultadoAtualizacao> {
  const defasadas = (
    await tx
      .select({ id: eventoItens.id, eventoId: eventoItens.eventoId, projetoId: eventoItens.projetoId, solicitacaoItemId: eventoItens.solicitacaoItemId, versaoNumero: projetoVersoes.numero, versaoAtual: projetos.versaoAtual, nome: projetos.nome, codigoEvento: eventos.codigo, nomeEvento: eventos.nome, status: eventos.status })
      .from(eventoItens)
      .innerJoin(eventos, eq(eventos.id, eventoItens.eventoId))
      .innerJoin(projetos, eq(projetos.id, eventoItens.projetoId))
      .innerJoin(projetoVersoes, eq(projetoVersoes.id, eventoItens.projetoVersaoId))
      .where(and(eq(eventoItens.ativo, true), eq(eventoItens.tipo, "PROJETO"), inArray(eventos.status, [...STATUS_ATUALIZAVEIS]), ...(opcoes.projetoId ? [eq(eventoItens.projetoId, opcoes.projetoId)] : [])))
  ).filter((l) => l.versaoNumero !== l.versaoAtual);
  const resultado: ResultadoAtualizacao = { eventos: [], linhas: 0, pendentes: [] };
  if (!defasadas.length) return resultado;

  const ajustadas = new Set(
    (await tx.select({ id: historico.entidadeId }).from(historico).where(and(eq(historico.entidade, "evento_item"), eq(historico.acao, "PECA_PROJETO_AJUSTADA"), inArray(historico.entidadeId, defasadas.map((l) => l.id))))).map((h) => h.id),
  );
  const snaps = new Map<string, Awaited<ReturnType<typeof snapshotBom>>>();
  const porEvento = new Map<string, typeof defasadas>();
  for (const l of defasadas) porEvento.set(l.eventoId, [...(porEvento.get(l.eventoId) ?? []), l]);

  for (const [eventoId, linhas] of porEvento) {
    await bloquearEvento(tx, eventoId);
    const atualizadas: string[] = [];
    for (const l of linhas) {
      if (ajustadas.has(l.id)) {
        resultado.pendentes.push({ evento: l.codigoEvento, projeto: l.nome });
        continue;
      }
      const snap = snaps.get(l.projetoId!) ?? (await snapshotBom(tx, l.projetoId!));
      snaps.set(l.projetoId!, snap);
      const origem = l.solicitacaoItemId ? await tx.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, l.solicitacaoItemId), columns: { ajustesBom: true } }) : null;
      const antesDaAta = l.status !== "ABERTO";
      await tx
        .update(eventoItens)
        .set({ projetoVersaoId: snap.versaoId, bomSnapshot: aplicarAjustesBom(snap.bom, origem?.ajustesBom), atualizadoEm: new Date(), ...(antesDaAta ? { conferidoEm: null, conferidoPorId: null } : {}) })
        .where(eq(eventoItens.id, l.id));
      await registrarHistorico(tx, { eventoId, entidade: "evento_item", entidadeId: l.id, acao: "ATUALIZACAO_VERSAO", descricao: `${l.nome}: atualizado de v${l.versaoNumero} para v${snap.numero} (projeto editado)`, usuarioId: opcoes.usuarioId });
      atualizadas.push(`${l.nome} v${snap.numero}`);
    }
    if (!atualizadas.length) continue;
    await encolherContrapesoAntigo(tx, eventoId, opcoes.usuarioId);
    await sincronizarRegrasAta(tx, eventoId, null);
    if (linhas[0].status === "ABERTO") {
      const texto = `Projetos atualizados: ${[...new Set(atualizadas)].join(", ")}`;
      await gerarOsVersao(tx, eventoId, "ATUALIZACAO_PROJETO", opcoes.usuarioId, texto);
      // Projeto editado na Biblioteca muda a OS com a ata fechada: quem pediu algo no evento fica sabendo, como em
      // todo ajuste depois da ata (28/10; antes só a logística era avisada). A rotina de subida (sem projeto) não avisa.
      if (opcoes.projetoId) {
        await notificar(tx, {
          usuarioIds: await usuariosComPedidoNoEvento(tx, eventoId),
          tipo: "ATA_AJUSTE",
          // Nome do evento, como nos outros avisos de ajuste (antes o código; auditoria 28/10, nº 188).
          titulo: `Ajuste na OS: ${linhas[0].nomeEvento}`,
          mensagem: `${texto} (projeto editado na Biblioteca).`,
          link: `/eventos/${eventoId}`,
          ...(opcoes.usuarioId ? { excetoUsuarioId: opcoes.usuarioId } : {}),
        });
      }
    }
    resultado.eventos.push(linhas[0].codigoEvento);
    resultado.linhas += atualizadas.length;
  }
  return resultado;
}

/** Linhas da regra antiga (tina e pallet) que não foram ajustadas à mão: descem para o que ainda falta. */
async function encolherContrapesoAntigo(tx: Executor, eventoId: string, usuarioId: string | null) {
  const linhas = await tx.query.eventoItens.findMany({
    where: and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)),
    with: { projeto: { columns: { nome: true, categoria: true } }, peca: { columns: { codigo: true, nome: true } } },
  });
  const falta = contrapesoDaRegraAntiga(linhas.filter((l) => !l.regra).map((l) => ({ tipo: l.tipo, quantidade: l.quantidade, projeto: l.projeto, pecaCodigo: l.peca?.codigo ?? null, bom: l.bomSnapshot })));
  for (const l of linhas) {
    if ((l.regra !== "tina-contrapeso" && l.regra !== "pallet-ferro") || l.regraManual) continue;
    const novo = falta[l.regra];
    if (novo >= l.quantidade) continue;
    await tx
      .update(eventoItens)
      .set(novo === 0 ? { ativo: false, removidoEm: new Date(), removidoPorId: usuarioId } : { quantidade: novo, atualizadoEm: new Date() })
      .where(eq(eventoItens.id, l.id));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: l.id,
      acao: "REGRA_KIT",
      descricao: `${l.peca?.nome ?? "Contrapeso"}: ${l.quantidade} → ${novo} (agora vem dentro dos projetos)`,
      usuarioId,
      dadosAntes: { quantidade: l.quantidade },
      dadosDepois: { quantidade: novo, regra: l.regra },
    });
  }
}

/**
 * Uma vez só, ao subir (20/10): os eventos que ainda usam versão anterior de algum projeto passam para a atual
 * (stands e palcos com tina e pallet, testeira de Manaus e do Rio...). A marca em `configuracoes` entra na mesma
 * transação e guarda o resultado.
 */
export async function atualizarProjetosDefasados(chave = "projetos:eventos-versao-atual:2026-10-20"): Promise<({ feito: true } & ResultadoAtualizacao) | { feito: false }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx.insert(configuracoes).values({ chave, valor: JSON.stringify({ status: "em andamento" }) }).onConflictDoNothing({ target: configuracoes.chave }).returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };
    const r = await atualizarProjetosNosEventos(tx, { usuarioId: null });
    await tx.update(configuracoes).set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), ...r }) }).where(eq(configuracoes.chave, chave));
    return { feito: true, ...r };
  });
}
