"use server";

import { redirect } from "next/navigation";
import { autenticar, encerrarSessao } from "@/server/auth/session";
import { solicitarRecuperacao, redefinirSenha } from "@/server/services/recuperacao";
import { loginSchema, recuperarSenhaSchema, redefinirSenhaSchema } from "@/lib/schemas";
import { parseForm, tratarErro, type ActionResult } from "@/lib/action";
import { destinoInterno } from "@/lib/destino";

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let destino = "/";
  try {
    const dados = parseForm(loginSchema, formData);
    destino = destinoInterno(String(formData.get("next") ?? ""), "/");
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

export async function recuperarSenhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const dados = parseForm(recuperarSenhaSchema, formData);
    await solicitarRecuperacao(dados.email);
    return { ok: true, mensagem: "Pedido registrado. Se o e-mail estiver cadastrado, o administrador vai entrar em contato com um novo link de acesso." };
  } catch (e) {
    return tratarErro(e);
  }
}

export async function redefinirSenhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const dados = parseForm(redefinirSenhaSchema, formData);
    await redefinirSenha(dados.token, dados.senha);
    // Quem abriu o link pode estar logado em outra conta (ex.: o admin testando): sai dela
    // para entrar com a senha recém-definida, em vez de ser mandado de volta ao painel.
    await encerrarSessao();
  } catch (e) {
    return tratarErro(e);
  }
  redirect("/login?redefinida=1");
}
