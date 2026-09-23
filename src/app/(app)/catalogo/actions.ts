"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { alterarAtivoPeca, criarPeca, editarPeca, impactoInativacaoPeca } from "@/server/services/catalogo";
import { pecaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";

export async function salvarPecaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  try {
    const dados = parseForm(pecaSchema, formData);
    if (id) await editarPeca(usuario, id, dados);
    else await criarPeca(usuario, dados);
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/catalogo");
  revalidatePath("/biblioteca");
  // Catálogo em cache (listas de peças e opções dos formulários): expira já.
  invalidarDados(TAGS_DADOS.catalogo);
  redirect("/catalogo");
}

export async function alterarAtivoPecaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  const r = await executar(() => alterarAtivoPeca(usuario, id, ativo), ativo ? "Peça reativada." : "Peça inativada.");
  revalidatePath("/catalogo", "layout");
  revalidatePath("/biblioteca");
  invalidarDados(TAGS_DADOS.catalogo);
  return r;
}

/** Projetos e pedidos em aberto que usam a peça: a tela mostra antes de confirmar a inativação. */
export async function impactoInativacaoPecaAction(id: string) {
  const usuario = await requireUsuario();
  if (typeof id !== "string" || !id) return { ok: false, erro: "Dados inválidos." } as const;
  return executar(() => impactoInativacaoPeca(usuario, id));
}
