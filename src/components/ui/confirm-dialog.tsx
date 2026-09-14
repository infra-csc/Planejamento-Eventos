"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter } from "./dialog";
import { Button, SubmitButton } from "./button";
import { Field, FormError, Textarea } from "./field";
import type { ActionResult } from "@/lib/action";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Se definido, exibe campo de justificativa com este rótulo. */
  reasonLabel?: string;
  reasonRequired?: boolean;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  onSuccess?: () => void;
};

/**
 * Diálogo de confirmação ligado a uma server action. Fecha e mostra toast em sucesso;
 * mantém aberto exibindo o erro em falha.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirmar", danger, reasonLabel, reasonRequired = true, action, hidden, children, onSuccess }: Props) {
  const [state, formAction] = useActionState(action, { ok: true } as ActionResult);
  const ultimo = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state === ultimo.current) return;
    ultimo.current = state;
    if (!open) return;
    if (state.ok && "mensagem" in state && state.mensagem) {
      toast.success(state.mensagem);
      onOpenChange(false);
      onSuccess?.();
    }
  }, [state, open, onOpenChange, onSuccess]);

  const erro = !state.ok ? state.erro : null;
  const campos = !state.ok ? state.campos : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={title} description={description} size="sm">
          <ActionForm action={formAction} className="space-y-4">
            {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {children}
            {reasonLabel && (
              <Field label={reasonLabel} htmlFor="justificativa" error={campos?.justificativa} optional={!reasonRequired}>
                <Textarea id="justificativa" name="justificativa" required={reasonRequired} autoFocus placeholder="Descreva o motivo. Ficará registrado no histórico." />
              </Field>
            )}
            <FormError message={erro} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <SubmitButton variant={danger ? "danger" : "primary"}>{confirmLabel}</SubmitButton>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      )}
    </Dialog>
  );
}
