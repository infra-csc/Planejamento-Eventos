"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImprimirBotao() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      <Printer className="size-4" /> Imprimir ou salvar em PDF
    </Button>
  );
}
