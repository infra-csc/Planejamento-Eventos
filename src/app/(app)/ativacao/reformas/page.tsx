import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarEstoque } from "@/server/services/estoque";
import { listarReformas } from "@/server/services/ativacao";
import { PageHeader } from "@/components/ui/layout";
import { ReformasTela } from "@/components/estoque/reformas-tela";

export const metadata: Metadata = { title: "Ativação · Reformas" };

/** Itens em reforma: os que voltaram danificados de um evento e os separados à mão. */
export default async function AtivacaoReformasPage() {
  const usuario = await requireUsuario();
  const [reformas, itens] = await Promise.all([listarReformas(usuario), listarEstoque(usuario)]);
  return (
    <>
      <PageHeader title="Reformas" description="Enquanto em reforma, o item não conta como disponível. Ao concluir, os consertados voltam ao estoque e os outros são baixados." />
      <ReformasTela reformas={reformas} itens={itens.filter((i) => i.ativo && i.quantidade > 0).map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade }))} />
    </>
  );
}
