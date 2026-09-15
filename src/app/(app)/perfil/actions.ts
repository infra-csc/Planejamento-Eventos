"use server";

import { encerrarOutrasSessoes, requireUsuario } from "@/server/auth/session";
import { alterarPropriaSenha } from "@/server/services/admin";
import { alterarSenhaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";

export async function alterarSenhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  try {
    const d = parseForm(alterarSenhaSchema, formData);
    const r = await executar(() => alterarPropriaSenha(usuario, d.senhaAtual, d.senha), "Senha alterada. Outros navegadores conectados à sua conta foram desconectados.");
    if (r.ok) await encerrarOutrasSessoes(usuario.id);
    return r;
  } catch (e) {
    return tratarErro(e);
  }
}
