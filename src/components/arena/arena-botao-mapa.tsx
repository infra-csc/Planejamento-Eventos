"use client";

import { cn } from "@/lib/cn";

export const cartao = "rounded-cartao border border-line bg-surface/95 shadow-pill backdrop-blur";

export function BotaoMapa({
  rotulo,
  atalho,
  onClick,
  children,
  ativo,
  className,
  tamanho = "md",
}: {
  rotulo: string;
  atalho?: string;
  onClick: () => void;
  children: React.ReactNode;
  ativo?: boolean;
  className?: string;
  /** `campo`: mesma altura do Input (34px), para a barra superior. */
  tamanho?: "md" | "campo";
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={atalho ? `${rotulo} (${atalho})` : rotulo}
      aria-pressed={ativo}
      aria-keyshortcuts={atalho}
      onClick={onClick}
      className={cn(
        "grid cursor-pointer place-items-center border-0 bg-transparent text-ink-2 hover:bg-subtle hover:text-ink aria-pressed:bg-accent-bg aria-pressed:text-accent",
        tamanho === "campo" ? "size-[34px]" : "size-9",
        className,
      )}
    >
      {children}
    </button>
  );
}
