"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { criarUsuario, editarUsuario, salvarArea, salvarConfig } from "@/server/services/admin";
import { areaSchema, configuracoesSchema, usuarioSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";

export async function salvarUsuarioAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  let r: ActionResult;
  try {
    const dados = parseForm(usuarioSchema, formData);
    r = await executar(async () => {
      if (id) await editarUsuario(usuario, id, dados);
      else await criarUsuario(usuario, dados);
    }, id ? "Usuário atualizado." : "Usuário criado.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath("/admin/usuarios");
  return r;
}

export async function salvarAreaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  let r: ActionResult;
  try {
    const dados = parseForm(areaSchema, formData);
    r = await executar(() => salvarArea(usuario, id, dados), id ? "Área atualizada." : "Área criada.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath("/admin/areas");
  return r;
}

export async function salvarConfigAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  let r: ActionResult;
  try {
    const d = parseForm(configuracoesSchema, formData);
    r = await executar(
      () =>
        salvarConfig(usuario, {
          sla_resposta_horas: String(d.sla_resposta_horas),
          lembrete_reuniao_dias: String(d.lembrete_reuniao_dias),
          bloquear_encerramento_com_pendentes: String(d.bloquear_encerramento_com_pendentes),
        }),
      "Configurações salvas.",
    );
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath("/admin/configuracoes");
  return r;
}
