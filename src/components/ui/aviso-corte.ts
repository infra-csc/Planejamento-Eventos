"use client";

import type { ClipboardEvent } from "react";
import { toast } from "./toast";

/**
 * `onPaste` de campo com `maxLength`: o navegador corta o que passa do limite sem avisar, e "…enrolado em tubo, nunca
 * dobrado" virava "…enrolado em tubo, nunca" (auditoria 30/10, parte A N7). O corte continua (o servidor recusaria),
 * mas a pessoa fica sabendo e confere o fim do texto.
 */
export function avisarTextoCortado(e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const campo = e.currentTarget;
  const max = campo.maxLength;
  if (!max || max < 0) return;
  const colado = e.clipboardData.getData("text");
  const selecionado = (campo.selectionEnd ?? 0) - (campo.selectionStart ?? 0);
  const sobra = campo.value.length - selecionado + colado.length - max;
  if (sobra <= 0) return;
  toast(`O campo aceita até ${max} caracteres: ${sobra === 1 ? "1 caractere do texto colado ficou" : `${sobra} caracteres do texto colado ficaram`} de fora. Confira o fim do texto.`, { duracao: 8000 });
}
