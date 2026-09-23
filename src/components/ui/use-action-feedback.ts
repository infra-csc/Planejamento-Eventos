"use client";

import { useEffect, useRef } from "react";
import { toastErro, toastSucesso } from "./toast";
import type { ActionResult } from "@/lib/action";

/** Mostra o toast de sucesso/erro quando o resultado de uma action muda. */
export function useActionFeedback(state: ActionResult, onSuccess?: () => void) {
  const prev = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (prev.current === state) return;
    const primeiro = prev.current === null;
    prev.current = state;
    if (primeiro) return;
    if (state.ok && state.mensagem) {
      toastSucesso(state.mensagem);
      onSuccess?.();
    } else if (!state.ok && state.erro && !state.campos) {
      toastErro(state.erro);
    }
  }, [state, onSuccess]);
}
