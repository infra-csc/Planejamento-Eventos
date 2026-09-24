import { createHmac, timingSafeEqual } from "node:crypto";
import type { Perfil } from "@/server/db/schema";

/*
 * Entrada pelo Portal de Aplicativos da NORTE (NORTE-App-Hub).
 *
 * O portal autentica pela conta Microsoft, confere se a pessoa tem o app "planejamento" liberado e
 * abre /api/auth/portal?portal_sso=<jwt>. O token é HS256 com o segredo compartilhado
 * (SESSION_SECRET do hub = PORTAL_SSO_SECRET aqui), emissor "norte-portal", audiência/app =
 * "planejamento", vida de 2 minutos e um `jti` de uso único.
 *
 * A audiência é conferida: um token emitido para outro app do portal não abre este. O papel do
 * portal (lib/papeis do hub) vira o perfil daqui a cada entrada — o hub é a fonte das permissões.
 *
 * Só verificação pura (sem banco): quem abre a sessão é `entrarPeloPortal` (portal-entrada.ts).
 */

export const PORTAL_EMISSOR = "norte-portal";
export const PORTAL_APP = "planejamento";
/** Tolerância de relógio entre o hub e este servidor. */
const TOLERANCIA_S = 30;

export type TokenPortal = { email: string; nome: string | null; perfil: Perfil | null; jti: string; exp: number };
export type MotivoRecusa = "formato" | "algoritmo" | "assinatura" | "emissor" | "expirado" | "app" | "email";
export type ResultadoToken = { ok: true; token: TokenPortal } | { ok: false; motivo: MotivoRecusa };

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function verificarTokenPortal(jwt: string, segredo: string, agoraSeg = Math.floor(Date.now() / 1000)): ResultadoToken {
  const partes = jwt.split(".");
  if (partes.length !== 3 || partes.some((p) => !p)) return { ok: false, motivo: "formato" };
  const [h, p, s] = partes;
  let header: { alg?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64(h).toString("utf8"));
    payload = JSON.parse(b64(p).toString("utf8"));
  } catch {
    return { ok: false, motivo: "formato" };
  }
  // Só HS256: recusar "none" e algoritmos assimétricos evita troca de algoritmo.
  if (header.alg !== "HS256") return { ok: false, motivo: "algoritmo" };
  const esperado = createHmac("sha256", segredo).update(`${h}.${p}`).digest();
  const dado = b64(s);
  if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) return { ok: false, motivo: "assinatura" };
  if (payload.iss !== PORTAL_EMISSOR) return { ok: false, motivo: "emissor" };
  if (typeof payload.exp !== "number" || payload.exp + TOLERANCIA_S <= agoraSeg) return { ok: false, motivo: "expirado" };
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.app !== PORTAL_APP && !aud.includes(PORTAL_APP)) return { ok: false, motivo: "app" };
  const email = typeof payload.email === "string" ? payload.email : typeof payload.sub === "string" ? payload.sub : "";
  if (!email.includes("@")) return { ok: false, motivo: "email" };
  // Uso único exige jti (o hub sempre manda): sem ele, o mesmo link valeria até vencer.
  if (typeof payload.jti !== "string" || !payload.jti) return { ok: false, motivo: "formato" };
  return {
    ok: true,
    token: {
      email: email.trim().toLowerCase(),
      nome: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 120) : null,
      perfil: perfilDoPortal(payload.role),
      jti: payload.jti,
      exp: payload.exp,
    },
  };
}

/** Papel do portal (lib/papeis do hub: Administrador, Gestão, Logística, Cenografia, Requisitante) → perfil daqui. */
export function perfilDoPortal(role: unknown): Perfil | null {
  if (typeof role !== "string") return null;
  const r = role.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (r === "administrador" || r === "admin") return "ADMIN";
  if (r === "gestao") return "GESTAO";
  if (r === "logistica") return "LOGISTICA";
  if (r === "cenografia") return "CENOGRAFIA";
  if (r === "requisitante" || r === "solicitante") return "REQUISITANTE";
  return null;
}

/** Só para testes e desenvolvimento: gera um token igual ao do hub. */
export function assinarTokenPortal(payload: Record<string, unknown>, segredo: string): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = enc({ alg: "HS256", typ: "JWT" });
  const p = enc(payload);
  const s = createHmac("sha256", segredo).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
