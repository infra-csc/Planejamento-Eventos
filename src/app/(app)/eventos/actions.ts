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
  snapshotBom,
  transicionarEvento,
} from "@/server/services/eventos";
import { ataAlterarQuantidadeSchema, ataLinhaSchema, dadosReuniaoSchema, eventoSchema, justificativaSchema, motivoOpcionalSchema } from "@/lib/schemas";
import { LIMITES } from "@/domain/constantes";
import { getDb } from "@/server/db";
import { kitDaTenda, padraoPorTenda, papeisDoKit, PAPEIS_POR_LOCAL, type PapelTenda } from "@/domain/tendas";
import { executar, parseForm, tratarErro, type ActionResult } from "@/lib/action";
import { parseDateTimeLocal } from "@/lib/format";
import { ACOES_EVENTO, TRANSICOES_EVENTO, type AcaoEvento } from "@/domain/evento";
import { ValidacaoError } from "@/domain/errors";
import { ajustarLinhaNaConferencia, ajustarPecaDoProjeto, ajustarTendasDoLocal, completarAcompanhante, definirExtraDaRegra, editarDescricoesLinha } from "@/server/services/conferencia";
import { vincularAoCatalogo, type AlvoVinculo, type RefVinculo } from "@/server/services/fora-catalogo";
import { marcarOsEnviada } from "@/server/services/os";
import { salvarSeparacao } from "@/server/services/separacao";
import { pecaSchema } from "@/lib/schemas";
import { invalidarDados, revalidarTelasOperacao, TAGS_DADOS } from "@/server/cache-dados";

/** Fase, ata e OS mudam painel, listas e contadores: a tela atual volta renderizada (ver revalidarTelasOperacao). */
function revalidarTudo() {
  revalidarTelasOperacao();
}

/** Inteiro >= 0 vindo de um campo oculto do formulário, ou `null` se ausente ou inválido. */
function quantidadeDoForm(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
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
  if (!motivoOpcionalSchema.safeParse(justificativa).success) return { ok: false, erro: `A justificativa deve ter no máximo ${LIMITES.justificativa} caracteres.` };
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
  if (texto.length > LIMITES.observacoesReuniao) return { ok: false, erro: `As observações passam do limite de ${LIMITES.observacoesReuniao.toLocaleString("pt-BR")} caracteres.` } as const;
  // Sem revalidatePath: o texto vive no estado do cliente e nada mais na tela depende dele.
  return executar(() => salvarObservacoesReuniao(usuario, eventoId, texto.trim() || null));
}

export async function incluirLinhaAtaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const eventoId = String(formData.get("eventoId") ?? "");
  let r: ActionResult;
  try {
    const dados = parseForm(ataLinhaSchema, formData);
    // Tenda: fechamentos e calhas do local, quando quem incluiu mudou do padrão (campos só vêm nesse caso).
    const totalTenda = (campo: string) => {
      const v = formData.get(campo);
      return typeof v === "string" && /^\d{1,5}$/.test(v) ? Number(v) : undefined;
    };
    const totais = Object.fromEntries((["fechamento", "calha"] as const).flatMap((p) => (totalTenda(`tenda_${p}`) === undefined ? [] : [[p, totalTenda(`tenda_${p}`)!]])));
    // A justificativa só é pedida com a ata fechada: aí o item entra na OS (a ata não muda).
    const mensagem = dados.justificativa ? "Item incluído na OS" : "Linha incluída na ata";
    r = await executar(async () => {
      const linha = await incluirLinhaAta(usuario, eventoId, dados);
      if (dados.referenciaTipo === "PROJETO" && Object.keys(totais).length) {
        await ajustarTendasDoLocal(usuario, eventoId, { linhaIds: [linha.id], tendas: dados.quantidade, totais, motivo: dados.justificativa });
      }
    }, mensagem);
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
    // Quantidade que a tela mostrava: se a linha mudou enquanto a pessoa editava, o serviço recusa.
    const quantidadeEsperada = quantidadeDoForm(formData.get("quantidadeEsperada"));
    r = await executar(
      () => alterarQuantidadeLinha(usuario, eventoId, linhaId, dados.quantidade, dados.justificativa, { quantidadeEsperada }),
      dados.quantidade === 0 ? "Linha removida da ata" : "Quantidade alterada — OS regerada",
    );
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
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

export async function conferirTodasAction(eventoId: string, linhaIds: string[], conhecidas?: string[]) {
  const usuario = await requireUsuario();
  const lista = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 2000 && x.every((y) => typeof y === "string");
  if (typeof eventoId !== "string" || !lista(linhaIds) || (conhecidas !== undefined && !lista(conhecidas))) return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => conferirTodasLinhas(usuario, eventoId, linhaIds, conhecidas));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

/** Autosave dos dados da reunião (presentes, público, carga): mesmo schema do formulário. */
export async function salvarDadosReuniaoAutoAction(eventoId: string, dados: Record<string, string>) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || !dados || typeof dados !== "object") return { ok: false, erro: "Dados inválidos." } as ActionResult;
  const fd = new FormData();
  for (const [k, v] of Object.entries(dados)) if (typeof v === "string") fd.set(k, v);
  let r: ActionResult;
  try {
    const parsed = parseForm(dadosReuniaoSchema, fd);
    r = await executar(() => salvarDadosReuniao(usuario, eventoId, parsed));
  } catch (e) {
    r = tratarErro(e);
  }
  // O banner "presentes registrados" e a aba Ata dependem destes dados.
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

