"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toast } from "@/components/ui/toast";
import { salvarAreaAction } from "@/app/(app)/admin/actions";

type A = { id: string; nome: string; ativo: boolean; pessoas: number; solicitacoes: number };

function ModalArea({ area, onClose }: { area: A | null; onClose: () => void }) {
  const [nome, setNome] = useState(area?.nome ?? "");
  const [ativo, setAtivo] = useState(area?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const salvar = () => {
    if (!nome.trim()) {
      setErro("Informe o nome da área.");
      return;
    }
    iniciar(async () => {
      const r = await salvarAreaAction({ id: area?.id ?? null, nome: nome.trim(), ativo });
      if (!r.ok) {
        setErro(r.campos?.nome ?? r.erro);
        return;
      }
      toast(r.mensagem ?? "Área salva");
      onClose();
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={area ? `Editar ${area.nome}` : "Nova área"} description="Todas as áreas ativas participam de qualquer evento.">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
          className="flex flex-col gap-3.5"
        >
          <div>
            <label htmlFor="a-nome" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Nome
            </label>
            <input id="a-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={Boolean(erro)} className="h-9 w-full rounded-lg border border-line-control bg-surface px-3 text-[13.5px] focus:border-accent focus:outline-none aria-[invalid=true]:border-danger-input" />
            {erro && <p className="mb-0 mt-[5px] text-[12px] text-danger">{erro}</p>}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-[15px] accent-accent" />
            Área ativa
          </label>
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pendente}>
              {area ? "Salvar alterações" : "Criar área"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AreasPainel({ areas }: { areas: A[] }) {
  const [modal, setModal] = useState<A | "nova" | null>(null);
  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line-soft px-[18px] py-3">
          <span className="text-[12.5px] text-muted">Cadastro fixo: todas as áreas ativas participam de qualquer evento.</span>
          <Button variant="primary" size="sm" onClick={() => setModal("nova")}>
            Nova área
          </Button>
        </div>
        <table className="w-full border-collapse">
          <CaptionOculta>Áreas</CaptionOculta>
          <thead>
            <tr className="bg-subtle">
              <Th>Área</Th>
              <Th largura={110} alinhar="right">
                Pessoas
              </Th>
              <Th largura={120} alinhar="right">
                Solicitações
              </Th>
              <Th largura={150} alinhar="right">
                Status
              </Th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id} className="hover:bg-subtle">
                <th scope="row" className="border-b border-line-row px-[18px] py-3 text-left text-[13.5px] font-normal text-ink">
                  {a.nome}
                </th>
                <td className="border-b border-line-row px-2.5 py-3 text-right font-mono text-[12.5px]">{a.pessoas}</td>
                <td className="border-b border-line-row px-2.5 py-3 text-right font-mono text-[12.5px]">{a.solicitacoes}</td>
                <td className="border-b border-line-row py-3 pl-2.5 pr-[18px] text-right">
                  <span className="flex items-center justify-end gap-3">
                    <span className={a.ativo ? "text-[12px] text-success" : "text-[12px] text-muted"}>{a.ativo ? "ativa" : "inativa"}</span>
                    <button type="button" onClick={() => setModal(a)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-accent hover:underline">
                      Editar
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <ModalArea area={modal === "nova" ? null : modal} onClose={() => setModal(null)} />}
    </>
  );
}
