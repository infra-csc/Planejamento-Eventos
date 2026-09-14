"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  side = false,
  size = "md",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** true = painel lateral (drawer) */
  side?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const width = size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 bg-surface shadow-md focus:outline-none flex flex-col",
          side
            ? "inset-y-0 right-0 w-full max-w-full sm:max-w-xl border-l border-line"
            : cn("left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line max-h-[calc(100vh-2rem)]", width),
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-ink-muted hover:bg-black/5 hover:text-ink" aria-label="Fechar">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4 grow">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">{children}</div>;
}
