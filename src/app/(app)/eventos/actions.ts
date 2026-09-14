"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import {
  alterarQuantidadeLinha,
  atualizarVersaoLinha,
  criarEvento,
  editarEvento,
  incluirLinhaAta,
  salvarObservacoesReuniao,
  transicionarEvento,
} from "@/server/services/eventos";
import { criarRascunho } from "@/server/services/solicitacoes";
import { ataAlterarQuantidadeSchema, ataLinhaSchema, eventoSchema, justificativaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";
import { parseDateTimeLocal } from "@/lib/format";
import { ACOES_EVENTO, TRANSICOES_EVENTO, type AcaoEvento } from "@/domain/evento";
import { ValidacaoError } from "@/domain/errors";
import { z } from "zod";

export async function salvarEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  let destino: string;
  try {
    const dados = parseForm(eventoSchema, formData);
    const dataReuniao = parseDateTimeLocal(dados.dataReuniao);
    if (!dataReuniao) throw new ValidacaoError("Data da reunião inválida.", { dataReuniao: "Informe data e hora." });
    const payload = { ...dados, dataReuniao };
    if (id) {
      await editarEvento(usuario, id, payload);
      destino = `/eventos/${id}`;
    } else {
      const ev = await criarEvento(usuario, payload);
      destino = `/eventos/${ev.id}`;
    }
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/eventos");
  redirect(destino);
}

export async function transicionarEventoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  const acao = String(formData.get("acao") ?? "") as AcaoEvento;
  if (!ACOES_EVENTO.includes(acao)) return { ok: false, erro: "Ação inválida." };
  const justificativa = String(formData.get("justificativa") ?? "").trim() || null;
  if (TRANSICOES_EVENTO[acao].exigeJustificativa) {
    try {
      parseForm(justificativaSchema, formData);
    } catch (e) {
      return tratarErro(e);
    }
  }
  const r = await executar(() => transicionarEvento(usuario, eventoId, acao, justificativa), `${TRANSICOES_EVENTO[acao].label}: concluído.`);
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath("/eventos");
  revalidatePath("/");
  return r;
}

export async function salvarObservacoesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  const obs = String(formData.get("observacoes") ?? "").trim() || null;
  const r = await executar(() => salvarObservacoesReuniao(usuario, eventoId, obs), "Observações salvas.");
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function incluirLinhaAtaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(ataLinhaSchema, formData);
    r = await executar(() => incluirLinhaAta(usuario, eventoId, dados), "Linha incluída na ata.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function alterarQuantidadeLinhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  const linhaId = String(formData.get("linhaId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(ataAlterarQuantidadeSchema, formData);
    r = await executar(() => alterarQuantidadeLinha(usuario, eventoId, linhaId, dados.quantidade, dados.justificativa), dados.quantidade === 0 ? "Linha removida da ata." : "Quantidade alterada.");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function atualizarVersaoLinhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  const linhaId = String(formData.get("linhaId") ?? "");
  const r = await executar(() => atualizarVersaoLinha(usuario, eventoId, linhaId), "Projeto atualizado para a versão atual.");
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function criarRascunhoAction(formData: FormData) {
  const usuario = await requireUsuario();
  const eventoId = z.string().min(1).parse(formData.get("eventoId"));
  const s = await criarRascunho(usuario, eventoId);
  revalidatePath("/solicitacoes");
  redirect(`/solicitacoes/${s.id}`);
}
