"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
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
          <Field label="Nome" htmlFor="a-nome" error={erro}>
            <Input id="a-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Checkbox id="a-ativo" label="Área ativa" checked={ativo} onChange={setAtivo} />
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
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line-soft px-cartao py-3">
          <span className="text-pequeno text-muted">Cadastro fixo: todas as áreas ativas participam de qualquer evento.</span>
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
              <Th largura={90}>Status</Th>
              <Th largura={80} alinhar="right">
                Ações
              </Th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id} className="hover:bg-subtle">
                <th scope="row" className="border-b border-line-row px-cartao py-3 text-left text-corpo font-normal text-ink">
                  {a.nome}
                </th>
                <td className="border-b border-line-row px-2.5 py-3 text-right font-mono text-pequeno">{a.pessoas}</td>
                <td className="border-b border-line-row px-2.5 py-3 text-right font-mono text-pequeno">{a.solicitacoes}</td>
                <td className="border-b border-line-row px-2.5 py-3">
                  <Badge tom={a.ativo ? "success" : "muted"}>{a.ativo ? "Ativa" : "Inativa"}</Badge>
                </td>
                <td className="border-b border-line-row py-3 pl-2.5 pr-cartao text-right">
                  <Button variant="link" size="xs" onClick={() => setModal(a)} aria-label={`Editar ${a.nome}`}>
                    Editar
                  </Button>
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
