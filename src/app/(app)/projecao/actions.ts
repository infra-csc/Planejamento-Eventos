"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { executar, tratarErro, type ActionResult } from "@/lib/action";
import { ATENDE_POR, ESTRUTURAS_EVENTO, TIPOS_COBERTURA } from "@/domain/constantes";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";
import { criarPecaDoItemAtivacao, definirAtendePor, salvarAlmoxarifado, salvarEstruturaEvento, salvarEventoPai, salvarLocador, salvarLogisticaEvento, salvarPerfil, salvarTour, vincularItemAtivacao } from "@/server/services/logistica";
import { aplicarPecasPlanilha, previaContagemPlanilha, previaPecasPlanilha, type LinhaPecaPlanilha } from "@/server/services/planilhas-logistica";
import { registrarContagem, removerCobertura, salvarCobertura } from "@/server/services/saldo";

/** Só com dado malformado (tela desatualizada ou adulterada). */
const DADOS_INVALIDOS = "Não foi possível salvar. Atualize a página e tente de novo.";

const idOuNull = z.string().min(1).max(64).nullable();
const textoOuNull = (max: number) => z.string().trim().max(max).nullable().transform((v) => v || null);
const dataOuNull = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).nullable().transform((v) => v || null);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

function telas(...extras: string[]) {
  for (const c of ["/projecao", "/contagem", "/cadastros", "/saneamento", ...extras]) revalidatePath(c);
}

/** Valida o payload e roda; erro de formato vira mensagem, sem derrubar a tela. */
async function rodar<S extends z.ZodType, T>(schema: S, payload: unknown, fn: (d: z.output<S>, usuario: Awaited<ReturnType<typeof requireUsuario>>) => Promise<T>, mensagem: string, ...revalidar: string[]): Promise<ActionResult<T>> {
  const usuario = await requireUsuario();
  const p = schema.safeParse(payload);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message && p.error.issues[0].code === "custom" ? p.error.issues[0].message : DADOS_INVALIDOS };
  const r = await executar(() => fn(p.data, usuario), mensagem);
  if (r.ok) telas(...revalidar);
  return r;
}

const cadastro = { id: idOuNull, ativo: z.boolean() };

export const salvarAlmoxarifadoAction = async (payload: unknown) =>
  rodar(z.object({ ...cadastro, nome: z.string().max(120), endereco: textoOuNull(200), areaId: idOuNull, principal: z.boolean() }), payload, ({ id, ...d }, u) => salvarAlmoxarifado(u, id, d), "Almoxarifado salvo");

export const salvarLocadorAction = async (payload: unknown) =>
  rodar(z.object({ ...cadastro, nome: z.string().max(120), contato: textoOuNull(160), cnpj: textoOuNull(20) }), payload, ({ id, ...d }, u) => salvarLocador(u, id, d), "Locador salvo");

export const salvarPerfilAction = async (payload: unknown) =>
  rodar(
    z.object({ ...cadastro, tipo: z.string().max(20), nome: z.string().max(120), comprimentoM: z.number(), larguraM: z.number(), alturaM: z.number(), redutorPct: z.number(), referencia: z.boolean() }),
    payload,
    ({ id, ...d }, u) => salvarPerfil(u, id, d),
    "Perfil salvo",
  );

export const salvarEventoPaiAction = async (payload: unknown) =>
  rodar(z.object({ ...cadastro, nome: z.string().max(120), descricao: textoOuNull(300) }), payload, ({ id, ...d }, u) => salvarEventoPai(u, id, d), "Evento pai salvo", "/eventos");

export const salvarTourAction = async (payload: unknown) =>
  rodar(z.object({ ...cadastro, nome: z.string().max(120), eventoIds: z.array(z.string().min(1).max(64)).max(60) }), payload, ({ id, ...d }, u) => salvarTour(u, id, d), "Tour salvo", "/eventos");

export const salvarLogisticaEventoAction = async (eventoId: string, payload: unknown) =>
  rodar(z.object({ saidaPrevista: dataOuNull, retornoPrevisto: dataOuNull, eventoPaiId: idOuNull, tourId: idOuNull }), payload, (d, u) => salvarLogisticaEvento(u, String(eventoId), d), "Dados de logística salvos", `/eventos/${eventoId}`, "/eventos");

