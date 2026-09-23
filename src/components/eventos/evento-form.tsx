"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarEventoAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Section } from "@/components/ui/layout";
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
 * Cadastro do evento: só o essencial, em duas seções curtas. O responsável é quem cria o evento;
 * montagem, fim, desmontagem e carga não são pedidos (o período interno sai da data do evento).
 * No celular, as ações ficam fixas no rodapé da tela, com o botão principal em largura cheia.
 */
export function EventoForm({ valores, cancelarHref }: { valores: EventoFormValores; cancelarHref: string }) {
  const [state, action] = useActionState(salvarEventoAction, ESTADO_INICIAL);
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} noValidate className="flex flex-col gap-4">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      <Section titulo="Evento" padded>
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="nome" error={c?.nome} obrigatorio className="sm:col-span-2">
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required autoFocus placeholder="Ex.: Festival de Verão 2026" />
          </Field>
          <Field label="Cliente" htmlFor="cliente" error={c?.cliente} optional>
            <Input id="cliente" name="cliente" defaultValue={valores.cliente ?? ""} />
          </Field>
          <Field label="Local" htmlFor="local" error={c?.local} optional>
            <Input id="local" name="local" defaultValue={valores.local ?? ""} placeholder="Ex.: Parque da Cidade — Arena Sul" />
          </Field>
        </div>
      </Section>

      <Section titulo="Datas" padded>
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field label="Data do evento" htmlFor="dataInicio" error={c?.dataInicio} obrigatorio hint="Mais de um dia: informe o primeiro.">
            <Input id="dataInicio" name="dataInicio" type="date" defaultValue={valores.dataInicio ?? ""} required className="numero" />
          </Field>
          <Field label="Reunião de OS" htmlFor="dataReuniao" error={c?.dataReuniao} obrigatorio hint="A logística confere tudo o que as áreas pediram. Envios vão até aqui.">
            <Input id="dataReuniao" name="dataReuniao" type="datetime-local" defaultValue={valores.dataReuniao ?? ""} required className="numero" />
          </Field>
          <Field label="Alterações até" htmlFor="janelaAlteracoesAte" error={c?.janelaAlteracoesAte} optional hint="Pode ficar para depois. Passada a data, alterações chegam “fora da janela”.">
            <Input id="janelaAlteracoesAte" name="janelaAlteracoesAte" type="date" defaultValue={valores.janelaAlteracoesAte ?? ""} className="numero" />
          </Field>
        </div>
      </Section>

      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-wrap items-center gap-2 max-md:sticky max-md:bottom-0 max-md:z-10 max-sm:-mx-4 sm:max-md:-mx-5 max-md:border-t max-md:border-line max-md:bg-page/95 max-sm:px-4 sm:max-md:px-5 max-md:py-3 max-md:backdrop-blur-sm">
        <SubmitButton size="lg" className="max-md:flex-1">
          {valores.id ? "Salvar alterações" : "Criar evento"}
        </SubmitButton>
        <ButtonLink href={cancelarHref} variant="ghost" size="lg" className="no-underline">
          Cancelar
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
