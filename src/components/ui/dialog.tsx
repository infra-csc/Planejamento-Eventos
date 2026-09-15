"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Modal do handoff (§5.14): 460px, raio 12, sombra de modal, cabeçalho com título e subtítulo.
 * Radix cuida de focus trap, Esc e devolução de foco (pendência §11 do protótipo).
 */
export function DialogContent({
  title,
  description,
  children,
  className,
  width = 460,
  size,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  width?: number;
  /** compatibilidade: sm=420, md=520, lg=720 */
  size?: "sm" | "md" | "lg";
}) {
  const w = size === "sm" ? 420 : size === "md" ? 520 : size === "lg" ? 720 : width;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-dialogo)] animate-fade-up-rapido bg-[rgba(22,23,26,0.4)]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[calc(var(--z-dialogo)+1)] flex max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 animate-fade-up-rapido flex-col rounded-xl border border-line-strong bg-surface shadow-[0_24px_60px_rgba(42,20,24,.22)] focus:outline-none",
          className,
        )}
        style={{ width: `min(${w}px, 94vw)` }}
      >
        <div className="border-b border-line-soft px-5 py-4">
          <DialogPrimitive.Title className="m-0 text-[16px] font-semibold tracking-[-0.01em]">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className={description ? "mt-[3px] text-[12.5px] text-muted" : "sr-only"}>{description ?? title}</DialogPrimitive.Description>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Rodapé do modal (#faf8f8), colado às bordas do corpo. */
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("-mx-5 -mb-4 mt-4 flex items-center gap-2 rounded-b-xl border-t border-line-soft bg-subtle px-5 py-3.5", className)}>{children}</div>;
}
