import type { SolicitacaoStatus } from "@/server/db/schema";
import { diaMesHora, hora, isoSP } from "./format";

export type TomPrazo = "danger" | "warning" | "neutral" | "muted";

export const COR_TOM: Record<TomPrazo, string> = {
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  neutral: "var(--color-ink-2)",
  muted: "var(--color-muted)",
};

export type InfoPrazo = { label: string; sub: string; tom: TomPrazo; vencido: boolean };

/**
 * Prazo de resposta de uma solicitação (handoff §10). Só uma solicitação ainda aberta
 * pode estar vencida: respondida, cancelada ou em rascunho nunca é "atrasada".
 */
export function prazoInfo(s: { status: SolicitacaoStatus; prazoRespostaEm: Date | string | null }, agora: Date = new Date()): InfoPrazo {
  const aberta = s.status === "ENVIADA" || s.status === "EM_ANALISE";
  if (!aberta) {
    if (s.status === "RASCUNHO") return { label: "rascunho", sub: "", tom: "muted", vencido: false };
    if (s.status === "DEVOLVIDA") return { label: "sem prazo", sub: "corrigir e reenviar", tom: "muted", vencido: false };
    return { label: "—", sub: "", tom: "muted", vencido: false };
  }
  if (!s.prazoRespostaEm) return { label: "sem prazo", sub: "", tom: "muted", vencido: false };
  const prazo = typeof s.prazoRespostaEm === "string" ? new Date(s.prazoRespostaEm) : s.prazoRespostaEm;
  const ms = prazo.getTime() - agora.getTime();
  if (ms < 0) {
    const dias = Math.max(1, Math.round(-ms / 86_400_000));
    return { label: "vencido", sub: `há ${dias} ${dias === 1 ? "dia" : "dias"}`, tom: "danger", vencido: true };
  }
  const h = Math.round(ms / 3_600_000);
  if (h <= 24) return { label: `em ${h}h`, sub: `${isoSP(prazo) === isoSP(agora) ? "hoje" : "amanhã"} ${hora(prazo)}`, tom: "warning", vencido: false };
  return { label: `em ${Math.round(h / 24)}d`, sub: diaMesHora(prazo), tom: "neutral", vencido: false };
}
