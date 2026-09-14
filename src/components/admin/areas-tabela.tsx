"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { salvarAreaAction } from "@/app/(app)/admin/actions";
import { Button, SubmitButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel, TableWrap } from "@/components/ui/layout";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";

type A = { id: string; nome: string; ativo: boolean; usuarios: number };

function AreaForm({ area, onDone }: { area: A | null; onDone: () => void }) {
  const [state, action] = useActionState(salvarAreaAction, ESTADO_INICIAL);
  useActionFeedback(state, onDone);
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      {area && <input type="hidden" name="id" value={area.id} />}
      <Field label="Nome da área" htmlFor="nome" error={c?.nome}>
        <Input id="nome" name="nome" defaultValue={area?.nome ?? ""} required autoFocus />
      </Field>
      <Checkbox id="ativo" name="ativo" label="Área ativa" description="Áreas inativas não recebem notificações de novos eventos." defaultChecked={area?.ativo ?? true} />
      <FormError message={!state.ok ? state.erro : null} />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton>{area ? "Salvar" : "Criar área"}</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

export function AreasTabela({ areas }: { areas: A[] }) {
  const [editando, setEditando] = useState<A | null | "novo">(null);
  return (
    <>
      <Panel
        title="Áreas requisitantes"
        description="Cadastro fixo (RV-04): todas as áreas ativas participam de qualquer evento."
        actions={
          <Button size="sm" variant="primary" onClick={() => setEditando("novo")}>
            <Plus className="size-3.5" /> Nova área
          </Button>
        }
        padded={false}
      >
        <TableWrap>
          <table className="table-base">
            <thead>
              <tr>
                <th>Área</th>
                <th className="num">Usuários</th>
                <th className="w-px"></th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="font-medium text-ink">{a.nome}</span>
                    {!a.ativo && <Badge className="ml-2">inativa</Badge>}
                  </td>
                  <td className="num tabular">{a.usuarios}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(a)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        {editando !== null && (
          <DialogContent title={editando === "novo" ? "Nova área" : `Editar ${editando.nome}`} size="sm">
            <AreaForm area={editando === "novo" ? null : editando} onDone={() => setEditando(null)} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
