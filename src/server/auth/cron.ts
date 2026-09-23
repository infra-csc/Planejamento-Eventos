// Sem "server-only": testado direto pelo vitest.
import { createHash, timingSafeEqual } from "node:crypto";

export type ResultadoCron = { ok: true } | { ok: false; status: 401 | 503; erro: string };

/**
 * Autoriza a chamada agendada: exige `Authorization: Bearer <CRON_SECRET>`.
 * - 503 quando CRON_SECRET não está configurado (a rota fica desligada, não aberta).
 * - 401 sem cabeçalho ou com segredo errado.
 * A comparação é em tempo constante (hash SHA-256 dos dois lados, mesmo tamanho): o tempo de
 * resposta não revela quantos caracteres do segredo estavam certos.
 */
export function autorizarCron(authorization: string | null, segredo: string | undefined = process.env.CRON_SECRET): ResultadoCron {
  const esperado = segredo?.trim();
  if (!esperado) return { ok: false, status: 503, erro: "CRON_SECRET não configurado." };
  const m = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!m) return { ok: false, status: 401, erro: "Não autorizado." };
  const a = createHash("sha256").update(m[1].trim()).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, status: 401, erro: "Não autorizado." };
}