/** OS enviada ao carregamento: marca a versão atual (gerando uma nova se a ata mudou) como a enviada. */
export async function marcarOsEnviadaAction(eventoId: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string") return { ok: false, erro: "Dados inválidos." } as ActionResult;
  const r = await executar(() => marcarOsEnviada(usuario, eventoId));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  if (!r.ok) return r;
  return { ok: true, mensagem: r.dados?.incorporou ? `OS v${r.dados.numero} incorporou o complemento e é a versão enviada` : `OS v${r.dados?.numero} marcada como enviada ao carregamento` } as ActionResult;
}

export async function atualizarVersaoLinhaAction(eventoId: string, linhaId: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaId !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => atualizarVersaoLinha(usuario, eventoId, linhaId));
  revalidarTudo();
  return r;
}

/** `quantidadeEsperada`: a quantidade que a tela mostrava (controle de concorrência). */
export async function ajustarLinhaConferenciaAction(eventoId: string, linhaId: string, quantidade: number, motivo: string, quantidadeEsperada?: number | null) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaId !== "string" || typeof quantidade !== "number" || typeof motivo !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  if (quantidadeEsperada != null && !Number.isInteger(quantidadeEsperada)) return { ok: false, erro: "Dados inválidos." } as const;
  if (!motivoOpcionalSchema.safeParse(motivo).success) return { ok: false, erro: `O motivo deve ter no máximo ${LIMITES.justificativa} caracteres.` } as const;
  const r = await executar(() => ajustarLinhaNaConferencia(usuario, eventoId, linhaId, quantidade, motivo, { quantidadeEsperada }));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

/** Grades do prisma: quantas a mais a reunião decidiu (linha própria, somada à da regra). */
export async function definirExtraDaRegraAction(eventoId: string, linhaRegraId: string, extra: number, motivo: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaRegraId !== "string" || !Number.isInteger(extra) || typeof motivo !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  if (!motivoOpcionalSchema.safeParse(motivo).success) return { ok: false, erro: `O motivo deve ter no máximo ${LIMITES.justificativa} caracteres.` } as const;
  const r = await executar(() => definirExtraDaRegra(usuario, eventoId, linhaRegraId, extra, motivo));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

/** Folha de separação: estrutura locada no local (box Q30, tendas e estaiamento fora; Q15 se marcado). */
export async function salvarSeparacaoAction(eventoId: string, locada: boolean, q15Locado: boolean) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof locada !== "boolean" || typeof q15Locado !== "boolean") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => salvarSeparacao(usuario, eventoId, { locada, q15Locado }));
  revalidatePath(`/eventos/${eventoId}/os`);
  return r;
}

/** Cavalete/pé sem nenhuma linha na ata: inclui o que a regra pede. */
export async function completarAcompanhanteAction(eventoId: string, codigo: string) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof codigo !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => completarAcompanhante(usuario, eventoId, codigo));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

export async function editarDescricoesLinhaAction(eventoId: string, linhaId: string, grupos: unknown) {
  const usuario = await requireUsuario();
  if (typeof eventoId !== "string" || typeof linhaId !== "string" || !Array.isArray(grupos) || grupos.length > 1000) return { ok: false, erro: "Dados inválidos." } as const;
  const lista = grupos.map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return { texto: typeof o.texto === "string" ? o.texto : "", unidades: Number(o.unidades) };
  });
  const r = await executar(() => editarDescricoesLinha(usuario, eventoId, linhaId, lista));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

