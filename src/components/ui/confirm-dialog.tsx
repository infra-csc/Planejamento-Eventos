"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "./dialog";
import { Button, SubmitButton } from "./button";
import { Field, FormError, Textarea } from "./field";
import { toast } from "./toast";
import type { ActionResult } from "@/lib/action";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Rótulo do botão que fecha sem fazer nada (padrão "Cancelar"). */
  cancelLabel?: string;
  danger?: boolean;
  /** Se definido, exibe campo de justificativa com este rótulo. */
  reasonLabel?: string;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  onSuccess?: (resultado: ActionResult) => void;
};

/**
 * Confirmação ligada a uma server action. Fecha e mostra toast em sucesso;
 * mantém aberta com o erro em falha.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger, reasonLabel, reasonRequired = true, reasonPlaceholder, action, hidden, children, onSuccess }: Props) {
  const [state, formAction] = useActionState(action, { ok: true } as ActionResult);
  const ultimo = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (ultimo.current === null) {
      ultimo.current = state;
      return;
    }
    if (state === ultimo.current) return;
    ultimo.current = state;
    if (!open) return;
    if (state.ok) {
      if (state.mensagem) toast(state.mensagem);
      onOpenChange(false);
      onSuccess?.(state);
    }
  }, [state, open, onOpenChange, onSuccess]);

  const erro = !state.ok ? state.erro : null;
  const campos = !state.ok ? state.campos : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={title} description={description}>
          <ActionForm action={formAction} className="flex flex-col gap-3.5">
            {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {children}
            {reasonLabel && (
              <Field label={reasonLabel} htmlFor="justificativa" error={campos?.justificativa} obrigatorio={reasonRequired}>
                <Textarea id="justificativa" name="justificativa" required={reasonRequired} autoFocus placeholder={reasonPlaceholder ?? "Fica registrado no histórico, com seu nome e a hora."} />
              </Field>
            )}
            <FormError message={erro} />
            <DialogFooter>
              <SubmitButton variant={danger ? "danger" : "primary"} size="lg">
                {confirmLabel}
              </SubmitButton>
              <DialogClose asChild>
                <Button variant="secondary" size="lg">
                  {cancelLabel}
                </Button>
              </DialogClose>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      )}
    </Dialog>
  );
}
