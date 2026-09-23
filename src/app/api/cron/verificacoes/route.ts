import { NextResponse } from "next/server";
import { autorizarCron } from "@/server/auth/cron";
import { executarVerificacoesSeNecessario } from "@/server/jobs/verificacoes";

/**
 * Avisos agendados (SLA vencido, prazo próximo, lembrete de reunião) e limpeza de registros
 * vencidos, disparados por um agendador externo — no Replit, um Scheduled Deployment com:
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/verificacoes
 *
 * O `after()` do layout continua como reserva (roda quando alguém navega). As duas vias usam a
 * mesma função, que se limita a uma execução a cada 5 minutos por instância e deduplica avisos.
 */
export const dynamic = "force-dynamic";

async function executar(request: Request) {
  const auth = autorizarCron(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, erro: auth.erro }, { status: auth.status, headers: { "Cache-Control": "no-store" } });
  const inicio = Date.now();
  await executarVerificacoesSeNecessario();
  return NextResponse.json({ ok: true, duracaoMs: Date.now() - inicio }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = executar;
export const POST = executar;
