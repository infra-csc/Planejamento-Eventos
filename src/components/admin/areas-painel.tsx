"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { IconeLapis } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toast } from "@/components/ui/toast";
import { usePedidoNovo } from "./novo-via-url";
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

const CELULA = "border-b border-line-row px-3 py-3";

export function AreasPainel({ areas, vazio }: { areas: A[]; vazio: { titulo: string; descricao?: string } }) {
  const [modal, setModal] = useState<A | "nova" | null>(null);
  // "Nova área" do cabeçalho (e o link direto /admin?aba=areas&novo=1) abre o modal de criação.
  const limparPedido = usePedidoNovo(() => setModal("nova"));
  const fechar = () => {
    setModal(null);
    limparPedido();
  };
  return (
    <>
      {areas.length === 0 ? (
        <EmptyState title={vazio.titulo} description={vazio.descricao} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <CaptionOculta>Áreas</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th>Área</Th>
                <Th className="hidden sm:table-cell" largura={110} alinhar="right">
                  Pessoas
                </Th>
                <Th className="hidden sm:table-cell" largura={120} alinhar="right">
                  Solicitações
                </Th>
                <Th largura={104}>Situação</Th>
                <Th largura={56}>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id} className="hover:bg-subtle">
                  <th scope="row" className={cn(CELULA, "text-left font-normal")}>
                    <span className={cn("block text-corpo font-medium", a.ativo ? "text-ink" : "text-ink-3")}>{a.nome}</span>
                    <span className="numero mt-0.5 block text-pequeno text-muted sm:hidden">
                      {a.pessoas} {a.pessoas === 1 ? "pessoa" : "pessoas"} · {a.solicitacoes} {a.solicitacoes === 1 ? "solicitação" : "solicitações"}
                    </span>
                  </th>
                  <td className={cn(CELULA, "numero hidden text-right text-pequeno text-ink-2 sm:table-cell")}>{a.pessoas}</td>
                  <td className={cn(CELULA, "numero hidden text-right text-pequeno text-ink-2 sm:table-cell")}>{a.solicitacoes}</td>
                  <td className={CELULA}>
                    <Badge tom={a.ativo ? "success" : "muted"}>{a.ativo ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right">
                    <IconButton label={`Editar ${a.nome}`} onClick={() => setModal(a)}>
                      <IconeLapis />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ModalArea key={modal === "nova" ? "nova" : modal.id} area={modal === "nova" ? null : modal} onClose={fechar} />}
    </>
  );
}
