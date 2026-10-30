"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/** Linha clicável da notificação: enquanto o form envia, fica ocupada e não aceita um segundo clique. */
// Sem aria-label: o nome lido é o próprio conteúdo ("Não lida", título, hora e mensagem). "Abrir: <título>" trocava
// tudo isso e não batia com o texto visível (auditoria 28/10, nº 61).
export function BotaoNotificacao({ className, children }: { className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-busy={pending || undefined} disabled={pending} className={cn(className, pending && "cursor-progress opacity-70")}>
      {children}
    </button>
  );
}
