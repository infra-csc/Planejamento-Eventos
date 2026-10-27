"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icons";
import { FormNova } from "./reformas-tela";

/** Na página do item: separa unidades para reforma sem sair dela. */
export function BotaoReformaItem({ item }: { item: { id: string; nome: string; quantidade: number } }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setAberto(true)} disabled={item.quantidade === 0}>
        <Icone nome="lapis" />
        Enviar para reforma
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && <FormNova itens={[item]} itemFixo={item.id} onFechar={() => setAberto(false)} />}
      </Dialog>
    </>
  );
}
