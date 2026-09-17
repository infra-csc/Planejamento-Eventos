"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import {
  alterarQuantidadeLinha,
  atualizarVersaoLinha,
  conferirLinha,
  conferirTodasLinhas,
  salvarDadosReuniao,
  criarEvento,
  editarEvento,
  incluirLinhaAta,
  salvarObservacoesReuniao,
  transicionarEvento,
} from "@/server/services/eventos";
import { ataAlterarQuantidadeSchema, ataLinhaSchema, dadosReuniaoSchema, eventoSchema, justificativaSchema } from "@/lib/schemas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";
import { parseDateTimeLocal } from "@/lib/format";
import { ACOES_EVENTO, TRANSICOES_EVENTO, type AcaoEvento } from "@/domain/evento";
import { ValidacaoError } from "@/domain/errors";
import { ajustarLinhaNaConferencia } from "@/server/services/conferencia";

function revalidarTudo() {
  revalidatePath("/", "layout");
}

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
  revalidarTudo();
  redirect(destino);
}

const MENSAGENS: Record<AcaoEvento, (os: number | null) => string> = {
  INICIAR_REUNIAO: () => "Reunião iniciada — envios de necessidades bloqueados",
  VOLTAR_PREPARACAO: () => "Reunião adiada — as áreas voltam a poder enviar",
  FECHAR_ATA: (os) => `Ata fechada — OS v${os ?? 1} gerada e áreas notificadas`,
  ENCERRAR: (os) => `Evento encerrado — OS final v${os ?? ""} gerada`,
  REABRIR: () => "Evento reaberto em exceção — áreas e logística notificadas",
  CANCELAR: () => "Evento cancelado",
};

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
  let r: ActionResult;
  try {
    const ev = await transicionarEvento(usuario, eventoId, acao, justificativa);
    r = { ok: true, mensagem: MENSAGENS[acao](ev.osNumero) };
  } catch (e) {
    r = tratarErro(e);
  }
  revalidarTudo();
  return r;
}

/** Autosave das observações da reunião (textarea da aba Consolidar ata). */
export async function salvarObservacoesAction(eventoId: string, texto: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof texto !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  if (texto.length > 10_000) return { ok: false, erro: "As observações passam do limite de 10.000 caracteres." } as const;
  // Sem revalidatePath: o texto vive no estado do cliente e nada mais na tela depende dele.
  return executar(() => salvarObservacoesReuniao(usuario, eventoId, texto.trim() || null));
}

export async function incluirLinhaAtaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(ataLinhaSchema, formData);
    r = await executar(() => incluirLinhaAta(usuario, eventoId, dados), "Linha incluída na ata");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidarTudo();
  return r;
}

export async function alterarQuantidadeLinhaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  const linhaId = String(formData.get("linhaId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(ataAlterarQuantidadeSchema, formData);
    r = await executar(() => alterarQuantidadeLinha(usuario, eventoId, linhaId, dados.quantidade, dados.justificativa), dados.quantidade === 0 ? "Linha removida da ata" : "Quantidade alterada — OS regerada");
  } catch (e) {
    r = tratarErro(e);
  }
  revalidarTudo();
  return r;
}

export async function conferirLinhaAction(eventoId: string, linhaId: string, conferida: boolean) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaId !== "string" || typeof conferida !== "boolean") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => conferirLinha(usuario, eventoId, linhaId, conferida));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function conferirTodasAction(eventoId: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => conferirTodasLinhas(usuario, eventoId));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function salvarDadosReuniaoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(dadosReuniaoSchema, formData);
    r = await executar(() => salvarDadosReuniao(usuario, eventoId, dados));
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}

export async function atualizarVersaoLinhaAction(eventoId: string, linhaId: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaId !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => atualizarVersaoLinha(usuario, eventoId, linhaId));
  revalidarTudo();
  return r;
}

export async function ajustarLinhaConferenciaAction(eventoId: string, linhaId: string, quantidade: number, motivo: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaId !== "string" || typeof quantidade !== "number" || typeof motivo !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => ajustarLinhaNaConferencia(usuario, eventoId, linhaId, quantidade, motivo));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  return r;
}
