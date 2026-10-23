"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icons";
import { Numero } from "@/components/ui/numero";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { excluirGrupoProjetoAction } from "@/app/(app)/biblioteca/actions";

export type GrupoComUso = { id: string; nome: string; projetos: number; pecas: number };

const contagem = (g: GrupoComUso) =>
  g.projetos + g.pecas === 0 ? "vazio" : [g.projetos ? `${g.projetos} ${g.projetos === 1 ? "projeto" : "projetos"}` : null, g.pecas ? `${g.pecas} ${g.pecas === 1 ? "peça" : "peças"}` : null].filter(Boolean).join(" · ");

/**
 * Grupos de prova da Biblioteca (cenografia e admin): lista com o que cada um tem e excluir. Ao excluir, os
 * projetos e as peças do grupo passam para Padrão; nada mais é apagado. A confirmação fica na própria linha.
 */
export function GerenciarGrupos({ grupos }: { grupos: GrupoComUso[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const excluir = (g: GrupoComUso) =>
    iniciar(async () => {
      const r = await excluirGrupoProjetoAction(g.id);
      if (!r.ok) return toastErro(r.erro);
      setConfirmando(null);
      toastSucesso(`Grupo "${g.nome}" excluído${g.projetos + g.pecas ? ": o que tinha nele passou para Padrão" : ""}`);
      router.refresh();
    });
  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (!o) setConfirmando(null);
      }}
    >
      <Button variant="secondary" size="md" onClick={() => setAberto(true)}>
        <Icone nome="camadas" />
        Grupos
      </Button>
      <DialogContent title="Grupos de prova" description="Excluir um grupo não apaga projetos nem peças: o que estava nele passa para Padrão." width={520}>
        {grupos.length === 0 ? (
          <p className="m-0 text-corpo text-muted">Nenhum grupo cadastrado.</p>
        ) : (
          <ul className="m-0 max-h-[60vh] list-none divide-y divide-line-row overflow-y-auto rounded-cartao border border-line p-0">
            {grupos.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-corpo font-medium text-ink">{g.nome}</span>
                  <span className="block text-pequeno text-muted">{contagem(g)}</span>
                </span>
                {confirmando === g.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-pequeno text-ink-2">
                      {g.projetos + g.pecas ? (
                        <>
                          <Numero valor={g.projetos + g.pecas} /> {g.projetos + g.pecas === 1 ? "item vai" : "itens vão"} para Padrão.
                        </>
                      ) : (
                        "Excluir?"
                      )}
                    </span>
                    <Button variant="danger" size="sm" loading={pendente} onClick={() => excluir(g)}>
                      Excluir
                    </Button>
                    <Button variant="ghost" size="sm" disabled={pendente} onClick={() => setConfirmando(null)}>
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmando(g.id)} aria-label={`Excluir o grupo ${g.nome}`}>
                    <Icone nome="lixeira" />
                    Excluir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="lg">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
