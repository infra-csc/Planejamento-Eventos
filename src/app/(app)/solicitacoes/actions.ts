"use server";

import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import {
  atenderTudo,
  cancelarSolicitacao,
  desfazerResposta,
  devolverSolicitacao,
  enviarSolicitacao,
  excluirRascunho,
  responderItem,
  salvarSolicitacaoCompleta,
} from "@/server/services/solicitacoes";
import { motivoOpcionalSchema, respostaItemSchema, solicitacaoCompletaSchema } from "@/lib/schemas";
import { LIMITES } from "@/domain/constantes";
import { executar, tratarErro, type ActionResult } from "@/lib/action";
import type { ItemStatus } from "@/server/db/schema";
import { revalidarTelasOperacao } from "@/server/cache-dados";

/**
 * Contadores e agregados são derivados: qualquer resposta muda navegação, painel, ata e OS. A tela atual
 * volta renderizada na resposta e o cache de navegação do cliente é limpo (ver revalidarTelasOperacao).
 */
function revalidarTudo() {
  revalidarTelasOperacao();
}

export type DadosResposta = {
  status: ItemStatus;
  quantidadeAtendida?: number | null;
  observacaoLogistica?: string | null;
  pendenciaCompra?: boolean;
  justificativa?: string | null;
};

export async function responderItemAction(itemId: string, dados: DadosResposta) {
  const usuario = await requireUsuario();
  try {
    const d = respostaItemSchema.parse({
      status: dados.status,
      quantidadeAtendida: dados.quantidadeAtendida ?? undefined,
      observacaoLogistica: dados.observacaoLogistica ?? undefined,
      pendenciaCompra: dados.pendenciaCompra ?? false,
      justificativa: dados.justificativa ?? undefined,
    });
    const r = await responderItem(usuario, itemId, d, d.justificativa);
    revalidarTudo();
    return { ok: true, dados: r } as ActionResult<typeof r>;
  } catch (e) {
    return tratarErro(e);
  }
}

export async function desfazerRespostaAction(itemId: string) {
  const usuario = await requireUsuario();
  const r = await executar(() => desfazerResposta(usuario, itemId), "Resposta desfeita");
  revalidarTudo();
  return r;
}

export async function atenderTudoAction(solicitacaoId: string) {
  const usuario = await requireUsuario();
  const r = await executar(() => atenderTudo(usuario, solicitacaoId));
  revalidarTudo();
  return r;
}

export async function enviarRascunhoAction(solicitacaoId: string) {
  const usuario = await requireUsuario();
  const r = await executar(() => enviarSolicitacao(usuario, solicitacaoId));
  revalidarTudo();
  return r;
}

export async function cancelarSolicitacaoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  const motivo = String(formData.get("justificativa") ?? "").trim() || null;
  if (!motivoOpcionalSchema.safeParse(motivo).success) return { ok: false, erro: `A justificativa deve ter no máximo ${LIMITES.justificativa} caracteres.` };
  const r = await executar(() => cancelarSolicitacao(usuario, id, motivo), "Solicitação cancelada");
  revalidarTudo();
  return r;
}

export async function devolverSolicitacaoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("solicitacaoId") ?? "");
  const motivo = String(formData.get("justificativa") ?? "").trim();
  if (!motivoOpcionalSchema.safeParse(motivo).success) return { ok: false, erro: `O motivo deve ter no máximo ${LIMITES.justificativa} caracteres.` };
  const r = await executar(() => devolverSolicitacao(usuario, id, motivo), "Solicitação devolvida — volta como rascunho para a área");
  revalidarTudo();
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
  revalidarTudo();
  redirect("/solicitacoes?filtro=RASCUNHO");
}

export async function salvarSolicitacaoCompletaAction(payload: unknown) {
  const usuario = await requireUsuario();
  try {
    const d = solicitacaoCompletaSchema.parse(payload);
    const r = await salvarSolicitacaoCompleta(usuario, d);
    // O autosave chama isto a cada pausa de digitação; só vale re-renderizar quando muda algo fora do formulário.
    if (d.enviar || !d.id) revalidarTudo();
    return { ok: true, dados: r } as ActionResult<typeof r>;
  } catch (e) {
    return tratarErro(e);
  }
}
