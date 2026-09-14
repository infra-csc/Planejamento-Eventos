"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { alterarAtivoUsuario, criarUsuario, editarUsuario, gerarNovoLinkAcesso, salvarArea, salvarConfig } from "@/server/services/admin";
import { areaSchema, configuracoesSchema, usuarioSchema } from "@/lib/schemas";
import { executar, tratarErro, type ActionResult } from "@/lib/action";

function revalidarAdmin() {
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function salvarUsuarioAction(payload: { id?: string | null; nome: string; email: string; perfil: string; areaId: string | null; ativo: boolean }) {
  const usuario = await requireUsuario();
  try {
    const d = usuarioSchema.parse({ ...payload, areaId: payload.areaId ?? undefined, senha: undefined });
    let resultado: { nome: string; linkAcesso: string | null; criado: boolean };
    if (payload.id) {
      await editarUsuario(usuario, payload.id, d);
      resultado = { nome: d.nome, linkAcesso: null, criado: false };
    } else {
      const u = await criarUsuario(usuario, d);
      resultado = { nome: u.nome, linkAcesso: u.linkAcesso, criado: true };
    }
    revalidarAdmin();
    return { ok: true, dados: resultado } as ActionResult<typeof resultado>;
  } catch (e) {
    return tratarErro(e);
  }
}

export async function alternarAtivoUsuarioAction(id: string, ativo: boolean) {
  const usuario = await requireUsuario();
  const r = await executar(() => alterarAtivoUsuario(usuario, id, ativo));
  revalidarAdmin();
  return r;
}

export async function gerarLinkAcessoAction(id: string) {
  const usuario = await requireUsuario();
  return executar(() => gerarNovoLinkAcesso(usuario, id));
}

export async function salvarAreaAction(payload: { id?: string | null; nome: string; ativo: boolean }) {
  const usuario = await requireUsuario();
  try {
    const d = areaSchema.parse(payload);
    const r = await executar(() => salvarArea(usuario, payload.id ?? null, d), payload.id ? "Área atualizada" : "Área criada");
    revalidarAdmin();
    return r;
  } catch (e) {
    return tratarErro(e);
  }
}

export async function salvarConfigAction(payload: Record<string, string | number | boolean>) {
  const usuario = await requireUsuario();
  try {
    const d = configuracoesSchema.parse(payload);
    const r = await executar(
      () =>
        salvarConfig(usuario, {
          sla_resposta_horas: String(d.sla_resposta_horas),
          aviso_prazo_horas: String(d.aviso_prazo_horas),
          antecedencia_reuniao_horas: String(d.antecedencia_reuniao_horas),
          lembrete_reuniao_dias: String(d.lembrete_reuniao_dias),
          bloquear_encerramento_com_pendentes: String(d.bloquear_encerramento_com_pendentes),
        }),
      "Configurações salvas",
    );
    revalidarAdmin();
    return r;
  } catch (e) {
    return tratarErro(e);
  }
}
