import { cn } from "@/lib/cn";
import type { EventoStatus, ItemStatus, SolicitacaoStatus } from "@/server/db/schema";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { ITEM_STATUS_LABEL, SOLICITACAO_STATUS_LABEL } from "@/domain/solicitacao";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-black/5 text-ink-secondary",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const eventoTone: Record<EventoStatus | "REALIZADO", Tone> = {
  PREPARACAO: "info",
  EM_REUNIAO: "warning",
  ABERTO: "success",
  ENCERRADO: "neutral",
  REALIZADO: "neutral",
  CANCELADO: "danger",
};

export function EventoStatusBadge({ status }: { status: EventoStatus | "REALIZADO" }) {
  return <Badge tone={eventoTone[status]}>{status === "REALIZADO" ? "Realizado" : EVENTO_STATUS_LABEL[status]}</Badge>;
}

const solicitacaoTone: Record<SolicitacaoStatus, Tone> = {
  RASCUNHO: "neutral",
  ENVIADA: "info",
  EM_ANALISE: "warning",
  RESPONDIDA: "success",
  DEVOLVIDA: "danger",
  CANCELADA: "neutral",
};

export function SolicitacaoStatusBadge({ status, atrasada }: { status: SolicitacaoStatus; atrasada?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={solicitacaoTone[status]}>{SOLICITACAO_STATUS_LABEL[status]}</Badge>
      {atrasada && <Badge tone="danger">Atrasada</Badge>}
    </span>
  );
}

const itemTone: Record<ItemStatus, Tone> = {
  EM_ANALISE: "neutral",
  ATENDIDO: "success",
  PARCIAL: "warning",
  NAO_ATENDIDO: "danger",
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge tone={itemTone[status]}>{ITEM_STATUS_LABEL[status]}</Badge>;
}
