"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { EditarTendaDialog, type TendaDoLocal } from "./acoes-linha-evento";

/** Lápis do quadro da tenda de um local (tendas, fechamentos e calhas), fora da lista. */
export function EditarTendaBotao({ eventoId, tenda, ataFechada, rotulo }: { eventoId: string; tenda: TendaDoLocal; ataFechada: boolean; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <IconButton abreDialogo label={`Editar tendas de ${rotulo}`} onClick={() => setAberto(true)}>
        <Icone nome="lapis" />
      </IconButton>
      {aberto && <EditarTendaDialog eventoId={eventoId} tenda={tenda} ataFechada={ataFechada} onFechar={() => setAberto(false)} />}
    </>
  );
}

export type OrigemEditavel = { chave: string; rotulo: string; detalhe: string; href: string; acao: React.ReactNode };

/**
 * Um total que soma várias linhas (ex.: "Fechamento 3 m · 7 un." de várias tendas) não se edita direto — não há regra
 * para repartir. O lápis abre de onde vem o número, linha a linha, cada uma com o ajuste que já existe para ela
 * (peça do projeto, quadro da tenda, quantidade da peça solta). As janelas de ajuste abrem por cima desta.
 */
export function OrigensDoTotal({ titulo, descricao, rotuloBotao, origens }: { titulo: string; descricao: string; rotuloBotao: string; origens: OrigemEditavel[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <IconButton abreDialogo label={rotuloBotao} onClick={() => setAberto(true)}>
        <Icone nome="lapis" />
      </IconButton>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && (
          <DialogContent title={titulo} description={descricao} width={560}>
            <ul className="-mx-1 m-0 list-none p-0">
              {origens.map((o) => (
                <li key={o.chave} className="flex items-center gap-3 border-b border-line-row px-1 py-2 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <Link href={o.href} className="link block truncate text-corpo" title={o.rotulo}>
                      {o.rotulo}
                    </Link>
                    <span className="numero block text-pequeno text-ink-2">{o.detalhe}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5">{o.acao}</span>
                </li>
              ))}
            </ul>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
