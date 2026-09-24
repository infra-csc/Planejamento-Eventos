"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/layout";
import { pecasParaProjetoAction } from "@/app/(app)/biblioteca/actions";
import { ProjetoForm, type PecaOpcao } from "./projeto-form";
import { AnexosManager } from "./anexos-manager";

type Anexo = { id: string; tipo: "IMAGEM" | "PDF"; nomeArquivo: string; tamanho: number };

/**
 * Edição do projeto sem sair da Biblioteca: fotos e desenhos à esquerda (com envio e remoção),
 * lista de peças e dados à direita. Salvar volta para a própria Biblioteca com o projeto selecionado.
 * O catálogo de peças só é carregado quando o modal abre (a página não o leva junto).
 */
export function EditarProjetoModal({
  projeto,
  anexos,
  categorias,
}: {
  projeto: { id: string; nome: string; categoria: string; descricao: string | null; versaoAtual: number; disponivelEmSolicitacoes: boolean; itens: Array<{ pecaId: string; quantidade: number }> };
  anexos: Anexo[];
  categorias?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [pecas, setPecas] = useState<PecaOpcao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();

  const abrir = (o: boolean) => {
    setAberto(o);
    if (!o || pecas) return;
    setErro(null);
    iniciar(async () => {
      const r = await pecasParaProjetoAction();
      if (r.ok) setPecas(r.dados ?? []);
      else setErro(r.erro);
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <Button variant="link" size="sm" onClick={() => abrir(true)}>
        Editar
      </Button>
      {aberto && (
        <DialogContent title={`Editar ${projeto.nome}`} description="Alterar a lista de peças cria uma nova versão; alterar só nome, categoria ou descrição não." width={1120} className="max-h-[calc(100vh-32px)]">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <section aria-label="Fotos e desenhos" className="overflow-hidden rounded-cartao border border-line bg-surface">
              <div className="border-b border-line-soft px-cartao py-3">
                <h3 className="m-0 text-corpo font-semibold">Fotos e desenhos</h3>
                <p className="mt-0.5 text-pequeno text-muted">Clique para ampliar. Render, modulação ou PDF técnico, até 8 MB.</p>
              </div>
              <AnexosManager projetoId={projeto.id} anexos={anexos} podeGerenciar />
            </section>
            <div>
              {pecas ? (
                <ProjetoForm valores={projeto} pecas={pecas} categorias={categorias} cancelarHref={`/biblioteca?p=${projeto.id}`} onCancelar={() => setAberto(false)} voltarPara={`/biblioteca?p=${projeto.id}`} />
              ) : erro ? (
                <FormError message={erro} />
              ) : (
                <div className="flex flex-col gap-3" aria-busy={carregando || undefined} aria-label="Carregando o catálogo de peças">
                  <Skeleton className="h-40" />
                  <Skeleton className="h-64" />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
