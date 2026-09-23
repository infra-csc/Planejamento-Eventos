import { and, eq, gt, inArray, isNotNull, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventos, sessoes, solicitacoes, tokensRecuperacao, usuarios } from "@/server/db/schema";
import { notificar, obterConfiguracoes, usuariosLogistica } from "@/server/services/support";
import { purgarTentativasAntigas } from "@/server/auth/limite";
import { diaMesHora, formatarDataHora } from "@/lib/format";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

const INTERVALO_MS = 5 * 60_000;
const estado = globalThis as unknown as { __npeUltimaVerificacao?: number; __npeVerificando?: boolean };

/**
 * Verificações de tempo (SLA vencido, prazo próximo, lembrete de reunião) e limpeza de registros
 * expirados, no máximo a cada 5 minutos por instância. O layout dispara depois de responder
 * (`after`), então nenhum usuário espera o job. Notificações têm chave de deduplicação: rodar em
 * duas instâncias ao mesmo tempo não duplica avisos. A chave inclui o prazo (ou a data da reunião):
 * prazo novo ou reunião remarcada avisam de novo.
 */
export async function executarVerificacoesSeNecessario() {
  const agora = Date.now();
  if (estado.__npeVerificando) return;
  if (estado.__npeUltimaVerificacao && agora - estado.__npeUltimaVerificacao < INTERVALO_MS) return;
  estado.__npeVerificando = true;
  estado.__npeUltimaVerificacao = agora;
  try {
    await verificarSlaVencido();
    await avisoPrazoProximo();
    await lembreteReuniao();
    await limparExpirados();
  } catch (e) {
    console.error("[verificacoes]", e);
  } finally {
    estado.__npeVerificando = false;
  }
}

async function verificarSlaVencido() {
  const db = await getDb();
  const vencidas = await db.query.solicitacoes.findMany({
    where: and(inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.tipo, "ALTERACAO"), eq(solicitacoes.excluida, false), lt(solicitacoes.prazoRespostaEm, new Date())),
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
      // Com o prazo na chave: solicitação devolvida e reenviada (prazo novo) volta a avisar.
      chaveDedupe: `sla:${s.id}:${s.prazoRespostaEm?.getTime() ?? 0}`,
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
      inArray(solicitacoes.status, STATUS_ABERTOS),
      eq(solicitacoes.tipo, "ALTERACAO"),
      eq(solicitacoes.excluida, false),
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
      chaveDedupe: `aviso:${s.id}:${s.prazoRespostaEm?.getTime() ?? 0}`,
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
  // Uma consulta para áreas + usuários e outra para quem já enviou, em vez de uma por evento × área.
  const [todasAreas, pessoas, enviaram] = await Promise.all([
    db.query.areas.findMany({ where: eq(areas.ativo, true), columns: { id: true, nome: true } }),
    db.select({ id: usuarios.id, areaId: usuarios.areaId }).from(usuarios).where(and(eq(usuarios.ativo, true), isNotNull(usuarios.areaId))),
    db
      .select({ eventoId: solicitacoes.eventoId, areaId: solicitacoes.areaId })
      .from(solicitacoes)
      .where(
        and(
          inArray(
            solicitacoes.eventoId,
            proximos.map((e) => e.id),
          ),
          eq(solicitacoes.tipo, "PRE_REUNIAO"),
          notInArray(solicitacoes.status, ["RASCUNHO", "CANCELADA", "DEVOLVIDA"]),
        ),
      ),
  ]);
  const jaEnviaram = new Set(enviaram.map((e) => `${e.eventoId}:${e.areaId}`));
  for (const ev of proximos) {
    for (const a of todasAreas) {
      if (jaEnviaram.has(`${ev.id}:${a.id}`)) continue;
      const ids = pessoas.filter((p) => p.areaId === a.id).map((p) => p.id);
      if (!ids.length) continue;
      await notificar(db, {
        usuarioIds: ids,
        tipo: "LEMBRETE_REUNIAO",
        titulo: `Reunião de OS em breve: ${ev.nome}`,
        mensagem: `A reunião é ${formatarDataHora(ev.dataReuniao)} e a área ${a.nome} ainda não enviou necessidades.`,
        link: `/eventos/${ev.id}`,
        // Com a data na chave: reunião remarcada volta a lembrar.
        chaveDedupe: `lembrete:${ev.id}:${a.id}:${ev.dataReuniao.getTime()}`,
      });
    }
  }
}

/** Sessões e links vencidos, e tentativas de acesso com mais de um dia. */
async function limparExpirados() {
  const db = await getDb();
  const agora = new Date();
  await db.delete(sessoes).where(lt(sessoes.expiraEm, agora));
  await db.delete(tokensRecuperacao).where(or(lt(tokensRecuperacao.expiraEm, agora), isNotNull(tokensRecuperacao.usadoEm)));
  await purgarTentativasAntigas();
}
