import { and, eq, gt, inArray, lt, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventos, solicitacoes } from "@/server/db/schema";
import { notificar, obterConfiguracoes, usuariosDaArea, usuariosLogistica } from "@/server/services/support";
import { diaMesHora, formatarDataHora } from "@/lib/format";

const INTERVALO_MS = 5 * 60_000;
const estado = globalThis as unknown as { __npeUltimaVerificacao?: number; __npeVerificando?: boolean };

/**
 * Verificações de tempo (SLA vencido e lembrete de reunião), disparadas por requisições
 * no máximo a cada 5 minutos. Sem cron externo no MVP.
 */
export async function executarVerificacoesSeNecessario() {
  const agora = Date.now();
  if (estado.__npeVerificando) return;
  if (estado.__npeUltimaVerificacao && agora - estado.__npeUltimaVerificacao < INTERVALO_MS) return;
  estado.__npeVerificando = true;
  try {
    await verificarSlaVencido();
    await avisoPrazoProximo();
    await lembreteReuniao();
    estado.__npeUltimaVerificacao = Date.now();
  } catch (e) {
    console.error("[verificacoes]", e);
  } finally {
    estado.__npeVerificando = false;
  }
}

async function verificarSlaVencido() {
  const db = await getDb();
  const vencidas = await db.query.solicitacoes.findMany({
    where: and(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), lt(solicitacoes.prazoRespostaEm, new Date())),
    with: { evento: { columns: { nome: true } }, area: true },
  });
  if (!vencidas.length) return;
  const logistica = await usuariosLogistica(db);
  for (const s of vencidas) {
    await notificar(db, {
      usuarioIds: logistica,
      tipo: "SLA_VENCIDO",
      titulo: `${s.codigo} aguarda resposta com prazo vencido`,
      mensagem: `${s.area.nome} · ${s.evento.nome} · prazo vencido em ${diaMesHora(s.prazoRespostaEm)}`,
      link: `/solicitacoes/${s.id}`,
      chaveDedupe: `sla:${s.id}`,
    });
  }
}

/** Avisa a logística quando o prazo de resposta está próximo (configuração "Aviso de prazo próximo"). */
async function avisoPrazoProximo() {
  const db = await getDb();
  const cfg = await obterConfiguracoes(db);
  const horas = Number(cfg.aviso_prazo_horas) || 0;
  if (horas <= 0) return;
  const agora = new Date();
  const proximas = await db.query.solicitacoes.findMany({
    where: and(
      inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]),
      gt(solicitacoes.prazoRespostaEm, agora),
      lt(solicitacoes.prazoRespostaEm, new Date(agora.getTime() + horas * 3_600_000)),
    ),
    with: { evento: { columns: { nome: true } }, area: true },
  });
  if (!proximas.length) return;
  const logistica = await usuariosLogistica(db);
  for (const s of proximas) {
    await notificar(db, {
      usuarioIds: logistica,
      tipo: "PRAZO_PROXIMO",
      titulo: `${s.codigo} vence em breve`,
      mensagem: `${s.area.nome} · ${s.evento.nome} · responder até ${formatarDataHora(s.prazoRespostaEm)}`,
      link: `/solicitacoes/${s.id}`,
      chaveDedupe: `aviso:${s.id}`,
    });
  }
}

async function lembreteReuniao() {
  const db = await getDb();
  const cfg = await obterConfiguracoes(db);
  const dias = Number(cfg.lembrete_reuniao_dias);
  const limite = new Date(Date.now() + dias * 86_400_000);
  const proximos = await db.query.eventos.findMany({
    where: and(eq(eventos.status, "PREPARACAO"), lt(eventos.dataReuniao, limite), sql`${eventos.dataReuniao} > now()`),
    columns: { id: true, nome: true, dataReuniao: true },
  });
  if (!proximos.length) return;
  const todasAreas = await db.query.areas.findMany({ where: eq(areas.ativo, true) });
  for (const ev of proximos) {
    const enviaram = await db
      .select({ areaId: solicitacoes.areaId })
      .from(solicitacoes)
      .where(and(eq(solicitacoes.eventoId, ev.id), eq(solicitacoes.tipo, "PRE_REUNIAO"), notInArray(solicitacoes.status, ["RASCUNHO", "CANCELADA", "DEVOLVIDA"])));
    const jaEnviaram = new Set(enviaram.map((e) => e.areaId));
    for (const a of todasAreas) {
      if (jaEnviaram.has(a.id)) continue;
      const ids = await usuariosDaArea(db, a.id);
      if (!ids.length) continue;
      await notificar(db, {
        usuarioIds: ids,
        tipo: "LEMBRETE_REUNIAO",
        titulo: `Reunião de OS em breve: ${ev.nome}`,
        mensagem: `A reunião é ${formatarDataHora(ev.dataReuniao)} e a área ${a.nome} ainda não enviou necessidades.`,
        link: `/eventos/${ev.id}`,
        chaveDedupe: `lembrete:${ev.id}:${a.id}`,
      });
    }
  }
}
