import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarAreasComContagem } from "@/server/services/admin";
import { AreasTabela } from "@/components/admin/areas-tabela";

export const metadata: Metadata = { title: "Áreas" };

export default async function AreasPage() {
  const usuario = await requirePermissao("admin.areas");
  const areas = await listarAreasComContagem(usuario);
  return <AreasTabela areas={areas} />;
}
