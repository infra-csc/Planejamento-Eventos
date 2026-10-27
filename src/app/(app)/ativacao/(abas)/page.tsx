import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireUsuario } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { podeGerenciarEstoque } from "@/domain/estoque";

import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
import { listarEstoque } from "@/server/services/estoque";
import { EstoqueTela } from "@/components/estoque/estoque-tela";

export const metadata: Metadata = { title: "Ativação · Estoque" };

/**
 * Estoque da Ativação: o "Inventário - Ativação" da planilha. Item ligado a uma peça do catálogo sai com a OS do
 * evento e volta pelo registro de retorno; o que está em reforma fica à parte até voltar.
 */
export default async function AtivacaoEstoquePage() {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const db = await getDb();
  const [itens, catalogo] = await Promise.all([listarEstoque(usuario), db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome))]);
  return (
    <>
      <EstoqueTela itens={itens.map((i) => ({ ...i, atualizadoEm: i.atualizadoEm.toISOString() }))} catalogo={catalogo} />
    </>
  );
}
