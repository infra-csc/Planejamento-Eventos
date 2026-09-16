"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { alterarAtivoPeca, criarPeca, editarPeca } from "@/server/services/catalogo";
import { pecaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";

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
  redirect("/catalogo");
}

export async function alterarAtivoPecaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  const r = await executar(() => alterarAtivoPeca(usuario, id, ativo), ativo ? "Peça reativada." : "Peça inativada.");
  revalidatePath("/catalogo");
  revalidatePath("/biblioteca");
  return r;
}
