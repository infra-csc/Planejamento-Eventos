"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { resolverPendenciaCompra } from "@/server/services/solicitacoes";
import { executar, type ActionResult } from "@/lib/action";

/** "Marcar como resolvida" (ConfirmDialog): observação obrigatória no campo `justificativa`. */
export async function resolverPendenciaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const itemId = String(formData.get("itemId") ?? "");
  const observacao = String(formData.get("justificativa") ?? "");
  if (!itemId) return { ok: false, erro: "Dados inválidos." };
  const r = await executar(() => resolverPendenciaCompra(usuario, itemId, observacao), "Pendência marcada como resolvida");
  if (r.ok) {
    revalidatePath("/pendencias");
    revalidatePath("/consolidacao");
    revalidatePath(`/solicitacoes/${r.dados?.solicitacaoId ?? ""}`);
  }
  return r;
}
