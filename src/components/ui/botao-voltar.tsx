"use client";

import { useRouter } from "next/navigation";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/** Volta para a tela anterior do histórico; sem histórico (aba nova), vai para `fallback`. */
export function BotaoVoltar({ fallback = "/", variant = "secondary", size = "lg", children = "Voltar" }: { fallback?: string; variant?: ButtonVariant; size?: ButtonSize; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      {children}
    </Button>
  );
}
