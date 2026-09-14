import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { PERFIL_LABEL } from "@/domain/permissions";
import { KeyValue, PageHeader, Panel } from "@/components/ui/layout";
import { SenhaForm } from "@/components/admin/senha-form";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const u = await requireUsuario();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Meu perfil" />
      <Panel title="Dados">
        <KeyValue items={[{ label: "Nome", value: u.nome }, { label: "E-mail", value: u.email }, { label: "Perfil", value: PERFIL_LABEL[u.perfil] }, { label: "Área", value: u.areaNome ?? "—" }]} />
        <p className="mt-3 text-xs text-ink-muted">Para alterar nome, e-mail, perfil ou área, fale com o administrador.</p>
      </Panel>
      <Panel title="Alterar senha">
        <SenhaForm />
      </Panel>
    </div>
  );
}
