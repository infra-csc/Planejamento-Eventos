import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md";

export function buttonClasses({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-md border transition-colors select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
    variant === "primary" && "bg-brand text-brand-ink border-brand hover:bg-brand-hover",
    variant === "secondary" && "bg-surface text-ink border-line-strong hover:bg-surface-muted",
    variant === "ghost" && "bg-transparent text-ink-secondary border-transparent hover:bg-black/5 hover:text-ink",
    variant === "danger" && "bg-danger text-white border-danger hover:opacity-90",
    variant === "link" && "bg-transparent border-transparent text-info hover:underline px-0 h-auto",
    className,
  );
}

