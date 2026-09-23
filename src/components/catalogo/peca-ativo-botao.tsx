"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, type ButtonSize } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Aviso } from "@/components/ui/layout";
import { toastErro } from "@/components/ui/toast";
import { alterarAtivoPecaAction, impactoInativacaoPecaAction } from "@/app/(app)/catalogo/actions";
import type { ImpactoInativacaoPeca } from "@/server/services/catalogo";

type ItemImpacto = ImpactoInativacaoPeca["pedidos"][number];

function ListaImpacto({ itens }: { itens: ItemImpacto[] }) {
  return (
    <ul className="m-0 mt-2 flex max-h-[220px] list-none flex-col gap-1 overflow-y-auto p-0">
      {itens.map((i) => (
        <li key={i.href} className="text-pequeno">
          <Link href={i.href} className="text-ink no-underline hover:text-accent hover:underline">
            {i.rotulo}
          </Link>{" "}
          <span className="text-muted">· {i.detalhe}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Inativar/Reativar peça do catálogo (lista da Biblioteca e tela da peça). Antes de inativar, busca o
 * que a peça atinge: se estiver em projeto ativo, a inativação é bloqueada (regra do catálogo) e a lista
 * mostra onde tirar; se estiver só em pedidos em aberto, avisa com a lista e deixa confirmar.
 * Os cliques não vazam para a linha clicável da tabela.
 */
export function PecaAtivoBotao({ id, ativo, nome, size = "sm" }: { id: string; ativo: boolean; nome: string; size?: ButtonSize }) {
  const [aberto, setAberto] = useState(false);
  const [impacto, setImpacto] = useState<ImpactoInativacaoPeca | null>(null);
  const [carregando, iniciar] = useTransition();

  const abrir = () => {
    if (!ativo) return setAberto(true);
    iniciar(async () => {
      const r = await impactoInativacaoPecaAction(id);
      if (!r.ok) return toastErro(r.erro);
      setImpacto(r.dados ?? null);
      setAberto(true);
    });
  };
  const fechar = (o: boolean) => {
    setAberto(o);
    if (!o) setImpacto(null);
  };
  const bloqueada = ativo && impacto && impacto.projetos.length > 0;

  return (
    // A linha da tabela abre a peça ao clicar: nada daqui (botão ou diálogo) pode chegar até ela.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()} onAuxClick={(e) => e.stopPropagation()}>
      <Button size={size} variant="ghost" className={ativo ? "text-danger" : ""} loading={carregando} onClick={abrir}>
        {ativo ? "Inativar" : "Reativar"}
      </Button>
      {aberto && bloqueada && impacto && (
        <Dialog open onOpenChange={fechar}>
          <DialogContent title={`Não dá para inativar ${nome}`} description="A peça está na lista de peças de projetos padrão ativos." width={480}>
            <Aviso tom="danger" titulo={`${impacto.projetos.length} ${impacto.projetos.length === 1 ? "projeto ativo usa" : "projetos ativos usam"} esta peça`}>
              Tire a peça desses projetos (nova versão) ou inative os projetos antes de inativar a peça.
              <ListaImpacto itens={impacto.projetos} />
            </Aviso>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="lg">
                  Entendi
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {aberto && !bloqueada && (
        <ConfirmDialog
          open
          onOpenChange={fechar}
          title={`${ativo ? "Inativar" : "Reativar"} ${nome}`}
          description={ativo ? "Peças inativas deixam de aparecer para novos projetos, solicitações e inclusões na ata." : "A peça volta a aparecer nas seleções."}
          confirmLabel={ativo ? "Inativar" : "Reativar"}
          danger={ativo}
          action={alterarAtivoPecaAction}
          hidden={{ id, ativo: String(!ativo) }}
        >
          {ativo && impacto && impacto.pedidos.length > 0 && (
            <Aviso tom="warning" titulo={`${impacto.pedidos.length} ${impacto.pedidos.length === 1 ? "pedido em aberto usa" : "pedidos em aberto usam"} esta peça`}>
              O que já foi pedido continua valendo e segue para a OS; a peça só deixa de aparecer nas escolhas novas.
              <ListaImpacto itens={impacto.pedidos} />
            </Aviso>
          )}
        </ConfirmDialog>
      )}
    </span>
  );
}
