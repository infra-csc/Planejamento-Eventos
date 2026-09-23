"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { Icone } from "./icons";

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
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-dialogo)] animate-fade-up-rapido bg-scrim" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[calc(var(--z-dialogo)+1)] flex max-h-[calc(100dvh-48px)] -translate-x-1/2 -translate-y-1/2 animate-fade-up-rapido flex-col rounded-modal border border-line-strong bg-surface shadow-modal focus:outline-none",
          className,
        )}
        style={{ width: `min(${w}px, 94vw)` }}
      >
        <div className="border-b border-line-soft py-4 pl-5 pr-14">
          <DialogPrimitive.Title className="m-0 text-titulo font-semibold tracking-[-0.01em]">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className={description ? "mt-1 text-pequeno text-muted" : "sr-only"}>{description ?? title}</DialogPrimitive.Description>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">{children}</div>
        {/* Por último no DOM: o foco inicial continua no primeiro campo/ação, não no fechar. */}
        <DialogPrimitive.Close
          aria-label="Fechar"
          title="Fechar (Esc)"
          className="absolute right-3 top-3 grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-3 transition-colors duration-150 hover:bg-black/[0.05] hover:text-ink max-md:size-10"
        >
          <Icone nome="fechar" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Rodapé do modal (#faf8f8), colado às bordas do corpo.
 * Ordem: escreva a AÇÃO PRINCIPAL PRIMEIRO no código (é o primeiro Tab); ela aparece à DIREITA,
 * com as secundárias à esquerda dela. No celular os botões empilham, a principal em cima.
 */
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("-mx-5 -mb-4 mt-4 flex flex-row-reverse flex-wrap items-center justify-start gap-2 rounded-b-modal border-t border-line-soft bg-subtle px-5 py-3.5 max-sm:flex-col max-sm:items-stretch", className)}>{children}</div>;
}
