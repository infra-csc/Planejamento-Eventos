"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormNova } from "./reformas-tela";

/** Na página do item: separa unidades para reforma sem sair dela. */
export function BotaoReformaItem({ item }: { item: { id: string; nome: string; quantidade: number } }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {/* Sem o lápis: ele é do "Editar item", ao lado. */}
      <Button variant="secondary" onClick={() => setAberto(true)} disabled={item.quantidade === 0} motivoDesabilitado="Não há unidades em posse para enviar à reforma.">
        Enviar para reforma
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && <FormNova itens={[item]} itemFixo={item.id} onFechar={() => setAberto(false)} />}
      </Dialog>
    </>
  );
}
