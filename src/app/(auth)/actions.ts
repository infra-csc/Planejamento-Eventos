"use server";

import { redirect } from "next/navigation";
import { autenticar, encerrarSessao } from "@/server/auth/session";
import { solicitarRecuperacao, redefinirSenha } from "@/server/services/recuperacao";
import { loginSchema, recuperarSenhaSchema, redefinirSenhaSchema } from "@/lib/schemas";
import { parseForm, tratarErro, type ActionResult } from "@/lib/action";

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let destino = "/";
  try {
    const dados = parseForm(loginSchema, formData);
    const next = String(formData.get("next") ?? "");
    if (next.startsWith("/") && !next.startsWith("//")) destino = next;
    const r = await autenticar(dados.email, dados.senha);
    if (!r.ok) return { ok: false, erro: r.erro };
  } catch (e) {
    return tratarErro(e);
  }
  redirect(destino);
}

export async function logoutAction() {
  await encerrarSessao();
  redirect("/login");
}

export async function recuperarSenhaAction(_prev: ActionResult<{ link: string | null }>, formData: FormData): Promise<ActionResult<{ link: string | null }>> {
  try {
    const dados = parseForm(recuperarSenhaSchema, formData);
    const r = await solicitarRecuperacao(dados.email);
    return { ok: true, dados: r, mensagem: "Se o e-mail existir, um link de redefinição foi gerado." };
  } catch (e) {
    return tratarErro(e);
  }
}

export async function redefinirSenhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const dados = parseForm(redefinirSenhaSchema, formData);
    await redefinirSenha(dados.token, dados.senha);
  } catch (e) {
    return tratarErro(e);
  }
  redirect("/login?redefinida=1");
}
