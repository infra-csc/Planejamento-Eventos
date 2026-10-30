"use client";

import { usePathname } from "next/navigation";
import { Icone } from "@/components/ui/icons";
import { BotaoNovo } from "@/components/admin/novo-via-url";

/**
 * "Novo veículo" no cabeçalho de Carga e descarga, como a ação principal das outras listas (antes ficava na
 * linha da semana; auditoria 28/10, nº 54). Só na aba Calendário: no Cadastro o veículo nasce dentro do
 * evento escolhido. O formulário mora no calendário, que abre ao ver `?novo=1`.
 */
export function BotaoNovoVeiculo() {
  const pathname = usePathname();
  if (pathname !== "/carga-descarga") return null;
  return (
    <BotaoNovo>
      <Icone nome="mais" />
      Novo veículo
    </BotaoNovo>
  );
}
