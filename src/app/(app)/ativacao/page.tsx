import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireUsuario } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
import { listarEstoque } from "@/server/services/estoque";
import { PageHeader } from "@/components/ui/layout";
import { EstoqueTela } from "@/components/estoque/estoque-tela";

export const metadata: Metadata = { title: "Ativação · Estoque" };

/**
 * Estoque da Ativação: o "Inventário - Ativação" da planilha. Item ligado a uma peça do catálogo sai com a OS do
 * evento e volta pelo registro de retorno; o que está em reforma fica à parte até voltar.
 */
export default async function AtivacaoEstoquePage() {
  const usuario = await requireUsuario();
  const db = await getDb();
  const [itens, catalogo] = await Promise.all([listarEstoque(usuario), db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome))]);
  return (
    <>
      <PageHeader
        title="Ativação"
        description="Estoque da área. Item ligado a uma peça do catálogo sai com a OS do evento e volta quando você registra o retorno; em reforma fica à parte até voltar."
      />
      <EstoqueTela itens={itens.map((i) => ({ ...i, atualizadoEm: i.atualizadoEm.toISOString() }))} catalogo={catalogo} />
    </>
  );
}
