"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { exigir } from "@/server/auth/autorizacao";
import { executar, tratarErro, type ActionResult } from "@/lib/action";
import { criarArena, excluirArena, removerPlantaArena, trocarPlantaArena, type DadosNovaArena } from "@/server/services/arenas";
import { LIMITES } from "@/domain/constantes";

const metros = (rotulo: string) =>
  z.coerce
    .number({ message: `Informe a ${rotulo} em metros.` })
    .min(20, { message: `A ${rotulo} mínima é 20 m.` })
    .max(5000, { message: `A ${rotulo} máxima é 5.000 m.` });

const nomeArena = z
  .string()
  .trim()
  .min(2, { message: "Informe o nome (mínimo 2 letras)." })
  .max(LIMITES.nome, { message: `Até ${LIMITES.nome} caracteres.` });

const novaArenaSchema = z.discriminatedUnion("partida", [
  z.object({
    partida: z.literal("branco"),
    eventoId: z.string().trim().min(1, { message: "Escolha o evento." }),
    nome: nomeArena,
    largura: metros("largura"),
    profundidade: metros("profundidade"),
  }),
  z.object({
    partida: z.literal("copiar"),
    eventoId: z.string().trim().min(1, { message: "Escolha o evento." }),
    nome: nomeArena,
    origemSlug: z.string().trim().min(1, { message: "Escolha a arena para copiar." }),
  }),
]);

const slugSchema = z.string().trim().min(1).max(LIMITES.nome);

/** Arquivo do campo, ou null quando nada foi escolhido (o navegador manda um File vazio). */
function arquivoDe(formData: FormData, campo: string): File | null {
  const f = formData.get(campo);
  return f instanceof File && f.size > 0 ? f : null;
}

export async function criarArenaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  let destino: string;
  try {
    exigir(usuario, "arena.ver");
    const d = novaArenaSchema.parse({
      partida: formData.get("partida"),
      eventoId: formData.get("eventoId") ?? "",
      nome: formData.get("nome") ?? "",
      largura: formData.get("largura") ?? undefined,
      profundidade: formData.get("profundidade") ?? undefined,
      origemSlug: formData.get("origemSlug") ?? "",
    });
    const dados: DadosNovaArena = {
      eventoId: d.eventoId,
      nome: d.nome,
      partida: d.partida === "branco" ? { tipo: "branco", largura: d.largura, profundidade: d.profundidade } : { tipo: "copiar", origemSlug: d.origemSlug },
    };
    const r = await criarArena(usuario, dados, arquivoDe(formData, "planta"));
    revalidatePath("/arena");
    revalidatePath(`/eventos/${r.eventoId}`);
    destino = `/arena/${r.slug}`;
  } catch (e) {
    return tratarErro(e);
  }
  redirect(destino);
}

export async function trocarPlantaArenaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) return { ok: false, erro: "Arena inválida." };
  const arquivo = arquivoDe(formData, "planta");
  if (!arquivo) return { ok: false, erro: "Escolha a imagem da planta (PNG, JPG ou WebP)." };
  const r = await executar(() => trocarPlantaArena(usuario, slug.data, arquivo), "Planta atualizada.");
  revalidatePath("/arena");
  revalidatePath(`/arena/${slug.data}`);
  return r;
}

export async function removerPlantaArenaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) return { ok: false, erro: "Arena inválida." };
  const r = await executar(() => removerPlantaArena(usuario, slug.data), "Planta removida.");
  revalidatePath("/arena");
  revalidatePath(`/arena/${slug.data}`);
  return r;
}

export async function excluirArenaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) return { ok: false, erro: "Arena inválida." };
  const r = await executar(() => excluirArena(usuario, slug.data), "Arena excluída.");
  revalidatePath("/arena");
  revalidatePath(`/arena/${slug.data}`);
  if (r.ok && r.dados?.eventoId) revalidatePath(`/eventos/${r.dados.eventoId}`);
  return r;
}
