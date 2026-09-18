"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/** Linha clicável da notificação: enquanto o form envia, fica ocupada e não aceita um segundo clique. */
export function BotaoNotificacao({ className, rotulo, children }: { className: string; rotulo: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label={rotulo} aria-busy={pending || undefined} disabled={pending} className={cn(className, pending && "cursor-progress opacity-70")}>
      {children}
    </button>
  );
}
