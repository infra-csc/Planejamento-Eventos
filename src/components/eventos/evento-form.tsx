"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarEventoAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/layout";
import { ESTADO_INICIAL } from "@/lib/action";

export type EventoFormValores = {
  id?: string;
  nome?: string;
  cliente?: string | null;
  local?: string | null;
  dataMontagem?: string;
  dataInicio?: string;
  dataFim?: string;
  dataDesmontagem?: string;
  dataReuniao?: string; // datetime-local
  dataCarga?: string | null;
  janelaAlteracoesAte?: string | null;
  responsavelId?: string;
};

export function EventoForm({ valores, responsaveis, cancelarHref }: { valores: EventoFormValores; responsaveis: Array<{ id: string; nome: string }>; cancelarHref: string }) {
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
          <Field label="Responsável na logística" htmlFor="responsavelId" error={c?.responsavelId}>
            <Select id="responsavelId" name="responsavelId" defaultValue={valores.responsavelId ?? ""} placeholder="Selecione quem responde pelo evento" invalid={Boolean(c?.responsavelId)} opcoes={responsaveis.map((r) => ({ value: r.id, label: r.nome }))} />
          </Field>
        </div>
      </Panel>

      <Panel title="Datas" description="Montagem e desmontagem definem o período em que as peças ficam ocupadas (usado na consolidação).">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Montagem" htmlFor="dataMontagem" error={c?.dataMontagem}>
            <Input id="dataMontagem" name="dataMontagem" type="date" defaultValue={valores.dataMontagem ?? ""} required />
          </Field>
          <Field label="Início do evento" htmlFor="dataInicio" error={c?.dataInicio}>
            <Input id="dataInicio" name="dataInicio" type="date" defaultValue={valores.dataInicio ?? ""} required />
          </Field>
          <Field label="Fim do evento" htmlFor="dataFim" error={c?.dataFim}>
            <Input id="dataFim" name="dataFim" type="date" defaultValue={valores.dataFim ?? ""} required />
          </Field>
          <Field label="Desmontagem" htmlFor="dataDesmontagem" error={c?.dataDesmontagem}>
            <Input id="dataDesmontagem" name="dataDesmontagem" type="date" defaultValue={valores.dataDesmontagem ?? ""} required />
          </Field>
          <Field label="Reunião de OS" htmlFor="dataReuniao" error={c?.dataReuniao} hint="As áreas podem enviar necessidades até este momento." className="sm:col-span-2">
            <Input id="dataReuniao" name="dataReuniao" type="datetime-local" defaultValue={valores.dataReuniao ?? ""} required />
          </Field>
          <Field label="Carga do caminhão" htmlFor="dataCarga" error={c?.dataCarga} optional hint="Só informativa: o encerramento continua sendo comando da logística.">
            <Input id="dataCarga" name="dataCarga" type="date" defaultValue={valores.dataCarga ?? ""} />
          </Field>
          <Field label="Janela de alterações até" htmlFor="janelaAlteracoesAte" error={c?.janelaAlteracoesAte} optional hint="Depois desta data, alterações ainda entram, mas chegam marcadas “fora da janela” para a logística decidir. Vazio = até encerrar.">
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