export async function vincularAoCatalogoAction(ref: RefVinculo, alvo: unknown) {
  const usuario = await requireUsuario();
  if (!ref || typeof ref !== "object" || !alvo || typeof alvo !== "object") return { ok: false, erro: "Dados inválidos." } as const;
  const referencia: RefVinculo = { linhaId: typeof ref.linhaId === "string" ? ref.linhaId : null, solicitacaoItemId: typeof ref.solicitacaoItemId === "string" ? ref.solicitacaoItemId : null };
  const a = alvo as Record<string, unknown>;
  let destino: AlvoVinculo;
  if (a.tipo === "PROJETO" && typeof a.projetoId === "string" && a.projetoId) destino = { tipo: "PROJETO", projetoId: a.projetoId };
  else if (a.tipo === "PECA" && typeof a.pecaId === "string" && a.pecaId) destino = { tipo: "PECA", pecaId: a.pecaId };
  else if (a.tipo === "NOVA_PECA") {
    const r = pecaSchema.safeParse({ ...(a.peca as object), estoqueProprio: 0, permiteEmProjeto: "on" });
    if (!r.success) {
      const campos = Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
      return { ok: false, erro: "Revise os dados da peça.", campos } as const;
    }
    destino = { tipo: "NOVA_PECA", peca: r.data };
  } else return { ok: false, erro: "Escolha a peça ou o projeto." } as const;
  const res = await executar(() => vincularAoCatalogo(usuario, referencia, destino));
  revalidarTelasOperacao("/biblioteca");
  // Peça nova entra no catálogo em cache (listas e opções dos formulários).
  if (destino.tipo === "NOVA_PECA") invalidarDados(TAGS_DADOS.catalogo);
  return res;
}

export async function ajustarPecaDoProjetoAction(eventoId: string, linhaId: string, pecaId: string, quantidade: number, motivo: string) {
  const usuario = await requireUsuario();
  if ([eventoId, linhaId, pecaId, motivo].some((v) => typeof v !== "string") || typeof quantidade !== "number") return { ok: false, erro: "Dados inválidos." } as const;
  if (!motivoOpcionalSchema.safeParse(motivo).success) return { ok: false, erro: `O motivo deve ter no máximo ${LIMITES.justificativa} caracteres.` } as const;
  const r = await executar(() => ajustarPecaDoProjeto(usuario, eventoId, linhaId, pecaId, quantidade, motivo));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

/** Tendas de um local na conferência: quantas tendas e o total de fechamentos e calhas (como no quadro). */
export async function ajustarTendasDoLocalAction(eventoId: string, dados: { linhaIds: string[]; tendas: number; totais: Record<string, number>; motivo: string }) {
  const usuario = await requireUsuario();
  const ok =
    typeof eventoId === "string" &&
    Array.isArray(dados?.linhaIds) &&
    dados.linhaIds.every((x) => typeof x === "string") &&
    typeof dados.tendas === "number" &&
    typeof dados.motivo === "string" &&
    Object.entries(dados.totais ?? {}).every(([k, v]) => (k === "fechamento" || k === "calha") && typeof v === "number");
  if (!ok) return { ok: false, erro: "Dados inválidos." } as const;
  if (!motivoOpcionalSchema.safeParse(dados.motivo).success) return { ok: false, erro: `O motivo deve ter no máximo ${LIMITES.justificativa} caracteres.` } as const;
  const r = await executar(() => ajustarTendasDoLocal(usuario, eventoId, { linhaIds: dados.linhaIds, tendas: dados.tendas, totais: dados.totais, motivo: dados.motivo }));
  revalidatePath(`/eventos/${eventoId}`, "layout");
  revalidatePath(`/conferencia/${eventoId}`);
  return r;
}

/**
 * "Incluir item": se o projeto escolhido é tenda, os papéis que mudam por local (fechamento e, na 5×5, calha) e
 * quantos vêm por tenda no padrão — o formulário mostra os totais do local para ajustar.
 */
export async function kitTendaDoProjetoAction(projetoId: string): Promise<{ tamanho: string; papeis: Array<{ papel: PapelTenda; rotulo: string; porTenda: number }> } | null> {
  await requireUsuario();
  if (typeof projetoId !== "string" || !projetoId || projetoId.length > 64) return null;
  try {
    const { bom } = await snapshotBom(await getDb(), projetoId);
    const kit = kitDaTenda(bom.map((b) => b.codigo));
    if (!kit) return null;
    return { tamanho: kit.tamanho, papeis: papeisDoKit(kit).filter((x) => PAPEIS_POR_LOCAL.includes(x.papel)).map((x) => ({ papel: x.papel, rotulo: x.rotulo, porTenda: padraoPorTenda(kit, bom, x.papel) })) };
  } catch {
    return null;
  }
}
