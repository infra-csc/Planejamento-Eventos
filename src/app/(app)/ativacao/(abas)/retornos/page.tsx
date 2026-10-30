import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { podeGerenciarEstoque } from "@/domain/estoque";

import { listarRetornosCache } from "@/app/(app)/ativacao/consultas";
import { RetornosTela } from "@/components/estoque/retornos-tela";

export const metadata: Metadata = { title: "Ativação · Retornos" };

/** Eventos cuja OS leva itens do estoque: depois do evento, a Ativação registra o que voltou. */
export default async function AtivacaoRetornosPage() {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const eventos = await listarRetornosCache(usuario);
  return (
    <>
      <p className="mb-4 mt-0 max-w-[70ch] text-pequeno text-muted">Os itens vinculados a uma peça do catálogo saem com a OS do evento. Depois do evento, registre quantos voltaram bons, quantos vão para reforma e quantos se perderam.</p>
      <RetornosTela eventos={eventos} />
    </>
  );
}
