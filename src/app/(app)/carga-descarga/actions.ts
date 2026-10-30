"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { executar } from "@/lib/action";
import { duplicarVeiculoCarga, excluirVeiculoCarga, salvarVeiculoCarga } from "@/server/services/carga-descarga";
import { TAGS_CARGA, TIPOS_VEICULO } from "@/domain/carga-descarga";
import { MAX_LINHAS_IMPORTACAO, MAX_QUANTIDADE } from "@/domain/carga-importacao";
import { CAMINHO_GOOGLE_PLANILHAS, importarVeiculosCarga, previaImportacaoCarga } from "@/server/services/carga-importacao";

/** Só com payload malformado (tela desatualizada ou adulterada): diz o que fazer (auditoria 28/10, nº 177). */
const ERRO_PAYLOAD = "Não foi possível salvar. Atualize a página e tente de novo.";

/** Data e hora local ("AAAA-MM-DDTHH:mm") ou vazio. */
const dataHora = z.string().regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, { message: "Data e hora inválidas." });
const texto = (max: number) => z.string().max(max);
const tags = z.array(z.enum(TAGS_CARGA)).max(TAGS_CARGA.length);

const veiculoSchema = z.object({
  id: z.string().min(1).max(64).nullable().optional(),
  eventoId: z.string().min(1, { message: "Escolha o evento." }).max(64),
  veiculo: z.object({
    tipo: z.enum(TIPOS_VEICULO, { message: "Escolha o tipo do veículo." }),
    ident: texto(120),
    ida: z.object({
      ativo: z.boolean(),
      tags,
      cargaTexto: texto(500),
      inicioCarga: dataHora,
      fimCarga: dataHora,
      saida: dataHora,
      destino: texto(160),
      chegadaDestino: dataHora,
      descarga: dataHora,
      obs: texto(2000),
    }),
    volta: z.object({
      ativo: z.boolean(),
      tags,
      cargaTexto: texto(500),
      inicioCarga: dataHora,
      fimCarga: dataHora,
      saida: dataHora,
      destino: texto(160),
      chegadaGalpao: dataHora,
      descargaGalpao: dataHora,
      obs: texto(2000),
    }),
  }),
});

const revalidar = (eventoId?: string) => {
  revalidatePath("/carga-descarga", "layout");
  if (eventoId) revalidatePath(`/eventos/${eventoId}`, "layout");
};

export async function salvarVeiculoCargaAction(payload: unknown) {
  const usuario = await requireUsuario();
  const p = veiculoSchema.safeParse(payload);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? ERRO_PAYLOAD } as const;
  const r = await executar(() => salvarVeiculoCarga(usuario, p.data), p.data.id ? "Veículo atualizado" : "Veículo cadastrado");
  revalidar(p.data.eventoId);
  return r;
}

export async function duplicarVeiculoCargaAction(id: string, eventoId: string) {
  const usuario = await requireUsuario();
  if (typeof id !== "string" || typeof eventoId !== "string") return { ok: false, erro: ERRO_PAYLOAD } as const;
  const r = await executar(() => duplicarVeiculoCarga(usuario, id), "Veículo duplicado");
  revalidar(eventoId);
  return r;
}

export async function excluirVeiculoCargaAction(id: string, eventoId: string) {
  const usuario = await requireUsuario();
  if (typeof id !== "string" || typeof eventoId !== "string") return { ok: false, erro: ERRO_PAYLOAD } as const;
  const r = await executar(() => excluirVeiculoCarga(usuario, id), "Veículo excluído");
  revalidar(eventoId);
  return r;
}

/* ---------------------------- Importação em lote ---------------------------- */

const LIMITE_ARQUIVO = 5 * 1024 * 1024;

/** Lê a planilha enviada e devolve a conferência linha a linha (nada é gravado aqui). */
export async function previaImportacaoCargaAction(form: FormData) {
  const usuario = await requireUsuario();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha a planilha (.xlsx)." } as const;
  if (arquivo.size > LIMITE_ARQUIVO) return { ok: false, erro: "Arquivo grande demais (máximo 5 MB)." } as const;
  if (!/\.xlsx$/i.test(arquivo.name)) return { ok: false, erro: `Envie o arquivo .xlsx do modelo (Excel; ${CAMINHO_GOOGLE_PLANILHAS}).` } as const;
  const buffer = await arquivo.arrayBuffer();
  return executar(() => previaImportacaoCarga(usuario, buffer));
}

const importacaoSchema = z
  .array(z.object({ linha: z.number().int().min(1), eventoId: z.string().min(1).max(64), quantidade: z.number().int().min(1).max(MAX_QUANTIDADE), veiculo: veiculoSchema.shape.veiculo }))
  .min(1, { message: "Nenhuma linha válida para importar." })
  .max(MAX_LINHAS_IMPORTACAO);

/** Grava as linhas válidas conferidas (o servidor revalida tudo e não duplica os já cadastrados). */
export async function importarCargaAction(payload: unknown) {
  const usuario = await requireUsuario();
  const p = importacaoSchema.safeParse(payload);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? ERRO_PAYLOAD } as const;
  const r = await executar(() => importarVeiculosCarga(usuario, p.data));
  revalidatePath("/carga-descarga", "layout");
  if (r.ok) for (const id of r.dados?.eventos ?? []) revalidatePath(`/eventos/${id}`, "layout");
  return r;
}
