"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toastSucesso } from "@/components/ui/toast";

/**
 * Confirma a exclusão de um rascunho depois do redirecionamento (a action redireciona para a lista, então o toast
 * não sai da caixa de diálogo). Mostra uma vez e tira `excluido` da URL (auditoria 30/10, parte A N22).
 */
export function AvisoExcluido({ codigo }: { codigo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const mostrado = useRef(false);
  useEffect(() => {
    if (mostrado.current) return;
    mostrado.current = true;
    toastSucesso(`Rascunho ${codigo} excluído`);
    const resto = new URLSearchParams(sp.toString());
    resto.delete("excluido");
    router.replace(resto.size ? `${pathname}?${resto}` : pathname, { scroll: false });
  }, [codigo, pathname, router, sp]);
  return null;
}
