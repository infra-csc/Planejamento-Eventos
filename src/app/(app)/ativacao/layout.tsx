import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { podeGerenciarEstoque } from "@/domain/estoque";

/** Módulo Ativação (27/10): estoque, retornos e reformas da área. Da própria Ativação e do administrador. */
export default async function AtivacaoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  return children;
}
