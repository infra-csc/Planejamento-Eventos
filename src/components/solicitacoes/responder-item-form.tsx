"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useState } from "react";
import { responderItemAction } from "@/app/(app)/solicitacoes/actions";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Button, SubmitButton } from "@/components/ui/button";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";
import type { ItemOperacao, ItemStatus } from "@/server/db/schema";
import { cn } from "@/lib/cn";

export type ItemResposta = {
  id: string;
  descricao: string;
  operacao: ItemOperacao;
  quantidadeSolicitada: number;
  status: ItemStatus;
  quantidadeAtendida: number | null;
  observacaoLogistica: string | null;
  pendenciaCompra: boolean;
};

const OPCOES: Array<{ value: Exclude<ItemStatus, "EM_ANALISE">; label: string; cls: string }> = [
  { value: "ATENDIDO", label: "Atendido", cls: "data-[on=true]:bg-success-soft data-[on=true]:text-success data-[on=true]:border-success/40" },
  { value: "PARCIAL", label: "Parcial", cls: "data-[on=true]:bg-warning-soft data-[on=true]:text-warning data-[on=true]:border-warning/40" },
  { value: "NAO_ATENDIDO", label: "Não atendido", cls: "data-[on=true]:bg-danger-soft data-[on=true]:text-danger data-[on=true]:border-danger/40" },
];

export function ResponderItemForm({ item, modo, onDone }: { item: ItemResposta; modo: "responder" | "corrigir"; onDone?: () => void }) {
  const [state, action] = useActionState(responderItemAction, ESTADO_INICIAL);
  const [status, setStatus] = useState<Exclude<ItemStatus, "EM_ANALISE">>(item.status === "EM_ANALISE" ? "ATENDIDO" : item.status);
  useActionFeedback(state, onDone);
  const campos = !state.ok ? state.campos : undefined;
  const permiteParcial = item.operacao !== "REMOVER";

  return (
    <ActionForm action={action} className="space-y-3 rounded-md border border-line bg-surface-muted p-3" noValidate>
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="status" value={status} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resposta">
        {OPCOES.filter((o) => permiteParcial || o.value !== "PARCIAL").map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={status === o.value}
            data-on={status === o.value}
            onClick={() => setStatus(o.value)}
            className={cn("rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-secondary hover:bg-black/5", o.cls)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        {status === "PARCIAL" ? (
          <Field label={`Atendido (de ${item.quantidadeSolicitada})`} htmlFor={`qtd-${item.id}`} error={campos?.quantidadeAtendida}>
            <Input id={`qtd-${item.id}`} name="quantidadeAtendida" type="number" min={1} max={item.quantidadeSolicitada - 1} defaultValue={item.quantidadeAtendida ?? Math.max(1, item.quantidadeSolicitada - 1)} required />
          </Field>
        ) : (
          <div className="text-[13px] text-ink-muted sm:pt-7">{status === "ATENDIDO" ? (item.operacao === "REMOVER" ? "Linha será removida da ata." : `Quantidade: ${item.quantidadeSolicitada}`) : "Nada entra na OS."}</div>
        )}
        <Field label="Observação da logística" htmlFor={`obs-${item.id}`} error={campos?.observacaoLogistica} optional={status === "ATENDIDO"} hint={status !== "ATENDIDO" ? "Obrigatória: o solicitante recebe exatamente este texto." : undefined}>
          <Textarea id={`obs-${item.id}`} name="observacaoLogistica" defaultValue={item.observacaoLogistica ?? ""} required={status !== "ATENDIDO"} className="min-h-14" placeholder={status === "ATENDIDO" ? "Opcional" : "Ex.: só 4 em estoque; restante depende de locação"} />
        </Field>
      </div>
      {status !== "ATENDIDO" && (
        <Checkbox id={`pend-${item.id}`} name="pendenciaCompra" label="Gerar pendência de compra/locação" description="Aparece na lista de pendências para o time de compras (sem integração)." defaultChecked={item.pendenciaCompra} />
      )}
      {modo === "corrigir" && (
        <Field label="Justificativa da correção" htmlFor={`just-${item.id}`} error={campos?.justificativa}>
          <Textarea id={`just-${item.id}`} name="justificativa" required className="min-h-14" placeholder="Por que a resposta anterior está sendo alterada?" />
        </Field>
      )}
      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <SubmitButton size="sm">{modo === "corrigir" ? "Salvar correção" : "Responder item"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
