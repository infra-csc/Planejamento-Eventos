"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { executar } from "@/lib/action";
import { duplicarVeiculoCarga, excluirVeiculoCarga, salvarVeiculoCarga } from "@/server/services/carga-descarga";
import { TAGS_CARGA, TIPOS_VEICULO } from "@/domain/carga-descarga";

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
  revalidatePath("/carga-descarga");
  if (eventoId) revalidatePath(`/eventos/${eventoId}`, "layout");
};

export async function salvarVeiculoCargaAction(payload: unknown) {
  const usuario = await requireUsuario();
  const p = veiculoSchema.safeParse(payload);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." } as const;
  const r = await executar(() => salvarVeiculoCarga(usuario, p.data), p.data.id ? "Veículo atualizado" : "Veículo cadastrado");
  revalidar(p.data.eventoId);
  return r;
}

export async function duplicarVeiculoCargaAction(id: string, eventoId: string) {
  const usuario = await requireUsuario();
  if (typeof id !== "string" || typeof eventoId !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => duplicarVeiculoCarga(usuario, id), "Veículo duplicado");
  revalidar(eventoId);
  return r;
}

export async function excluirVeiculoCargaAction(id: string, eventoId: string) {
  const usuario = await requireUsuario();
  if (typeof id !== "string" || typeof eventoId !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => excluirVeiculoCarga(usuario, id), "Veículo excluído");
  revalidar(eventoId);
  return r;
}
