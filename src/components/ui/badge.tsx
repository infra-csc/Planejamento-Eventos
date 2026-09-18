import { cn } from "@/lib/cn";
import type { EventoStatus, ItemStatus, Perfil, SolicitacaoStatus } from "@/server/db/schema";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { ITEM_STATUS_LABEL, SOLICITACAO_STATUS_LABEL } from "@/domain/solicitacao";
import { PERFIL_LABEL } from "@/domain/permissions";

export type Tom = "neutral" | "rascunho" | "muted" | "accent" | "warning" | "success" | "danger" | "dark";

/** Borda do selo (Badge): um tom mais forte que o fundo, como no template de pedidos. */
const BORDAS: Record<Tom, string> = {
  neutral: "border-line-strong",
  rascunho: "border-line",
  muted: "border-line",
  accent: "border-accent-border",
  warning: "border-warning-border",
  success: "border-success-border",
  danger: "border-danger-border",
  dark: "border-dark",
};

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
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-chip border px-2 py-px text-rotulo font-medium leading-[1.45]", TONS[tom], BORDAS[tom], className)}>{children}</span>;
}

/** Tag pequena usada em linhas (tipo de item, gatilho de versão). */
export function Tag({ children, tom = "muted", className }: { children: React.ReactNode; tom?: Tom; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-chip px-1.5 py-px text-micro leading-[1.5]", TONS[tom], className)}>{children}</span>;
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

/** `naAta`: pré-reunião com a ata aberta — já está na ata, aguardando a conferência da reunião. */
export function SolicitacaoStatusBadge({ status, naAta = false }: { status: SolicitacaoStatus; naAta?: boolean }) {
  if (naAta && status === "RESPONDIDA") return <Badge tom="accent">Na ata</Badge>;
  return <Badge tom={TOM_SOLICITACAO[status]}>{SOLICITACAO_STATUS_LABEL[status]}</Badge>;
}

const TOM_ITEM: Record<ItemStatus, Tom> = {
  EM_ANALISE: "muted",
  ATENDIDO: "success",
  PARCIAL: "warning",
  NAO_ATENDIDO: "danger",
};

export const COR_ITEM: Record<ItemStatus, string> = {
  EM_ANALISE: "var(--color-line-strong)",
  ATENDIDO: "var(--color-success)",
  PARCIAL: "var(--color-warning)",
  NAO_ATENDIDO: "var(--color-danger)",
};

/** Contador ou versão em mono (v3, × 4, 12): um só formato para todo número pequeno em chip. */
export function ChipMono({ children, tom = "neutral", className, title }: { children: React.ReactNode; tom?: Tom | "control"; className?: string; title?: string }) {
  return <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-chip px-1.5 py-px font-mono text-rotulo leading-[1.5]", tom === "control" ? "bg-control text-ink-3" : TONS[tom], className)}>{children}</span>;
}

export function ItemStatusBadge({ status, className, naAta = false }: { status: ItemStatus; className?: string; naAta?: boolean }) {
  if (naAta && status === "ATENDIDO")
    return (
      <Badge tom="accent" className={className}>
        Na ata
      </Badge>
    );
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
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-chip bg-danger-bg px-[7px] py-px text-rotulo font-semibold text-danger", className)}>fora da janela</span>;
}

export function TipoSolicitacaoTag({ tipo }: { tipo: "PRE_REUNIAO" | "ALTERACAO" }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-chip px-[7px] py-px text-rotulo", tipo === "PRE_REUNIAO" ? "bg-neutral-bg text-ink-2" : "bg-accent-bg text-accent")}>
      {tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"}
    </span>
  );
}
