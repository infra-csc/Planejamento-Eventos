import type { Metadata } from "next";
import { contarSessoesAtivas, requireUsuario } from "@/server/auth/session";
import { PERFIL_DESCRICAO, PERFIL_LABEL } from "@/domain/permissions";
import { Aviso, ListaDados, PageHeader, Section } from "@/components/ui/layout";
import { SenhaForm } from "@/components/admin/senha-form";
import { EncerrarSessoes } from "@/components/admin/encerrar-sessoes";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ trocar?: string }> }) {
  const [u, sp] = await Promise.all([requireUsuario(), searchParams]);
  const sessoes = await contarSessoesAtivas(u.id);
  const trocar = Boolean(u.trocarSenha) || sp.trocar === "1";
  // Com a troca pendente, o formulário de senha vem primeiro.
  const secaoSenha = (
    <Section titulo="Alterar senha">
      <div className="px-cartao py-4">
        <SenhaForm />
      </div>
    </Section>
  );
  return (
    <div className="max-w-3xl">
      <PageHeader title="Meu perfil" description={PERFIL_DESCRICAO[u.perfil]} divisor />
      <div className="flex flex-col gap-5">
        {trocar && (
          <Aviso tom="warning" titulo="Defina uma senha nova para continuar">
            Sua senha atual é provisória. Escolha uma senha só sua; as outras páginas ficam liberadas logo depois.
          </Aviso>
        )}
        {trocar && secaoSenha}
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
        {!trocar && secaoSenha}
        <Section titulo="Sessões" sub="A sessão expira depois de 14 dias sem uso ou 30 dias desde a entrada.">
          <div className="px-cartao py-4">
            <EncerrarSessoes outras={Math.max(0, sessoes - 1)} />
          </div>
        </Section>
      </div>
    </div>
  );
}
