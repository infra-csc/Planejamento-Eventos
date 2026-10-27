import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { podeGerenciarEstoque } from "@/domain/estoque";
import { listarReformas, listarRetornos } from "@/server/services/ativacao";
import { PageHeader } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";

/** Título do módulo e as abas Estoque, Retornos (pendentes) e Reformas (em andamento). A página do item fica fora. */
export default async function AbasAtivacaoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  // Os layouts rodam em paralelo: sem esta trava, quem não tem acesso gerava erro aqui antes do redirecionamento do layout de cima.
  if (!podeGerenciarEstoque(usuario)) redirect("/sem-permissao");
  const [retornos, reformas] = await Promise.all([listarRetornos(usuario), listarReformas(usuario)]);
  const pendentes = retornos.filter((r) => r.situacao === "pendente").length;
  const abertas = reformas.filter((r) => r.status === "ABERTA").length;
  return (
    <>
      <PageHeader title="Ativação" description="Estoque da área: o que sai com a OS dos eventos, o que volta e o que está em reforma." className="!mb-3" />
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
