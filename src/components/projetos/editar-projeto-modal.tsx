"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProjetoForm, type PecaOpcao } from "./projeto-form";
import { AnexosManager } from "./anexos-manager";

type Anexo = { id: string; tipo: "IMAGEM" | "PDF"; nomeArquivo: string; tamanho: number };

/**
 * Edição do projeto sem sair da Biblioteca: fotos e desenhos à esquerda (com envio e remoção),
 * lista de peças e dados à direita. Salvar volta para a própria Biblioteca com o projeto selecionado.
 */
export function EditarProjetoModal({
  projeto,
  anexos,
  pecas,
}: {
  projeto: { id: string; nome: string; categoria: string; descricao: string | null; versaoAtual: number; itens: Array<{ pecaId: string; quantidade: number }> };
  anexos: Anexo[];
  pecas: PecaOpcao[];
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button type="button" onClick={() => setAberto(true)} className="link cursor-pointer border-0 bg-transparent p-0 text-[12.5px]">
        Editar
      </button>
      <DialogContent title={`Editar ${projeto.nome}`} description="Alterar a lista de peças cria uma nova versão; alterar só nome, categoria ou descrição não." width={1120} className="max-h-[calc(100vh-32px)]">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <section aria-label="Fotos e desenhos" className="overflow-hidden rounded-[10px] border border-line bg-surface">
            <div className="border-b border-line-soft px-[18px] py-3">
              <h3 className="m-0 text-[13.5px] font-semibold">Fotos e desenhos</h3>
              <p className="mt-0.5 text-[12px] text-muted">Clique para ampliar. Render, modulação ou PDF técnico, até 8 MB.</p>
            </div>
            <AnexosManager projetoId={projeto.id} anexos={anexos} podeGerenciar />
          </section>
          <div>
            <ProjetoForm valores={projeto} pecas={pecas} cancelarHref={`/biblioteca?p=${projeto.id}`} onCancelar={() => setAberto(false)} voltarPara={`/biblioteca?p=${projeto.id}`} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
