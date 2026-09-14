import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { PERFIL_DESCRICAO, PERFIL_LABEL } from "@/domain/permissions";
import { ListaDados, PageHeader, Section } from "@/components/ui/layout";
import { SenhaForm } from "@/components/admin/senha-form";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const u = await requireUsuario();
  return (
    <div className="max-w-[720px]">
      <PageHeader title="Meu perfil" description={PERFIL_DESCRICAO[u.perfil]} />
      <div className="flex flex-col gap-5">
        <Section titulo="Dados" sub="Para alterar nome, perfil ou área, fale com o administrador.">
          <ListaDados
            itens={[
              { label: "Nome", valor: u.nome },
              { label: "E-mail", valor: u.email },
              { label: "Perfil", valor: PERFIL_LABEL[u.perfil], forte: true },
              { label: "Área", valor: u.areaNome ?? "—" },
            ]}
          />
        </Section>
        <Section titulo="Alterar senha">
          <div className="px-[18px] py-4">
            <SenhaForm />
          </div>
        </Section>
      </div>
    </div>
  );
}
