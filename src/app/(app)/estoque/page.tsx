import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireUsuario } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
import { podeGerenciarEstoque } from "@/domain/estoque";
import { listarEstoque } from "@/server/services/estoque";
import { PageHeader } from "@/components/ui/layout";
import { EstoqueTela } from "@/components/estoque/estoque-tela";

export const metadata: Metadata = { title: "Estoque" };

/**
 * Estoque da Ativação: o "Inventário - Ativação" da planilha, mantido pela própria Ativação e pelo
 * administrador. À parte da OS da logística; a ligação com uma peça do catálogo faz a solicitação mostrar
 * quanto ainda tem no período do evento.
 */
export default async function EstoquePage() {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const db = await getDb();
  const [itens, catalogo] = await Promise.all([
    listarEstoque(usuario),
    db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome)),
  ]);
  return (
    <>
      <PageHeader title="Estoque da Ativação" description="Quantidades do inventário. Item ligado a uma peça do catálogo mostra na solicitação quanto ainda tem no período do evento." divisor />
      <EstoqueTela
        itens={itens.map((i) => ({ ...i, atualizadoEm: i.atualizadoEm.toISOString() }))}
        catalogo={catalogo}
      />
    </>
  );
}
