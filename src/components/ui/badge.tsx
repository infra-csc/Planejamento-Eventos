import { cn } from "@/lib/cn";
import { Icone } from "./icons";
import type { EventoStatus, ItemStatus, Perfil, SolicitacaoStatus } from "@/server/db/schema";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { ITEM_STATUS_LABEL, SOLICITACAO_STATUS_LABEL } from "@/domain/solicitacao";
import { PERFIL_LABEL } from "@/domain/permissions";

/**
 * Selos (docs/design-system.md § Selos):
 *  - Badge    = o estado da coisa (um por linha). Fundo suave + borda sutil, cor semântica.
 *  - Tag      = tipo/categoria/observação. Texto discreto com contorno, sem fundo colorido.
 *  - ChipMono = contadores (fonte normal, tabular) e códigos/versões (mono).
 * Tons: success (concluído/ok), warning (atenção/aguardando), danger (erro/atraso/recusa),
 * info (em andamento/informativo), neutral/muted/rascunho (neutros). `accent` (marca) só para
 * seleção e contagem do que pede ação do usuário.
 */
export type Tom = "neutral" | "rascunho" | "muted" | "accent" | "info" | "warning" | "success" | "danger" | "dark";

/** Borda do selo (Badge): um tom mais forte que o fundo, como no template de pedidos. */
const BORDAS: Record<Tom, string> = {
  neutral: "border-line-strong",
  rascunho: "border-line",
  muted: "border-line",
  accent: "border-accent-border",
  info: "border-info-border",
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
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  dark: "bg-dark text-white",
};

export function Badge({ tom = "neutral", children, className }: { tom?: Tom; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-chip border px-2 py-px text-rotulo font-medium", TONS[tom], BORDAS[tom], className)}>{children}</span>;
}

/** Cor do texto da Tag: o tom só tinge a letra; o fundo fica transparente. */
const TEXTO_TAG: Record<Tom, string> = {
  neutral: "text-ink-2",
  rascunho: "text-ink-3",
  muted: "text-ink-3",
  accent: "text-accent",
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
  danger: "text-danger",
  dark: "text-ink",
};

/** Tipo/categoria em linhas (tipo de item, gatilho de versão, "fora do catálogo"): texto discreto com contorno. */
export function Tag({ children, tom = "muted", className }: { children: React.ReactNode; tom?: Tom; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-chip border border-line bg-transparent px-1.5 text-rotulo", TEXTO_TAG[tom], className)}>{children}</span>;
}

const TOM_EVENTO: Record<EventoStatus | "REALIZADO", Tom> = {
  PREPARACAO: "neutral",
  EM_REUNIAO: "warning",
  ABERTO: "info",
  ENCERRADO: "success",
  REALIZADO: "muted",
  CANCELADO: "danger",
};

export function EventoStatusBadge({ status }: { status: EventoStatus | "REALIZADO" }) {
  return <Badge tom={TOM_EVENTO[status]}>{status === "REALIZADO" ? "Realizado" : EVENTO_STATUS_LABEL[status]}</Badge>;
}

const TOM_SOLICITACAO: Record<SolicitacaoStatus, Tom> = {
  RASCUNHO: "rascunho",
  ENVIADA: "info",
  EM_ANALISE: "warning",
  RESPONDIDA: "success",
  DEVOLVIDA: "danger",
  CANCELADA: "muted",
};

/** `naAta`: pré-reunião com a ata aberta — já está na ata, aguardando a conferência da reunião. */
export function SolicitacaoStatusBadge({ status, naAta = false }: { status: SolicitacaoStatus; naAta?: boolean }) {
  if (naAta && status === "RESPONDIDA") return <Badge tom="info">Na ata</Badge>;
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

/** Texto plano dos filhos (números e strings, inclusive `× {n}`), ou null quando há elementos. */
function textoPlano(filhos: React.ReactNode): string | null {
  if (typeof filhos === "number" || typeof filhos === "string") return String(filhos);
  if (Array.isArray(filhos)) {
    const partes = filhos.map(textoPlano);
    return partes.every((p) => p !== null) ? partes.join("") : null;
  }
  return null;
}

/** Só número (com ×, +, −, % ou separador): vai em fonte normal tabular; o resto (v3, códigos) em mono. */
const SO_NUMERO = /^[×x+\-−]?\s*[\d.,]+\s*%?$/;

/**
 * Chip pequeno para contadores (12, × 4, +3) e códigos/versões (v3, SOL-0001).
 * Contador sai em fonte normal com algarismos tabulares; código sai em mono. `mono` força um dos dois.
 */
export function ChipMono({ children, tom = "neutral", className, title, mono }: { children: React.ReactNode; tom?: Tom | "control"; className?: string; title?: string; mono?: boolean }) {
  const texto = textoPlano(children);
  const emMono = mono ?? !(texto !== null && SO_NUMERO.test(texto.trim()));
  return <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-chip px-1.5 py-px text-rotulo", emMono ? "font-mono" : "numero font-medium", tom === "control" ? "bg-control text-ink-3" : TONS[tom], className)}>{children}</span>;
}

export function ItemStatusBadge({ status, className, naAta = false }: { status: ItemStatus; className?: string; naAta?: boolean }) {
  if (naAta && status === "ATENDIDO")
    return (
      <Badge tom="info" className={className}>
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
  LOGISTICA: "info",
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
  return (
    <Tag tom="danger" className={cn("border-danger-border font-medium", className)}>
      <Icone nome="alerta" className="size-3.5" />
      fora da janela
    </Tag>
  );
}

export function TipoSolicitacaoTag({ tipo }: { tipo: "PRE_REUNIAO" | "ALTERACAO" }) {
  return <Tag tom={tipo === "PRE_REUNIAO" ? "muted" : "info"}>{tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"}</Tag>;
}
