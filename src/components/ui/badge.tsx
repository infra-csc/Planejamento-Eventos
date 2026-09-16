import { cn } from "@/lib/cn";
import type { EventoStatus, ItemStatus, Perfil, SolicitacaoStatus } from "@/server/db/schema";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { ITEM_STATUS_LABEL, SOLICITACAO_STATUS_LABEL } from "@/domain/solicitacao";
import { PERFIL_LABEL } from "@/domain/permissions";

export type Tom = "neutral" | "rascunho" | "muted" | "accent" | "warning" | "success" | "danger" | "dark";

const TONS: Record<Tom, string> = {
  neutral: "bg-neutral-bg text-ink-2",
  rascunho: "bg-neutral-bg text-ink-3",
  muted: "bg-neutral-bg text-muted",
  accent: "bg-accent-bg text-accent",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  dark: "bg-dark text-white",
};

export function Badge({ tom = "neutral", children, className }: { tom?: Tom; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-[5px] px-2 py-[2px] text-[11px] font-medium leading-[1.45]", TONS[tom], className)}>{children}</span>;
}

/** Tag pequena usada em linhas (tipo de item, gatilho de versão). */
export function Tag({ children, tom = "muted", className }: { children: React.ReactNode; tom?: Tom; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-[4px] px-1.5 py-px text-[10.5px] leading-[1.5]", TONS[tom], className)}>{children}</span>;
}

const TOM_EVENTO: Record<EventoStatus | "REALIZADO", Tom> = {
  PREPARACAO: "neutral",
  EM_REUNIAO: "warning",
  ABERTO: "accent",
  ENCERRADO: "success",
  REALIZADO: "muted",
  CANCELADO: "danger",
};

export function EventoStatusBadge({ status }: { status: EventoStatus | "REALIZADO" }) {
  return <Badge tom={TOM_EVENTO[status]}>{status === "REALIZADO" ? "Realizado" : EVENTO_STATUS_LABEL[status]}</Badge>;
}

const TOM_SOLICITACAO: Record<SolicitacaoStatus, Tom> = {
  RASCUNHO: "rascunho",
  ENVIADA: "accent",
  EM_ANALISE: "warning",
  RESPONDIDA: "success",
  DEVOLVIDA: "danger",
  CANCELADA: "muted",
};

export function SolicitacaoStatusBadge({ status }: { status: SolicitacaoStatus }) {
  return <Badge tom={TOM_SOLICITACAO[status]}>{SOLICITACAO_STATUS_LABEL[status]}</Badge>;
}

const TOM_ITEM: Record<ItemStatus, Tom> = {
  EM_ANALISE: "muted",
  ATENDIDO: "success",
  PARCIAL: "warning",
  NAO_ATENDIDO: "danger",
};

export const COR_ITEM: Record<ItemStatus, string> = {
  EM_ANALISE: "#d7d2d2",
  ATENDIDO: "#136c41",
  PARCIAL: "#7a5f00",
  NAO_ATENDIDO: "#a8400f",
};

export function ItemStatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  return (
    <Badge tom={TOM_ITEM[status]} className={className}>
      {ITEM_STATUS_LABEL[status]}
    </Badge>
  );
}

const TOM_PERFIL: Record<Perfil, Tom> = {
  LOGISTICA: "accent",
  GESTAO: "warning",
  CENOGRAFIA: "success",
  REQUISITANTE: "neutral",
  ADMIN: "dark",
};

export function PerfilBadge({ perfil }: { perfil: Perfil }) {
  return <Badge tom={TOM_PERFIL[perfil]}>{PERFIL_LABEL[perfil]}</Badge>;
}

/** Alteração enviada depois da janela definida pela logística: chama a atenção para a decisão. */
export function ForaJanelaTag({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] bg-danger-bg px-[7px] py-px text-[11px] font-semibold text-danger", className)}>fora da janela</span>;
}

export function TipoSolicitacaoTag({ tipo }: { tipo: "PRE_REUNIAO" | "ALTERACAO" }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-[5px] px-[7px] py-px text-[11px]", tipo === "PRE_REUNIAO" ? "bg-neutral-bg text-ink-2" : "bg-accent-bg text-accent")}>
      {tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"}
    </span>
  );
}
