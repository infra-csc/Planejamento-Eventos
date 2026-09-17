"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { executar } from "@/lib/action";
import { removerPosicaoArena, salvarPosicaoArena, type DadosPosicao } from "@/server/services/arena";

export async function salvarPosicaoArenaAction(slug: string, dados: DadosPosicao) {
  const usuario = await requireUsuario();
  if (typeof slug !== "string" || !dados || typeof dados !== "object") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => salvarPosicaoArena(usuario, slug, { chave: String(dados.chave), tipo: dados.tipo, x: Number(dados.x), z: Number(dados.z), nome: dados.nome ?? null, categoria: dados.categoria ?? null, itemAta: dados.itemAta ?? null }));
  revalidatePath(`/arena/${slug}`);
  return r;
}

export async function removerPosicaoArenaAction(slug: string, chave: string) {
  const usuario = await requireUsuario();
  if (typeof slug !== "string" || typeof chave !== "string") return { ok: false, erro: "Dados inválidos." } as const;
  const r = await executar(() => removerPosicaoArena(usuario, slug, chave));
  revalidatePath(`/arena/${slug}`);
  return r;
}
