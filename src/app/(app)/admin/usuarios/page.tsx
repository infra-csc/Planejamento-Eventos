import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarAreas, listarUsuarios } from "@/server/services/admin";
import { UsuariosTabela } from "@/components/admin/usuarios-tabela";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const usuario = await requirePermissao("admin.usuarios");
  const [usuarios, areas] = await Promise.all([listarUsuarios(usuario), listarAreas()]);
  return (
    <UsuariosTabela
      usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null, ativo: u.ativo, ultimoAcessoEm: u.ultimoAcessoEm }))}
      areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
      meuId={usuario.id}
    />
  );
}
