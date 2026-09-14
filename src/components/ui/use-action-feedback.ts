"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/** Mostra toast de sucesso/erro quando o resultado de uma action muda. */
export function useActionFeedback(state: ActionResult, onSuccess?: () => void) {
  const prev = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (prev.current === state) return;
    prev.current = state;
    if (state.ok && state.mensagem) {
      toast.success(state.mensagem);
      onSuccess?.();
    } else if (!state.ok && state.erro && !state.campos) {
      toast.error(state.erro);
    }
  }, [state, onSuccess]);
}
