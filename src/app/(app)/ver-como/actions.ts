"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { COOKIE_VER_COMO, cookieSeguro, getUsuarioReal, lerVerComo } from "@/server/auth/session";
import { PERFIS, PERFIL_LABEL } from "@/domain/permissions";
import { getDb } from "@/server/db";
import { areas, type Perfil } from "@/server/db/schema";
import { registrarHistorico } from "@/server/services/support";

async function rotulo(perfil: Perfil, areaId: string | null) {
  if (!areaId) return PERFIL_LABEL[perfil];
  const db = await getDb();
  const [a] = await db.select({ nome: areas.nome }).from(areas).where(eq(areas.id, areaId)).limit(1);
  return `${PERFIL_LABEL[perfil]}${a ? ` · ${a.nome}` : ""}`;
}

/**
 * "Ver como": o administrador enxerga o app com outro perfil (e área) para conferir o que cada um vê.
 * Permissões e área passam a ser as do perfil visto (inclusive para agir); o histórico registra o
 * administrador, com o perfil assumido (coluna historico.ver_como). A escolha fica só neste navegador.
 */
export async function verComoAction(perfil: string, areaId: string | null) {
  const real = await getUsuarioReal();
  if (!real || real.perfil !== "ADMIN") return { ok: false, erro: "Só o administrador pode ver como outro perfil." } as const;
  if (!(PERFIS as readonly string[]).includes(perfil) || perfil === "ADMIN") return { ok: false, erro: "Perfil inválido." } as const;
  const store = await cookies();
  store.set(COOKIE_VER_COMO, JSON.stringify({ perfil: perfil as Perfil, areaId: areaId || null }), { httpOnly: true, sameSite: "lax", secure: cookieSeguro(), path: "/", maxAge: 60 * 60 * 8 });
  const nome = await rotulo(perfil as Perfil, areaId || null);
  await registrarHistorico(await getDb(), {
    entidade: "acesso",
    entidadeId: real.id,
    acao: "VER_COMO_INICIO",
    descricao: `${real.nome} passou a ver o sistema como ${nome}`,
    usuarioId: real.id,
    verComo: nome,
  }).catch(() => undefined);
  // As páginas leem o perfil do cookie a cada requisição: basta a resposta trazer a tela atual de novo
  // (qualquer revalidação faz isso e limpa o cache de navegação do cliente), sem expirar o cache de dados.
  revalidatePath("/");
  return { ok: true } as const;
}

export async function sairVerComoAction() {
  const [real, vc] = await Promise.all([getUsuarioReal(), lerVerComo()]);
  const store = await cookies();
  store.delete(COOKIE_VER_COMO);
  if (real?.perfil === "ADMIN" && vc) {
    const nome = await rotulo(vc.perfil, vc.areaId);
    await registrarHistorico(await getDb(), {
      entidade: "acesso",
      entidadeId: real.id,
      acao: "VER_COMO_FIM",
      descricao: `${real.nome} deixou de ver o sistema como ${nome}`,
      usuarioId: real.id,
      verComo: null,
    }).catch(() => undefined);
  }
  revalidatePath("/");
  return { ok: true } as const;
}
