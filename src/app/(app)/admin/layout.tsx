import { requirePermissao } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermissao("admin.usuarios");
  return (
    <>
      <PageHeader title="Administração" description="Usuários e perfis, áreas requisitantes e parâmetros do processo." />
      <TabsNav className="mb-5" tabs={[{ href: "/admin/usuarios", label: "Usuários" }, { href: "/admin/areas", label: "Áreas" }, { href: "/admin/configuracoes", label: "Configurações" }]} />
      {children}
    </>
  );
}
