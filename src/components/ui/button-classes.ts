import { cn } from "@/lib/cn";

/**
 * Hierarquia de botões (docs/design-system.md § Botões):
 *  - primary       ação principal da tela/diálogo — cor da marca. No máximo um por área.
 *  - secondary     ações de apoio (contorno).
 *  - ghost         ações terciárias, barras de ferramentas, "mais opções".
 *  - link          ação em linha com o texto.
 *  - dark          neutro escuro, para usos específicos (ex.: ação sobre fundo claro que não é "a" ação da tela
 *                  mas precisa de peso, como "Iniciar reunião" ao lado de um primary). Era o antigo primary.
 *  - danger        confirmação destrutiva (dentro do diálogo de confirmação).
 *  - dangerOutline gatilho de ação destrutiva (abre a confirmação).
 *  - atender/parcial/recusar  respostas de item (semânticas).
 *  - onDark/pink/bloqueado    sobre superfície escura.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
  | "dark"
  | "atender"
  | "parcial"
  | "recusar"
  | "danger"
  | "dangerOutline"
  | "onDark"
  | "pink"
  | "bloqueado";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";

const variantes: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover active:bg-accent-hover",
  secondary: "bg-surface text-ink border-line-strong hover:bg-subtle hover:border-line-control active:bg-neutral-bg",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-black/[0.04] hover:text-ink active:bg-black/[0.07]",
  link: "bg-transparent border-transparent text-accent hover:text-accent-hover hover:underline underline-offset-2",
  dark: "bg-dark text-white border-dark hover:bg-dark-2 hover:border-dark-2 active:bg-dark-3",
  atender: "bg-success-bg text-success border-success-border hover:border-success/40",
  parcial: "bg-warning-bg text-warning border-warning-border hover:border-warning/40",
  recusar: "bg-danger-bg text-danger border-danger-border hover:border-danger/40",
  danger: "bg-danger text-white border-danger hover:brightness-90 active:brightness-[0.85]",
  dangerOutline: "bg-transparent text-danger border-danger-border hover:bg-danger-bg",
  onDark: "bg-dark-2 text-white border-dark-2 hover:bg-dark-3",
  pink: "bg-accent-light text-ink border-accent-light hover:brightness-105",
  bloqueado: "bg-dark-2 text-on-dark-2 border-dark-2 cursor-not-allowed",
};

/*
 * Alturas do desktop inalteradas; abaixo de md todo botão tem ao menos 40px (alvo de toque, WCAG 2.5.8).
 * `link` não ganha altura mínima: é texto em linha (exceção da 2.5.8).
 */
const tamanhos: Record<ButtonSize, string> = {
  xs: "h-[27px] px-2.5 text-pequeno rounded-controle max-md:min-h-10",
  sm: "h-[30px] px-3 text-pequeno rounded-controle max-md:min-h-10",
  md: "h-[34px] px-[13px] text-corpo rounded-controle max-md:min-h-10",
  lg: "h-9 px-[15px] text-corpo rounded-controle max-md:min-h-10",
  xl: "h-[38px] px-[17px] text-corpo rounded-controle max-md:min-h-10",
  full: "h-[42px] w-full px-4 text-destaque rounded-controle",
};

/** Variantes sobre fundo escuro: o anel de foco usa o rosa (6:1 sobre o vinho escuro; o vinho daria 2:1). */
const ESCUROS = new Set<ButtonVariant>(["onDark", "pink", "bloqueado"]);

export function buttonClasses({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return cn(
    "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-medium select-none cursor-pointer no-underline",
    "transition-[color,background-color,border-color,filter,transform] duration-150",
    variant !== "link" && "motion-safe:active:scale-[0.98]",
    "focus-visible:outline-2 focus-visible:outline-offset-2",
    ESCUROS.has(variant) ? "focus-visible:outline-accent-light" : "focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:scale-100",
    tamanhos[size],
    variantes[variant],
    variant === "link" && "!h-auto !min-h-0 !px-0",
    className,
  );
}
