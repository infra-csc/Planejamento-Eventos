"use client";

import { useActionState, useEffect } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { salvarDadosReuniaoAction } from "@/app/(app)/eventos/actions";
import { ESTADO_INICIAL } from "@/lib/action";
import { toast } from "@/components/ui/toast";

export type DadosReuniaoValores = {
  reuniaoPresentes: string | null;
  publicoEsperado: number | null;
  caminhaoCarrega: string | null;
  caminhaoSai: string | null;
  arenaDescarrega: string | null;
  kitDescarrega: string | null;
};

/**
 * Campos da ata que a logística preenche na reunião (os mesmos da planilha de ata):
 * presentes, público esperado e a logística de carga/descarga. Congelam no fechamento.
 */
export function DadosReuniaoForm({ eventoId, valores, editavel }: { eventoId: string; valores: DadosReuniaoValores; editavel: boolean }) {
  const [state, action] = useActionState(salvarDadosReuniaoAction, ESTADO_INICIAL);
  const c = !state.ok ? state.campos : undefined;
  useEffect(() => {
    if (state.ok && state !== ESTADO_INICIAL) toast("Dados da reunião salvos");
  }, [state]);

  const campo = (nome: keyof DadosReuniaoValores, label: string, placeholder: string, hint?: string) => (
    <Field label={label} htmlFor={nome} error={c?.[nome]} hint={hint} optional>
      <Input id={nome} name={nome} defaultValue={valores[nome] ?? ""} placeholder={placeholder} disabled={!editavel} />
    </Field>
  );

  return (
    <ActionForm action={action} noValidate className="space-y-3.5 px-[18px] py-3.5">
      <input type="hidden" name="eventoId" value={eventoId} />
      <Field label="Pessoas presentes" htmlFor="reuniaoPresentes" error={c?.reuniaoPresentes} hint="Obrigatório para fechar a ata. Nome e área, separados por vírgula." obrigatorio>
        <textarea
          id="reuniaoPresentes"
          name="reuniaoPresentes"
          defaultValue={valores.reuniaoPresentes ?? ""}
          disabled={!editavel}
          placeholder="Ex.: Marina (Logística), Paulo (Produção), Júlia (Ativação)"
          className="min-h-[72px] w-full resize-y rounded-lg border border-line-control bg-surface px-3 py-2.5 text-[13.5px] leading-[1.5] text-ink placeholder:text-meta focus:border-accent focus:outline-none disabled:bg-subtle"
        />
      </Field>
      <Field label="Público esperado" htmlFor="publicoEsperado" error={c?.publicoEsperado} optional>
        <Input id="publicoEsperado" name="publicoEsperado" inputMode="numeric" defaultValue={valores.publicoEsperado ?? ""} placeholder="Ex.: 11000" disabled={!editavel} className="w-[160px] font-mono" />
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {campo("caminhaoCarrega", "Caminhão carrega", "Ex.: 08/06 às 14h")}
        {campo("caminhaoSai", "Caminhão sai", "Ex.: 09/06 às 6h")}
        {campo("arenaDescarrega", "Arena descarrega", "Ex.: 09/06 às 22h")}
        {campo("kitDescarrega", "Kit descarrega", "Ex.: 10/06 às 8h")}
      </div>
      <FormError message={!state.ok ? state.erro : null} />
      {editavel && (
        <div className="flex justify-end">
          <SubmitButton variant="secondary">Salvar dados da reunião</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