export const salvarEstruturaEventoAction = async (eventoId: string, payload: unknown) =>
  rodar(z.object({ estrutura: z.enum(ESTRUTURAS_EVENTO), fornecedor: textoOuNull(120) }), payload, (d, u) => salvarEstruturaEvento(u, String(eventoId), d.estrutura, d.fornecedor), "Estrutura do evento salva", `/eventos/${eventoId}`);

export const definirAtendePorAction = async (eventoId: string, payload: unknown) =>
  rodar(
    z.object({ linhaIds: z.array(z.string().min(1).max(64)).max(2000), atendePor: z.enum(ATENDE_POR).nullable(), almoxarifadoId: idOuNull, montador: textoOuNull(120) }),
    payload,
    ({ linhaIds, ...d }, u) => definirAtendePor(u, String(eventoId), linhaIds, d),
    "Atende por salvo",
    `/eventos/${eventoId}`,
  );

export const registrarContagemAction = async (payload: unknown) =>
  rodar(
    z.object({ almoxarifadoId: z.string().min(1).max(64), dataContagem: data, justificativa: textoOuNull(500), linhas: z.array(z.object({ pecaId: z.string().min(1).max(64), locadorId: idOuNull, contado: z.number() })).max(5000) }),
    payload,
    (d, u) => registrarContagem(u, d),
    "Contagem registrada",
  );

const coberturaSchema = z.object({
  id: idOuNull,
  tipo: z.enum(TIPOS_COBERTURA),
  pecaId: z.string().min(1, "Escolha a peça.").max(64),
  almoxarifadoId: z.string().min(1).max(64),
  quantidade: z.number(),
  locadorId: idOuNull,
  dataEntrada: data,
  dataDevolucao: dataOuNull,
  eventoId: idOuNull,
  observacao: textoOuNull(300),
});

export const salvarCoberturaAction = async (payload: unknown) => rodar(coberturaSchema, payload, ({ id, ...d }, u) => salvarCobertura(u, id, d), "Previsão salva");
export const removerCoberturaAction = async (id: string) => rodar(z.string().min(1).max(64), id, (i, u) => removerCobertura(u, i), "Previsão removida");

export const vincularItemAtivacaoAction = async (itemId: string, pecaId: string) => rodar(z.object({ itemId: z.string().max(64), pecaId: z.string().max(64) }), { itemId, pecaId }, (d, u) => vincularItemAtivacao(u, d.itemId, d.pecaId), "Item ligado à peça", "/ativacao");

export const criarPecaDoItemAction = async (itemId: string) =>
  rodar(
    z.string().min(1).max(64),
    itemId,
    async (i, u) => {
      const p = await criarPecaDoItemAtivacao(u, i);
      invalidarDados(TAGS_DADOS.catalogo);
      return { codigo: p.codigo };
    },
    "Peça criada e ligada",
    "/ativacao",
    "/biblioteca",
  );

const MAX_PLANILHA = 5 * 1024 * 1024;

async function arquivoDoForm(formData: FormData): Promise<ArrayBuffer | string> {
  const f = formData.get("arquivo");
  if (!(f instanceof File) || f.size === 0) return "Escolha a planilha.";
  if (f.size > MAX_PLANILHA) return "A planilha passa de 5 MB.";
  return f.arrayBuffer();
}

export async function previaContagemPlanilhaAction(formData: FormData) {
  const usuario = await requireUsuario();
  const a = await arquivoDoForm(formData);
  if (typeof a === "string") return { ok: false, erro: a } as const;
  return executar(() => previaContagemPlanilha(usuario, a));
}

export async function previaPecasPlanilhaAction(formData: FormData) {
  const usuario = await requireUsuario();
  const a = await arquivoDoForm(formData);
  if (typeof a === "string") return { ok: false, erro: a } as const;
  return executar(() => previaPecasPlanilha(usuario, a));
}

export async function aplicarPecasPlanilhaAction(linhas: LinhaPecaPlanilha[]) {
  const usuario = await requireUsuario();
  try {
    const n = await aplicarPecasPlanilha(usuario, Array.isArray(linhas) ? linhas : []);
    invalidarDados(TAGS_DADOS.catalogo);
    telas("/biblioteca");
    return { ok: true, dados: n, mensagem: `${n} ${n === 1 ? "peça atualizada" : "peças atualizadas"}` } as ActionResult<number>;
  } catch (e) {
    return tratarErro(e);
  }
}
