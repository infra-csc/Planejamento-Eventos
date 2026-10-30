import { requirePermissao } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { BotaoNovoVeiculo } from "@/components/carga/botao-novo-veiculo";
import { PageHeader } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";

/**
 * Carga e descarga do galpão (logística e administrador). Substitui a planilha "Resumo semanal de carga
 * e descarga": o calendário da operação e o cadastro dos veículos de cada evento.
 */
export default async function CargaDescargaLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requirePermissao("carga.ver");
  return (
    <>
      <PageHeader title="Carga e descarga" description="O que sai do galpão, o que volta e quando, em quantos veículos." actions={pode(usuario, "carga.editar") ? <BotaoNovoVeiculo /> : undefined} />
      <TabsNav
        rotulo="Seções de carga e descarga"
        tabs={[
          { href: "/carga-descarga", label: "Calendário", exact: true },
          { href: "/carga-descarga/cadastro", label: "Cadastro" },
        ]}
      />
      {children}
    </>
  );
}
