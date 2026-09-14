"use server";

import { requireUsuario } from "@/server/auth/session";
import { alterarPropriaSenha } from "@/server/services/admin";
import { alterarSenhaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";

export async function alterarSenhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  try {
    const d = parseForm(alterarSenhaSchema, formData);
    return await executar(() => alterarPropriaSenha(usuario, d.senhaAtual, d.senha), "Senha alterada.");
  } catch (e) {
    return tratarErro(e);
  }
}
