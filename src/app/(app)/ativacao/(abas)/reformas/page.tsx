import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { podeGerenciarEstoque } from "@/domain/estoque";

import { listarEstoque } from "@/server/services/estoque";
import { listarReformas } from "@/server/services/ativacao";
import { ReformasTela } from "@/components/estoque/reformas-tela";

export const metadata: Metadata = { title: "Ativação · Reformas" };

/** Itens em reforma: os que voltaram danificados de um evento e os separados à mão. */
export default async function AtivacaoReformasPage() {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const [reformas, itens] = await Promise.all([listarReformas(usuario), listarEstoque(usuario)]);
  return (
    <>
      <p className="mb-4 mt-0 max-w-[70ch] text-pequeno text-muted">Enquanto em reforma, o item não conta como disponível. Ao concluir, os consertados voltam ao estoque e os outros são baixados.</p>
      <ReformasTela reformas={reformas} itens={itens.filter((i) => i.ativo && i.quantidade - i.emEvento > 0).map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, emEvento: i.emEvento, reservado: i.reservado }))} />
    </>
  );
}
