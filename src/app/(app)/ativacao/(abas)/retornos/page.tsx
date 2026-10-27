import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarRetornos } from "@/server/services/ativacao";
import { RetornosTela } from "@/components/estoque/retornos-tela";

export const metadata: Metadata = { title: "Ativação · Retornos" };

/** Eventos cuja OS leva itens do estoque: depois do evento, a Ativação registra o que voltou. */
export default async function AtivacaoRetornosPage() {
  const usuario = await requireUsuario();
  const eventos = await listarRetornos(usuario);
  return (
    <>
      <p className="mb-4 mt-0 max-w-[70ch] text-pequeno text-muted">Os itens ligados a uma peça do catálogo saem com a OS do evento. Depois do evento, registre quantos voltaram bons, quantos vão para reforma e quantos se perderam.</p>
      <RetornosTela eventos={eventos} />
    </>
  );
}
