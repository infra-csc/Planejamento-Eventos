"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { executar, type ActionResult } from "@/lib/action";
import { removerPosicaoArena, restaurarPlantaArena, salvarPosicaoArena, type DadosPosicao } from "@/server/services/arena";

export async function salvarPosicaoArenaAction(slug: string, dados: DadosPosicao) {
  const usuario = await requireUsuario();
  if (typeof slug !== "string" || !dados || typeof dados !== "object") return { ok: false, erro: "Dados inválidos." } as const;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const chave = texto(dados.chave, 120);
  if (!chave || (dados.tipo !== "MOVER" && dados.tipo !== "NOVO") || !Number.isFinite(Number(dados.x)) || !Number.isFinite(Number(dados.z))) return { ok: false, erro: "Dados inválidos." } as const;
  // Giro: ausente mantém o salvo; null volta à orientação da planta; número precisa ser finito.
  const rotacao = dados.rotacao === undefined || dados.rotacao === null ? dados.rotacao : typeof dados.rotacao === "number" && Number.isFinite(dados.rotacao) ? dados.rotacao : Number.NaN;
  if (Number.isNaN(rotacao)) return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() =>
    salvarPosicaoArena(usuario, slug, { chave, tipo: dados.tipo, x: Number(dados.x), z: Number(dados.z), nome: texto(dados.nome, 120) || null, categoria: texto(dados.categoria, 60) || null, itemAta: texto(dados.itemAta, 120) || null, rotacao }),
  );
  revalidatePath(`/arena/${slug}`);
  return r;
}

/** Desfaz de uma vez todas as edições do mapa: volta à planta importada do evento. */
export async function restaurarPlantaArenaAction(slug: string) {
  const usuario = await requireUsuario();
  if (typeof slug !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => restaurarPlantaArena(usuario, slug), "Mapa restaurado para a planta original");
  revalidatePath(`/arena/${slug}`);
  return r;
}

/** Mesma restauração, no formato que o diálogo de confirmação usa. */
export async function restaurarPlantaArenaFormAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return restaurarPlantaArenaAction(String(formData.get("slug") ?? ""));
}

export async function removerPosicaoArenaAction(slug: string, chave: string) {
  const usuario = await requireUsuario();
  if (typeof slug !== "string" || typeof chave !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => removerPosicaoArena(usuario, slug, chave));
  revalidatePath(`/arena/${slug}`);
  return r;
}
