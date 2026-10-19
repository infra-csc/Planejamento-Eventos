"use client";

import { cn } from "@/lib/cn";
import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "./dialog";
import { Button, SubmitButton } from "./button";
import { Field, FormError, Textarea } from "./field";
import { toastSucesso } from "./toast";
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
      if (state.mensagem) toastSucesso(state.mensagem);
      onOpenChange(false);
      onSuccess?.(state);
    }
  }, [state, open, onOpenChange, onSuccess]);

  const erro = !state.ok ? state.erro : null;
  const campos = !state.ok ? state.campos : undefined;
  // Só título, texto e botões: sem corpo, os botões encostam no cabeçalho (sem uma faixa vazia no meio).
  const semCorpo = !children && !reasonLabel && !erro;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={title} description={description}>
          <ActionForm action={formAction} className={cn("flex flex-col gap-3.5", semCorpo && "-mt-4")}>
            {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {children}
            {reasonLabel && (
              <Field label={reasonLabel} htmlFor="justificativa" error={campos?.justificativa} obrigatorio={reasonRequired}>
                <Textarea id="justificativa" name="justificativa" required={reasonRequired} autoFocus placeholder={reasonPlaceholder ?? "Fica registrado no histórico, com seu nome e a hora."} />
              </Field>
            )}
            <FormError message={erro} />
            {/* O formulário já espaça os filhos (gap-3.5): sem o mt-4 padrão, o respiro antes dos botões fica igual ao das outras janelas. */}
            <DialogFooter className={semCorpo ? "!mt-0 border-t-0" : "!mt-0.5"}>
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
