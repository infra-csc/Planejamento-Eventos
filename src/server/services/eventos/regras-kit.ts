import { eq, inArray } from "drizzle-orm";
import { eventoItens, eventos, pecas } from "@/server/db/schema";
import { calcularRegrasKit, REGRAS_KIT } from "@/domain/regras-kit";
import { registrarHistorico, type Executor } from "../support";

/**
 * Deixa as linhas das regras da logística (tina, pallet de ferro, saco de ráfia) com a quantidade que a
 * ata pede agora. Só antes de a ata fechar (preparação e reunião); depois disso, mudança é ajuste à mão.
 * Linha que a logística ajustou à mão (`regraManual`) não é mexida. Peça que o catálogo não tem é ignorada.
 * Chamar no fim de toda transação que muda as linhas da ata.
 */
export async function sincronizarRegrasAta(tx: Executor, eventoId: string, usuarioId: string | null) {
  const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
  if (!ev || (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO")) return 0;
  const linhas = await tx.query.eventoItens.findMany({
    where: eq(eventoItens.eventoId, eventoId),
    with: { projeto: { columns: { nome: true, categoria: true } }, peca: { columns: { codigo: true } } },
  });
  const alvo = calcularRegrasKit(
    linhas
      .filter((l) => l.ativo && !l.regra)
      .map((l) => ({ tipo: l.tipo, quantidade: l.quantidade, projeto: l.projeto, pecaCodigo: l.peca?.codigo ?? null, bom: l.bomSnapshot })),
  );
  const ps = await tx
    .select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome })
    .from(pecas)
    .where(inArray(pecas.codigo, REGRAS_KIT.map((r) => r.codigoPeca)));
  let mudancas = 0;
  const agora = new Date();
  for (const r of alvo) {
    const p = ps.find((x) => x.codigo === r.codigoPeca);
    if (!p) continue;
    const existente = linhas.find((l) => l.regra === r.regra);
    const antes = existente?.ativo ? existente.quantidade : 0;
    // Mesma quantidade e mesma peça: nada a fazer (a peça muda quando a regra troca, ex.: tina 500 → 1000 l).
    if (existente?.regraManual || (antes === r.quantidade && (!existente || existente.pecaId === p.id))) continue;
    if (r.quantidade === 0 && !existente?.ativo) continue;
    let linhaId: string;
    if (!existente) {
      const [nova] = await tx
        .insert(eventoItens)
        .values({ eventoId, tipo: "PECA", pecaId: p.id, quantidade: r.quantidade, origem: "AJUSTE_LOGISTICA", regra: r.regra, criadoPorId: usuarioId })
        .returning({ id: eventoItens.id });
      linhaId = nova.id;
    } else {
      linhaId = existente.id;
      // Quantidade mudou: precisa conferir de novo.
      await tx
        .update(eventoItens)
        .set(
          r.quantidade === 0
            ? { ativo: false, removidoEm: agora, removidoPorId: usuarioId, conferidoEm: null, conferidoPorId: null }
            : { ativo: true, quantidade: r.quantidade, pecaId: p.id, removidoEm: null, removidoPorId: null, conferidoEm: null, conferidoPorId: null, atualizadoEm: agora },
        )
        .where(eq(eventoItens.id, existente.id));
    }
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: "REGRA_KIT",
      descricao: `Regra da logística (${r.descricao}): ${p.nome} ${antes} → ${r.quantidade}`,
      usuarioId,
      dadosAntes: { quantidade: antes },
      dadosDepois: { quantidade: r.quantidade, regra: r.regra },
    });
    mudancas++;
  }
  return mudancas;
}
