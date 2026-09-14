"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { alterarAtivoProjeto, anexarArquivo, criarProjeto, editarProjeto, removerAnexo } from "@/server/services/projetos";
import { projetoSchema } from "@/lib/schemas";
import { executar, tratarErro, type ActionResult } from "@/lib/action";

export async function salvarProjetoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  let destino: string;
  try {
    const itensRaw = JSON.parse(String(formData.get("itens") ?? "[]")) as unknown;
    const dados = projetoSchema.parse({
      nome: formData.get("nome"),
      categoria: formData.get("categoria"),
      descricao: formData.get("descricao"),
      observacaoVersao: formData.get("observacaoVersao"),
      itens: itensRaw,
    });
    if (id) {
      await editarProjeto(usuario, id, dados);
      destino = `/projetos/${id}`;
    } else {
      const p = await criarProjeto(usuario, dados);
      destino = `/projetos/${p.id}`;
    }
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/projetos");
  redirect(destino);
}

export async function alterarAtivoProjetoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  const r = await executar(() => alterarAtivoProjeto(usuario, id, ativo), ativo ? "Projeto reativado." : "Projeto inativado.");
  revalidatePath("/projetos");
  revalidatePath(`/projetos/${id}`);
  return r;
}

export async function anexarArquivoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const projetoId = String(formData.get("projetoId") ?? "");
  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { ok: false, erro: "Selecione um arquivo." };
  const r = await executar(() => anexarArquivo(usuario, projetoId, file), "Anexo adicionado.");
  revalidatePath(`/projetos/${projetoId}`);
  return r;
}

export async function removerAnexoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const anexoId = z.string().min(1).parse(formData.get("anexoId"));
  const r = await executar(() => removerAnexo(usuario, anexoId), "Anexo removido.");
  if (r.ok && r.dados) revalidatePath(`/projetos/${r.dados}`);
  revalidatePath("/projetos");
  return r;
}
