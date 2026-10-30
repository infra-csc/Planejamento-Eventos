"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { resolverPendenciaCompra } from "@/server/services/solicitacoes";
import { executar, type ActionResult } from "@/lib/action";
import { TELAS_INATIVAS } from "@/domain/telas";

/** "Marcar como resolvida" (ConfirmDialog): observação obrigatória no campo `justificativa`. */
export async function resolverPendenciaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  // Tela desligada: a action também (antes processava chamada direta; auditoria 30/10, parte C, nota LOG).
  if (TELAS_INATIVAS.pendencias) return { ok: false, erro: "As pendências de compra estão desligadas. Fale com o administrador se precisar delas." };
  const itemId = String(formData.get("itemId") ?? "");
  const observacao = String(formData.get("justificativa") ?? "");
  if (!itemId) return { ok: false, erro: "Não foi possível concluir. Atualize a página e tente de novo." };
  const r = await executar(() => resolverPendenciaCompra(usuario, itemId, observacao), "Pendência marcada como resolvida");
  if (r.ok) {
    revalidatePath("/pendencias");
    revalidatePath("/consolidacao");
    revalidatePath(`/solicitacoes/${r.dados?.solicitacaoId ?? ""}`);
  }
  return r;
}
