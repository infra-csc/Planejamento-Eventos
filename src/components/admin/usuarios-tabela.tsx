"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { salvarUsuarioAction } from "@/app/(app)/admin/actions";
import { Button, SubmitButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel, TableWrap } from "@/components/ui/layout";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ehRequisitante, PERFIL_LABEL } from "@/domain/permissions";
import { ESTADO_INICIAL } from "@/lib/action";
import { formatarDataHora } from "@/lib/format";
import { PERFIS, type Perfil } from "@/server/db/schema";

type U = { id: string; nome: string; email: string; perfil: Perfil; areaId: string | null; areaNome: string | null; ativo: boolean; ultimoAcessoEm: Date | null };

function UsuarioForm({ usuario, areas, onDone }: { usuario: U | null; areas: Array<{ id: string; nome: string }>; onDone: () => void }) {
  const [state, action] = useActionState(salvarUsuarioAction, ESTADO_INICIAL);
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "REQUISITANTE");
  useActionFeedback(state, onDone);
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      {usuario && <input type="hidden" name="id" value={usuario.id} />}
      <Field label="Nome" htmlFor="nome" error={c?.nome}>
        <Input id="nome" name="nome" defaultValue={usuario?.nome ?? ""} required autoFocus />
      </Field>
      <Field label="E-mail" htmlFor="email" error={c?.email}>
        <Input id="email" name="email" type="email" defaultValue={usuario?.email ?? ""} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Perfil" htmlFor="perfil" error={c?.perfil}>
          <Select id="perfil" name="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {PERFIL_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        {ehRequisitante(perfil) && (
          <Field label="Área" htmlFor="areaId" error={c?.areaId}>
            <Select id="areaId" name="areaId" defaultValue={usuario?.areaId ?? ""} required>
              <option value="" disabled>
                Selecione
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label={usuario ? "Nova senha" : "Senha inicial"} htmlFor="senha" error={c?.senha} optional={Boolean(usuario)} hint={usuario ? "Preencha só para redefinir. Sessões ativas serão encerradas." : "Mínimo de 8 caracteres. Informe ao usuário por um canal seguro."}>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required={!usuario} />
      </Field>
      <Checkbox id="ativo" name="ativo" label="Usuário ativo" description="Inativos não conseguem entrar." defaultChecked={usuario?.ativo ?? true} />
      <FormError message={!state.ok ? state.erro : null} />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton>{usuario ? "Salvar" : "Criar usuário"}</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

export function UsuariosTabela({ usuarios, areas, meuId }: { usuarios: U[]; areas: Array<{ id: string; nome: string }>; meuId: string }) {
  const [editando, setEditando] = useState<U | null | "novo">(null);
  return (
    <>
      <Panel
        title={`Usuários (${usuarios.length})`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setEditando("novo")}>
            <Plus className="size-3.5" /> Novo usuário
          </Button>
        }
        padded={false}
      >
        <TableWrap>
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="hidden sm:table-cell">E-mail</th>
                <th>Perfil</th>
                <th className="hidden md:table-cell">Área</th>
                <th className="hidden lg:table-cell">Último acesso</th>
                <th className="w-px"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="font-medium text-ink">{u.nome}</span>
                    {u.id === meuId && <span className="ml-1 text-xs text-ink-muted">(você)</span>}
                    {!u.ativo && <Badge className="ml-2">inativo</Badge>}
                  </td>
                  <td className="hidden sm:table-cell text-ink-secondary">{u.email}</td>
                  <td>{PERFIL_LABEL[u.perfil]}</td>
                  <td className="hidden md:table-cell">{u.areaNome ?? "—"}</td>
                  <td className="hidden lg:table-cell text-ink-muted">{u.ultimoAcessoEm ? formatarDataHora(u.ultimoAcessoEm) : "nunca"}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(u)}>
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
          <DialogContent title={editando === "novo" ? "Novo usuário" : `Editar ${editando.nome}`} size="sm">
            <UsuarioForm usuario={editando === "novo" ? null : editando} areas={areas} onDone={() => setEditando(null)} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
