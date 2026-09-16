"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarPecaAction } from "@/app/(app)/catalogo/actions";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Notice, Panel } from "@/components/ui/layout";
import { SETOR_LABEL } from "@/domain/os";
import { ESTADO_INICIAL } from "@/lib/action";
import { SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";

export function PecaForm({
  valores,
  usos,
  cancelarHref,
}: {
  valores: { id?: string; codigo?: string; nome?: string; setor?: Setor; familia?: string; unidade?: string; descricao?: string | null; estoqueProprio?: number; permiteEmProjeto?: boolean };
  usos?: Array<{ id: string; nome: string; quantidade: number }>;
  cancelarHref: string;
}) {
  const [state, action] = useActionState(salvarPecaAction, ESTADO_INICIAL);
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} noValidate className="space-y-4">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      <Panel title="Peça">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Código" htmlFor="codigo" error={c?.codigo} hint="Curto e único. Ex.: BOX-600, TND-MASTRO, MDF-15">
            <Input id="codigo" name="codigo" defaultValue={valores.codigo ?? ""} required autoFocus className="uppercase" maxLength={30} />
          </Field>
          <Field label="Nome descritivo" htmlFor="nome" error={c?.nome}>
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required placeholder="Ex.: Box truss 600 mm (trecho 3 m)" />
          </Field>
          <Field label="Setor de execução" htmlFor="setor" error={c?.setor} hint="Define em qual OS a peça aparece.">
            <Select id="setor" name="setor" defaultValue={valores.setor ?? "ESTRUTURA"}>
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {SETOR_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Família" htmlFor="familia" optional hint="Box truss, Conexão, Fixação, Tenda, Chapa…">
            <Input id="familia" name="familia" defaultValue={valores.familia ?? ""} maxLength={60} />
          </Field>
          <Field label="Unidade" htmlFor="unidade" error={c?.unidade}>
            <Input id="unidade" name="unidade" defaultValue={valores.unidade ?? "un"} maxLength={10} />
          </Field>
          <Field label="Estoque próprio" htmlFor="estoqueProprio" error={c?.estoqueProprio} hint="Quantidade da empresa. Usado na consolidação por período (integração futura com o sistema de Logística).">
            <Input id="estoqueProprio" name="estoqueProprio" type="number" min={0} defaultValue={valores.estoqueProprio ?? 0} />
          </Field>
          <Field label="Descrição" htmlFor="descricao" optional className="sm:col-span-2">
            <Textarea id="descricao" name="descricao" defaultValue={valores.descricao ?? ""} className="min-h-16" />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox id="permiteEmProjeto" name="permiteEmProjeto" label="Pode entrar na lista de peças de projetos padrão" description="Desmarque para peças sempre lançadas avulsas com destino, como fechamento de tenda." defaultChecked={valores.permiteEmProjeto ?? true} />
          </div>
        </div>
      </Panel>
      {usos && usos.length > 0 && (
        <Notice tone="info" title={`Usada em ${usos.length} projeto(s) ativo(s)`}>
          {usos.map((u) => `${u.nome} (${u.quantidade})`).join(", ")}
        </Notice>
      )}
      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton>{valores.id ? "Salvar" : "Cadastrar peça"}</SubmitButton>
        <ButtonLink href={cancelarHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
