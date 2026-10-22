import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventoItens, eventos, pecas } from "@/server/db/schema";
import { calcularRegrasKit, REGRAS_KIT } from "@/domain/regras-kit";
import { registrarHistorico, type Executor } from "../support";

/**
 * Deixa as linhas das regras da logística (tina, pallet de ferro, saco de ráfia) com a quantidade que a
 * ata pede agora. Só antes de a ata fechar (preparação e reunião); depois disso, mudança é ajuste à mão.
 * Linha que a logística ajustou à mão (`regraManual`) não é mexida. Peça que o catálogo não tem é ignorada.
 * Chamar no fim de toda transação que muda as linhas da ata.
 */
export async function sincronizarRegrasAta(tx: Executor, eventoId: string, usuarioId: string | null, opcoes: { ataFechada?: boolean; soRegras?: readonly string[] } = {}) {
  const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
  // Depois da ata, só quando a logística manda aplicar (correção de regra); quem chama gera a versão da OS.
  if (!ev || (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO" && !(opcoes.ataFechada && ev.status === "ABERTO"))) return 0;
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
    if (opcoes.soRegras && !opcoes.soRegras.includes(r.regra)) continue;
    const p = ps.find((x) => x.codigo === r.codigoPeca);
    if (!p) continue;
    const existente = linhas.find((l) => l.regra === r.regra);
    const antes = existente?.ativo ? existente.quantidade : 0;
    if (r.aDefinir) {
      // Linha "a definir": entra com 0 quando a regra vale e sai quando deixa de valer; o número é da conferência.
      if (existente?.regraManual || Boolean(existente?.ativo) === Boolean(r.presente)) continue;
      let id = existente?.id;
      if (!existente) {
        const [nova] = await tx.insert(eventoItens).values({ eventoId, tipo: "PECA", pecaId: p.id, quantidade: 0, origem: "AJUSTE_LOGISTICA", regra: r.regra, criadoPorId: usuarioId }).returning({ id: eventoItens.id });
        id = nova.id;
      } else {
        await tx
          .update(eventoItens)
          .set(r.presente ? { ativo: true, quantidade: 0, pecaId: p.id, removidoEm: null, removidoPorId: null, conferidoEm: null, conferidoPorId: null, atualizadoEm: agora } : { ativo: false, removidoEm: agora, removidoPorId: usuarioId, conferidoEm: null, conferidoPorId: null })
          .where(eq(eventoItens.id, existente.id));
      }
      await registrarHistorico(tx, {
        eventoId,
        entidade: "evento_item",
        entidadeId: id!,
        acao: "REGRA_KIT",
        descricao: r.presente ? `Regra da logística (${r.descricao}): ${p.nome} entrou a definir` : `Regra da logística: ${p.nome} saiu (sem tenda na ata)`,
        usuarioId,
        dadosAntes: { ativo: Boolean(existente?.ativo) },
        dadosDepois: { ativo: Boolean(r.presente), regra: r.regra },
      });
      mudancas++;
      continue;
    }
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

/**
 * Uma vez só, ao subir: passa as regras em todas as atas ainda abertas (preparação e reunião), para a
 * mudança de regra valer sem esperar alguém mexer na ata (20/10: testeira a definir com tenda; pranchão
 * de volta no cavalete reto). Só essas regras: as outras seguem como estão. A marca em `configuracoes` entra
 * na mesma transação.
 */
const REGRAS_RESSINCRONIZADAS = ["testeira-tenda-5x5", "testeira-tenda-3x3", "cavalete-reto"] as const;

export async function ressincronizarAtasAbertas(chave = "regras:atas-abertas:2026-10-20"): Promise<{ feito: false } | { feito: true; eventos: number; mudancas: number }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx.insert(configuracoes).values({ chave, valor: JSON.stringify({ status: "em andamento" }) }).onConflictDoNothing({ target: configuracoes.chave }).returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };
    const abertas = await tx.select({ id: eventos.id }).from(eventos).where(inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]));
    let mudancas = 0;
    for (const e of abertas) mudancas += await sincronizarRegrasAta(tx, e.id, null, { soRegras: REGRAS_RESSINCRONIZADAS });
    await tx.update(configuracoes).set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), eventos: abertas.length, mudancas }) }).where(eq(configuracoes.chave, chave));
    return { feito: true, eventos: abertas.length, mudancas };
  });
}

/**
 * Uma vez só, ao subir (22/10): atas que fecharam antes da regra do prisma existir ficaram sem as grades do prisma
 * (1 prisma = 2 grades, somadas às pedidas). Aplica só essa regra nelas e gera a versão nova da OS de cada uma.
 * Linha ajustada à mão fica como está. A marca em `configuracoes` entra na mesma transação.
 */
export async function aplicarGradesDoPrismaNasAtasFechadas(chave = "regras:grade-prisma-atas-fechadas:2026-10-22"): Promise<{ feito: false } | { feito: true; eventos: string[] }> {
  const { gerarOsVersao } = await import("../os");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx.insert(configuracoes).values({ chave, valor: JSON.stringify({ status: "em andamento" }) }).onConflictDoNothing({ target: configuracoes.chave }).returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };
    const fechadas = await tx.select({ id: eventos.id, codigo: eventos.codigo }).from(eventos).where(eq(eventos.status, "ABERTO"));
    const mudaram: string[] = [];
    for (const e of fechadas) {
      if (!(await sincronizarRegrasAta(tx, e.id, null, { ataFechada: true, soRegras: ["grade-prisma"] }))) continue;
      await gerarOsVersao(tx, e.id, "AJUSTE_LOGISTICA", null, "Grades do prisma (1 prisma = 2 grades, somadas às pedidas)");
      mudaram.push(e.codigo);
    }
    await tx.update(configuracoes).set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), eventos: mudaram }) }).where(eq(configuracoes.chave, chave));
    return { feito: true, eventos: mudaram };
  });
}
