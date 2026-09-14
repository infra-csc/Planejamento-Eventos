"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import {
  atualizarCabecalho,
  cancelarSolicitacao,
  criarRascunho,
  devolverSolicitacao,
  enviarSolicitacao,
  excluirRascunho,
  removerItem,
  responderItem,
  salvarItem,
} from "@/server/services/solicitacoes";
import { respostaItemSchema, solicitacaoCabecalhoSchema, solicitacaoItemSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";

function revalidar(solicitacaoId: string, eventoId?: string) {
  revalidatePath(`/solicitacoes/${solicitacaoId}`);
  revalidatePath("/solicitacoes");
  revalidatePath("/");
  if (eventoId) revalidatePath(`/eventos/${eventoId}`, "layout");
}

export async function criarRascunhoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  let id: string;
  try {
    const s = await criarRascunho(usuario, eventoId);
    id = s.id;
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/solicitacoes");
  redirect(`/solicitacoes/${id}`);
}

export async function atualizarCabecalhoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(solicitacaoCabecalhoSchema, formData);
    r = await executar(() => atualizarCabecalho(usuario, id, dados), "Rascunho salvo.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidar(id);
  return r;
}

export async function salvarItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const solicitacaoId = String(formData.get("solicitacaoId") ?? "");
  const itemId = String(formData.get("itemId") ?? "") || null;
  let r: ActionResult;
  try {
    const dados = parseForm(solicitacaoItemSchema, formData);
    r = await executar(() => salvarItem(usuario, solicitacaoId, itemId, dados), itemId ? "Item atualizado." : "Item adicionado.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidar(solicitacaoId);
  return r;
}

export async function removerItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const solicitacaoId = String(formData.get("solicitacaoId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const r = await executar(() => removerItem(usuario, solicitacaoId, itemId), "Item removido.");
  revalidar(solicitacaoId);
  return r;
}

export async function enviarSolicitacaoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  const eventoId = String(formData.get("eventoId") ?? "");
  const r = await executar(() => enviarSolicitacao(usuario, id), "Solicitação enviada. A logística foi notificada.");
  revalidar(id, eventoId);
  return r;
}

export async function cancelarSolicitacaoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  const eventoId = String(formData.get("eventoId") ?? "");
  const motivo = String(formData.get("justificativa") ?? "").trim() || null;
  const r = await executar(() => cancelarSolicitacao(usuario, id, motivo), "Solicitação cancelada.");
  revalidar(id, eventoId);
  return r;
}

export async function excluirRascunhoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  try {
    await excluirRascunho(usuario, id);
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/solicitacoes");
  redirect("/solicitacoes");
}

export async function devolverSolicitacaoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  const eventoId = String(formData.get("eventoId") ?? "");
  const motivo = String(formData.get("justificativa") ?? "");
  const r = await executar(() => devolverSolicitacao(usuario, id, motivo), "Solicitação devolvida para ajuste.");
  revalidar(id, eventoId);
  return r;
}

export async function responderItemAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const itemId = String(formData.get("itemId") ?? "");
  let r: ActionResult<{ status: string }>;
  try {
    const dados = parseForm(respostaItemSchema, formData);
    r = await executar(() => responderItem(usuario, itemId, dados, dados.justificativa), "Resposta registrada. O solicitante foi notificado.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath("/solicitacoes", "layout");
  revalidatePath("/eventos", "layout");
  revalidatePath("/");
  return r;
}
