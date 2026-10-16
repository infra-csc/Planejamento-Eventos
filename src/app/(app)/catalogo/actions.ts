"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { adicionarAnexoPeca, alterarAtivoPeca, criarPeca, editarPeca, impactoInativacaoPeca, removerAnexoPeca } from "@/server/services/catalogo";
import { pecaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";

export async function salvarPecaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  let novaId: string | null = null;
  try {
    const dados = parseForm(pecaSchema, formData);
    if (id) await editarPeca(usuario, id, dados);
    else novaId = (await criarPeca(usuario, dados)).id;
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/catalogo");
  revalidatePath("/biblioteca");
  // Catálogo em cache (listas de peças e opções dos formulários): expira já.
  invalidarDados(TAGS_DADOS.catalogo);
  // Peça nova vai para a própria página, já no ponto de incluir fotos e anexos.
  redirect(novaId ? `/catalogo/${novaId}/editar?nova=1#fotos` : "/catalogo");
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

const revalidarAnexos = (pecaId: string) => {
  revalidatePath(`/catalogo/${pecaId}/editar`);
  revalidatePath("/biblioteca");
  invalidarDados(TAGS_DADOS.catalogo);
};

/** Um arquivo por chamada (a tela envia um de cada vez; as fotos já vão reduzidas pelo navegador). */
export async function adicionarAnexoPecaAction(form: FormData) {
  const usuario = await requireUsuario();
  const pecaId = String(form.get("pecaId") ?? "");
  const arquivo = form.get("arquivo");
  if (!pecaId || !(arquivo instanceof File)) return { ok: false, erro: "Escolha uma foto ou um PDF." } as const;
  const r = await executar(() => adicionarAnexoPeca(usuario, pecaId, arquivo));
  revalidarAnexos(pecaId);
  return r;
}

export async function removerAnexoPecaAction(anexoId: string) {
  const usuario = await requireUsuario();
  if (typeof anexoId !== "string" || !anexoId) return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => removerAnexoPeca(usuario, anexoId), "Arquivo removido.");
  if (r.ok && r.dados) revalidarAnexos(r.dados);
  return r;
}
