import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarRetornos } from "@/server/services/ativacao";
import { PageHeader } from "@/components/ui/layout";
import { RetornosTela } from "@/components/estoque/retornos-tela";

export const metadata: Metadata = { title: "Ativação · Retornos" };

/** Eventos cuja OS leva itens do estoque: depois do evento, a Ativação registra o que voltou. */
export default async function AtivacaoRetornosPage() {
  const usuario = await requireUsuario();
  const eventos = await listarRetornos(usuario);
  return (
    <>
      <PageHeader title="Retornos" description="Os itens do estoque saem com a OS do evento. Depois do evento, registre quantos voltaram bons, quantos foram para reforma e quantos se perderam." />
      <RetornosTela eventos={eventos} />
    </>
  );
}
