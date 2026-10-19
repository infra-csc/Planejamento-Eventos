import { and, asc, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventoItens, eventos, solicitacaoItens, solicitacoes, usuarios } from "@/server/db/schema";
import { parseDateTimeLocal } from "@/lib/format";
import { proximoCodigo } from "../support";
import { inserirEvento } from "./cadastro";

/**
 * Evento de TESTE copiado de um evento real, para a logística ensaiar a conferência e as exportações
 * com dados de verdade (Yan, 19/10, véspera das reuniões de 20/10). Copia as solicitações pré-reunião
 * enviadas (códigos SOL novos), os itens delas e as linhas ativas da ata — tendas por local, regras da
 * logística, linhas incluídas à mão —, tudo sem conferência. O evento original não muda; ninguém é
 * notificado; o nome começa com "TESTE ·" e o evento pode ser cancelado depois do ensaio.
 *
 * Uma vez só: a marca em `configuracoes` entra na mesma transação (outro start, outra instância).
 * Sem o evento de origem (banco local, outro ambiente), não faz nada e não grava a marca.
 */
export const COPIA_TESTE = { chave: "teste:copia-evento:EVT-0215:2026-10-19", codigoOrigem: "EVT-0215", reuniao: "2026-10-20T09:00" } as const;

export type ResultadoCopiaTeste = { feito: false; motivo: string } | { feito: true; codigo: string; nome: string; solicitacoes: string[]; linhas: number };

