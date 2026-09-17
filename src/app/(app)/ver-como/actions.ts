"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE_VER_COMO, getUsuarioReal } from "@/server/auth/session";
import { PERFIS } from "@/domain/permissions";
import type { Perfil } from "@/server/db/schema";

/**
 * "Ver como": o administrador enxerga o app com outro perfil (e área) para conferir o que cada um vê.
 * Permissões e área passam a ser as do perfil visto (inclusive para agir); o histórico registra o
 * administrador. A escolha fica só neste navegador.
 */
export async function verComoAction(perfil: string, areaId: string | null) {
  const real = await getUsuarioReal();
  if (!real || real.perfil !== "ADMIN") return { ok: false, erro: "Só o administrador pode ver como outro perfil." } as const;
  if (!(PERFIS as readonly string[]).includes(perfil) || perfil === "ADMIN") return { ok: false, erro: "Perfil inválido." } as const;
  const store = await cookies();
  store.set(COOKIE_VER_COMO, JSON.stringify({ perfil: perfil as Perfil, areaId: areaId || null }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  revalidatePath("/", "layout");
  return { ok: true } as const;
}

export async function sairVerComoAction() {
  const store = await cookies();
  store.delete(COOKIE_VER_COMO);
  revalidatePath("/", "layout");
  return { ok: true } as const;
}
