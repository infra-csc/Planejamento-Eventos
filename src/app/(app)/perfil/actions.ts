"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { encerrarOutrasSessoes, getUsuarioReal, requireUsuario } from "@/server/auth/session";
import { alterarPropriaSenha } from "@/server/services/admin";
import { registrarHistorico } from "@/server/services/support";
import { getDb } from "@/server/db";
import { alterarSenhaSchema } from "@/lib/schemas";
import { parseForm, tratarErro, type ActionResult } from "@/lib/action";

export async function alterarSenhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  let r: ActionResult;
  try {
    const d = parseForm(alterarSenhaSchema, formData);
    await alterarPropriaSenha(usuario, d.senhaAtual, d.senha);
    await encerrarOutrasSessoes(usuario.id);
    r = { ok: true, mensagem: "Senha alterada. Outros navegadores conectados à sua conta foram desconectados." };
  } catch (e) {
    return tratarErro(e, { acao: "alterarSenha", usuarioId: usuario.id });
  }
  // Troca obrigatória concluída: libera o resto do sistema.
  if (usuario.trocarSenha) redirect("/");
  return r;
}

export async function encerrarOutrasSessoesAction(): Promise<ActionResult<number>> {
  // Sempre a conta real (em "ver como" o id é o mesmo do administrador).
  const real = await getUsuarioReal();
  if (!real) redirect("/login");
  try {
    const n = await encerrarOutrasSessoes(real.id);
    await registrarHistorico(await getDb(), {
      entidade: "acesso",
      entidadeId: real.id,
      acao: "SESSOES_ENCERRADAS",
      descricao: `Encerrou ${n} ${n === 1 ? "outra sessão" : "outras sessões"}`,
      usuarioId: real.id,
    });
    revalidatePath("/perfil");
    return { ok: true, dados: n, mensagem: n === 0 ? "Não havia outras sessões abertas." : n === 1 ? "1 outra sessão encerrada." : `${n} outras sessões encerradas.` };
  } catch (e) {
    return tratarErro(e, { acao: "encerrarOutrasSessoes", usuarioId: real.id });
  }
}