export async function copiarEventoParaTeste(copia: { chave: string; codigoOrigem: string; reuniao: string } = COPIA_TESTE): Promise<ResultadoCopiaTeste> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const origem = await tx.query.eventos.findFirst({ where: eq(eventos.codigo, copia.codigoOrigem) });
    if (!origem) return { feito: false, motivo: `evento ${copia.codigoOrigem} não existe neste banco` };
    const [marca] = await tx
      .insert(configuracoes)
      .values({ chave: copia.chave, valor: JSON.stringify({ status: "em andamento" }) })
      .onConflictDoNothing({ target: configuracoes.chave })
      .returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false, motivo: "já copiado" };

    const admins = await tx.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(and(eq(usuarios.perfil, "ADMIN"), eq(usuarios.ativo, true))).orderBy(asc(usuarios.criadoEm));
    const autor = admins.find((u) => /^yan\b/i.test(u.nome)) ?? admins[0];
    if (!autor) throw new Error("Nenhum administrador ativo para criar o evento de teste.");
    const dataReuniao = parseDateTimeLocal(copia.reuniao);
    if (!dataReuniao) throw new Error(`Reunião inválida: ${copia.reuniao}`);

    // Mesmas datas do original (a OS e as exportações saem como as dele); sem data de carga, para não
    // entrar no calendário do galpão.
    const ev = await inserirEvento(
      tx,
      autor,
      {
        nome: `TESTE · ${origem.nome}`,
        cliente: origem.cliente,
        local: origem.local,
        dataInicio: origem.dataInicio,
        dataMontagem: origem.dataMontagem,
        dataFim: origem.dataFim,
        dataDesmontagem: origem.dataDesmontagem,
        dataCarga: null,
        dataReuniao,
        responsavelId: origem.responsavelId,
      },
      `cópia de teste de ${origem.codigo}`,
    );

    // Solicitações pré-reunião enviadas, com os itens (mapa id antigo → novo para ligar às linhas da ata).
    const sols = await tx.query.solicitacoes.findMany({
      where: and(eq(solicitacoes.eventoId, origem.id), eq(solicitacoes.tipo, "PRE_REUNIAO"), eq(solicitacoes.excluida, false), notInArray(solicitacoes.status, ["RASCUNHO", "DEVOLVIDA", "CANCELADA"])),
      with: { itens: { orderBy: [asc(solicitacaoItens.ordem), asc(solicitacaoItens.criadoEm)] } },
      orderBy: [asc(solicitacoes.codigo)],
    });
    const novoItem = new Map<string, string>();
    const codigos: string[] = [];
    const agora = new Date();
    for (const s of sols) {
      const codigo = await proximoCodigo(tx, "solicitacao");
      codigos.push(codigo);
      const [ns] = await tx
        .insert(solicitacoes)
        .values({
          codigo,
          eventoId: ev.id,
          areaId: s.areaId,
          tipo: s.tipo,
          status: s.status,
          titulo: s.titulo,
          observacao: s.observacao,
          criadoPorId: s.criadoPorId,
          enviadaEm: agora,
          respondidaEm: s.respondidaEm ? agora : null,
          criadoEm: agora,
          atualizadoEm: agora,
        })
        .returning({ id: solicitacoes.id });
      for (const i of s.itens) {
        const [ni] = await tx
          .insert(solicitacaoItens)
          .values({
            solicitacaoId: ns.id,
            ordem: i.ordem,
            operacao: i.operacao,
            projetoId: i.projetoId,
            projetoVersaoId: i.projetoVersaoId,
            pecaId: i.pecaId,
            descricaoLivre: i.descricaoLivre,
            quantidadeSolicitada: i.quantidadeSolicitada,
            destino: i.destino,
            ajustesBom: i.ajustesBom,
            descricoes: i.descricoes,
            semDescricao: i.semDescricao,
            justificativa: i.justificativa,
            status: i.status,
            quantidadeAtendida: i.quantidadeAtendida,
            quantidadeAnterior: i.quantidadeAnterior,
            observacaoLogistica: i.observacaoLogistica,
            criadoEm: agora,
            atualizadoEm: agora,
          })
          .returning({ id: solicitacaoItens.id });
        novoItem.set(i.id, ni.id);
      }
    }

    // Linhas ativas da ata, sem conferência; a linha que vinha de um item copiado aponta para a cópia.
    const linhas = await tx.select().from(eventoItens).where(and(eq(eventoItens.eventoId, origem.id), eq(eventoItens.ativo, true))).orderBy(asc(eventoItens.criadoEm));
    const novaLinha = new Map<string, string>();
    for (const l of linhas) {
      const [nl] = await tx
        .insert(eventoItens)
        .values({
          eventoId: ev.id,
          tipo: l.tipo,
          projetoId: l.projetoId,
          projetoVersaoId: l.projetoVersaoId,
          bomSnapshot: l.bomSnapshot,
          pecaId: l.pecaId,
          descricaoLivre: l.descricaoLivre,
          quantidade: l.quantidade,
          destino: l.destino,
          areaId: l.areaId,
          origem: l.origem,
          solicitacaoItemId: l.solicitacaoItemId ? (novoItem.get(l.solicitacaoItemId) ?? null) : null,
          justificativaAjuste: l.justificativaAjuste,
          regra: l.regra,
          regraManual: l.regraManual,
          criadoPorId: autor.id,
          criadoEm: agora,
          atualizadoEm: agora,
        })
        .returning({ id: eventoItens.id });
      novaLinha.set(l.id, nl.id);
    }
    // Item que gerou uma linha passa a apontar para a linha copiada.
    const gerados = sols.flatMap((s) => s.itens).filter((i) => i.eventoItemGeradoId && novaLinha.has(i.eventoItemGeradoId));
    for (const i of gerados) await tx.update(solicitacaoItens).set({ eventoItemGeradoId: novaLinha.get(i.eventoItemGeradoId!)! }).where(eq(solicitacaoItens.id, novoItem.get(i.id)!));

    await tx
      .update(configuracoes)
      .set({ valor: JSON.stringify({ status: "feito", em: agora.toISOString(), evento: ev.codigo, origem: origem.codigo, solicitacoes: codigos, linhas: linhas.length }) })
      .where(eq(configuracoes.chave, copia.chave));
    return { feito: true, codigo: ev.codigo, nome: ev.nome, solicitacoes: codigos, linhas: linhas.length };
  });
}
