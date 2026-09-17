"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarEventoAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/layout";
import { ESTADO_INICIAL } from "@/lib/action";

export type EventoFormValores = {
  id?: string;
  nome?: string;
  cliente?: string | null;
  local?: string | null;
  dataInicio?: string;
  dataReuniao?: string; // datetime-local
  janelaAlteracoesAte?: string | null;
};

/**
 * Cadastro do evento: só o essencial. O responsável é quem cria o evento; montagem, fim,
 * desmontagem e carga não são pedidos (o período interno usado na consolidação sai da data do evento).
 */
export function EventoForm({ valores, cancelarHref }: { valores: EventoFormValores; cancelarHref: string }) {
  const [state, action] = useActionState(salvarEventoAction, ESTADO_INICIAL);
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} noValidate className="space-y-4">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      <Panel title="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do evento" htmlFor="nome" error={c?.nome} className="sm:col-span-2">
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required autoFocus placeholder="Ex.: Festival de Verão 2026" />
          </Field>
          <Field label="Cliente" htmlFor="cliente" error={c?.cliente} optional>
            <Input id="cliente" name="cliente" defaultValue={valores.cliente ?? ""} />
          </Field>
          <Field label="Local" htmlFor="local" error={c?.local} optional>
            <Input id="local" name="local" defaultValue={valores.local ?? ""} placeholder="Ex.: Parque da Cidade — Arena Sul" />
          </Field>
        </div>
      </Panel>

      <Panel title="Datas">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data do evento" htmlFor="dataInicio" error={c?.dataInicio} hint="Evento de mais de um dia: informe o primeiro dia.">
            <Input id="dataInicio" name="dataInicio" type="date" defaultValue={valores.dataInicio ?? ""} required />
          </Field>
          <Field label="Reunião de OS (ordem de serviço)" htmlFor="dataReuniao" error={c?.dataReuniao} hint="Reunião em que a logística confere tudo o que as áreas pediram. As áreas enviam necessidades até este momento.">
            <Input id="dataReuniao" name="dataReuniao" type="datetime-local" defaultValue={valores.dataReuniao ?? ""} required />
          </Field>
          <Field label="Janela de alterações até" htmlFor="janelaAlteracoesAte" error={c?.janelaAlteracoesAte} optional hint="Pode ser definida depois. Após esta data, alterações chegam marcadas “fora da janela”.">
            <Input id="janelaAlteracoesAte" name="janelaAlteracoesAte" type="date" defaultValue={valores.janelaAlteracoesAte ?? ""} />
          </Field>
        </div>
      </Panel>

      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton>{valores.id ? "Salvar alterações" : "Criar evento"}</SubmitButton>
        <ButtonLink href={cancelarHref} variant="ghost">
          Cancelar
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
