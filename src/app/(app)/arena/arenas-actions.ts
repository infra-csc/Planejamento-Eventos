"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { exigir } from "@/server/auth/autorizacao";
import { executar, tratarErro, type ActionResult } from "@/lib/action";
import { criarArena, excluirArena, removerPlantaArena, trocarPlantaArena, type DadosNovaArena } from "@/server/services/arenas";
import { importarEntornoArena, removerEntornoArena } from "@/server/services/arena-entorno";
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
    exigir(usuario, "arena.editar");
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

/**
 * Coordenadas coladas do Google Maps ("-20.276480, -40.284020") ou digitadas com vírgula decimal
 * ("-20,27648; -40,28402"). Devolve [lat, lon] ou null.
 */
function lerCoordenadas(texto: string): [number, number] | null {
  const t = texto.trim();
  const ponto = t.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (ponto && t.includes(".")) return [Number(ponto[1]), Number(ponto[2])];
  const virgula = t.match(/(-?\d+(?:,\d+)?)\s*[;\s]\s*(-?\d+(?:,\d+)?)/);
  if (virgula) return [Number(virgula[1].replace(",", ".")), Number(virgula[2].replace(",", "."))];
  return null;
}

export async function importarEntornoArenaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) return { ok: false, erro: "Arena inválida." };
  const coords = lerCoordenadas(String(formData.get("coordenadas") ?? ""));
  if (!coords) return { ok: false, erro: "Cole as coordenadas do centro da planta.", campos: { coordenadas: "Ex.: -20.27648, -40.28402 (Google Maps: botão direito no lugar → copiar as coordenadas)." } };
  const giro = Number(String(formData.get("giro") ?? "0").replace(",", ".") || 0);
  let r: ActionResult;
  try {
    const res = await importarEntornoArena(usuario, slug.data, { lat: coords[0], lon: coords[1], giro });
    r = { ok: true, mensagem: res.predios || res.ruas ? `Entorno 3D importado: ${res.predios} prédios e ${res.ruas} trechos de rua.` : "O OpenStreetMap não tem prédios mapeados nesse lugar. Confira as coordenadas." };
  } catch (e) {
    r = tratarErro(e);
  }
  revalidatePath("/arena");
  revalidatePath(`/arena/${slug.data}`);
  return r;
}

export async function removerEntornoArenaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) return { ok: false, erro: "Arena inválida." };
  const r = await executar(() => removerEntornoArena(usuario, slug.data), "Entorno 3D removido.");
  revalidatePath("/arena");
  revalidatePath(`/arena/${slug.data}`);
  return r;
}
