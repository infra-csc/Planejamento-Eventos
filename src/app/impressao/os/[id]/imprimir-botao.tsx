"use client";

import { Button } from "@/components/ui/button";

export function ImprimirBotao() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </Button>
  );
}
