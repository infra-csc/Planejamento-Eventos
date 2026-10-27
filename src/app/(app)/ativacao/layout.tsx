import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { podeGerenciarEstoque } from "@/domain/estoque";
import { listarReformas, listarRetornos } from "@/server/services/ativacao";
import { TabsNav } from "@/components/ui/tabs-nav";

/**
 * Módulo Ativação (27/10): o estoque da área, os retornos dos eventos (o que a OS levou e voltou) e as reformas.
 * Da própria Ativação e do administrador.
 */
export default async function AtivacaoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const [retornos, reformas] = await Promise.all([listarRetornos(usuario), listarReformas(usuario)]);
  const pendentes = retornos.filter((r) => r.situacao === "pendente").length;
  const abertas = reformas.filter((r) => r.status === "ABERTA").length;
  return (
    <>
      <TabsNav
        rotulo="Seções da Ativação"
        tabs={[
          { href: "/ativacao", label: "Estoque", exact: true },
          { href: "/ativacao/retornos", label: "Retornos", n: pendentes || null },
          { href: "/ativacao/reformas", label: "Reformas", n: abertas || null },
        ]}
      />
      {children}
    </>
  );
}
