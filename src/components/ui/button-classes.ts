import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
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
  primary: "bg-dark text-white border-dark hover:bg-dark-2",
  secondary: "bg-surface text-ink border-line-strong hover:bg-subtle",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-black/[0.04]",
  link: "bg-transparent border-transparent text-accent hover:text-accent-hover hover:underline",
  atender: "bg-success-bg text-success border-success-border hover:border-success/40",
  parcial: "bg-warning-bg text-warning border-warning-border hover:border-warning/40",
  recusar: "bg-danger-bg text-danger border-danger-border hover:border-danger/40",
  danger: "bg-danger text-white border-danger hover:opacity-90",
  dangerOutline: "bg-transparent text-danger border-danger-border hover:bg-danger-bg",
  onDark: "bg-dark-2 text-white border-dark-2 hover:bg-dark-3",
  pink: "bg-accent-light text-ink border-accent-light hover:brightness-105",
  bloqueado: "bg-dark-2 text-meta border-dark-2 cursor-not-allowed",
};

const tamanhos: Record<ButtonSize, string> = {
  xs: "h-[27px] px-2.5 text-[12px] rounded-[7px]",
  sm: "h-[30px] px-3 text-[12.5px] rounded-[7px]",
  md: "h-[34px] px-[13px] text-[13px] rounded-lg",
  lg: "h-9 px-[15px] text-[13.5px] rounded-lg",
  xl: "h-[38px] px-[17px] text-[13.5px] rounded-lg",
  full: "h-[42px] w-full px-4 text-[14.5px] rounded-lg",
};

export function buttonClasses({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-medium transition-colors select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
    tamanhos[size],
    variantes[variant],
    variant === "link" && "!h-auto !px-0",
    className,
  );
}
