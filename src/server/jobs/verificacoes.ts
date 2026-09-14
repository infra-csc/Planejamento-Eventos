import { and, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventos, solicitacoes } from "@/server/db/schema";
import { notificar, obterConfiguracoes, usuariosDaArea, usuariosLogistica } from "@/server/services/support";
import { formatarDataHora } from "@/lib/format";

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
      titulo: `Prazo vencido: ${s.codigo} (${s.area.nome})`,
      mensagem: `${s.evento.nome}: a resposta era esperada até ${formatarDataHora(s.prazoRespostaEm)}.`,
      link: `/solicitacoes/${s.id}`,
      chaveDedupe: `sla:${s.id}`,
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
