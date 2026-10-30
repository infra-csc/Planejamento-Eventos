"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { focarConteudoSePerdido } from "@/components/shell/foco";

/**
 * Dentro de um <form> com server action: terminado o envio, se o botão sumiu (ex.: "Marcar todas como lidas", que só
 * aparece com não lidas), o foco vai ao conteúdo em vez do <body> (auditoria 30/10, parte A N8).
 */
export function FocoAposEnvio() {
  const { pending } = useFormStatus();
  const enviou = useRef(false);
  useEffect(() => {
    if (pending) {
      enviou.current = true;
      return;
    }
    if (!enviou.current) return;
    enviou.current = false;
    focarConteudoSePerdido();
  }, [pending]);
  return null;
}
