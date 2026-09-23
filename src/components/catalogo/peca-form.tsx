"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarPecaAction } from "@/app/(app)/catalogo/actions";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Aviso, Section } from "@/components/ui/layout";
import { Numero } from "@/components/ui/numero";
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
    <ActionForm action={action} noValidate className="flex flex-col gap-5">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}

      <Section titulo="Identificação" sub="Como a peça aparece no catálogo, nos projetos e nas OS.">
        <div className="grid gap-4 px-cartao py-4 sm:grid-cols-2">
          <Field label="Código" htmlFor="codigo" error={c?.codigo} hint="Curto e único. Ex.: BOX-600, TND-MASTRO, MDF-15" obrigatorio>
            <Input id="codigo" name="codigo" defaultValue={valores.codigo ?? ""} required autoFocus className="font-mono uppercase" maxLength={30} />
          </Field>
          <Field label="Nome descritivo" htmlFor="nome" error={c?.nome} obrigatorio>
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required placeholder="Ex.: Box truss 600 mm (trecho 3 m)" />
          </Field>
          <Field label="Descrição" htmlFor="descricao" optional className="sm:col-span-2">
            <Textarea id="descricao" name="descricao" defaultValue={valores.descricao ?? ""} className="min-h-16" />
          </Field>
        </div>
      </Section>

      <Section titulo="Classificação e estoque" sub="Onde a peça é executada e quanto a empresa tem.">
        <div className="grid gap-4 px-cartao py-4 sm:grid-cols-2">
          <Field label="Setor de execução" htmlFor="setor" error={c?.setor} hint="Define em qual OS a peça aparece." obrigatorio>
            <Select id="setor" name="setor" defaultValue={valores.setor ?? "ESTRUTURA"} ordenarAlfabetico={false} opcoes={SETORES.map((s) => ({ value: s, label: SETOR_LABEL[s] }))} />
          </Field>
          <Field label="Família" htmlFor="familia" optional hint="Box truss, Conexão, Fixação, Tenda, Chapa…">
            <Input id="familia" name="familia" defaultValue={valores.familia ?? ""} maxLength={60} />
          </Field>
          <Field label="Unidade" htmlFor="unidade" error={c?.unidade} hint="Ex.: un, m, m², par." obrigatorio>
            <Input id="unidade" name="unidade" defaultValue={valores.unidade ?? "un"} maxLength={10} />
          </Field>
          <Field label="Estoque próprio" htmlFor="estoqueProprio" error={c?.estoqueProprio} hint="Quantidade da empresa. Usado na consolidação por período (integração futura com o sistema de Logística).">
            <Input id="estoqueProprio" name="estoqueProprio" type="number" min={0} defaultValue={valores.estoqueProprio ?? 0} className="numero" />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox id="permiteEmProjeto" name="permiteEmProjeto" label="Pode entrar na lista de peças de projetos padrão" description="Desmarque para peças sempre lançadas avulsas com destino, como fechamento de tenda." defaultChecked={valores.permiteEmProjeto ?? true} />
          </div>
        </div>
      </Section>

      {usos && usos.length > 0 && (
        <Aviso tom="info" titulo={`Usada em ${usos.length} ${usos.length === 1 ? "projeto ativo" : "projetos ativos"}`}>
          {usos.map((u, i) => (
            <span key={u.id}>
              {i > 0 && ", "}
              {u.nome} (<Numero valor={u.quantidade} />)
            </span>
          ))}
        </Aviso>
      )}

      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
        <SubmitButton size="lg" className="max-sm:w-full">
          {valores.id ? "Salvar" : "Cadastrar peça"}
        </SubmitButton>
        <ButtonLink href={cancelarHref} variant="secondary" size="lg" className="no-underline max-sm:w-full">
          Cancelar
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
