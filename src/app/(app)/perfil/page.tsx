import type { Metadata } from "next";
import { contarSessoesAtivas, requireUsuario } from "@/server/auth/session";
import { PERFIL_DESCRICAO } from "@/domain/permissions";
import { Aviso, PageHeader, Section } from "@/components/ui/layout";
import { PerfilBadge } from "@/components/ui/badge";
import { Icone } from "@/components/ui/icons";
import { SenhaForm } from "@/components/admin/senha-form";
import { EncerrarSessoes } from "@/components/admin/encerrar-sessoes";
import { iniciais } from "@/lib/format";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ trocar?: string }> }) {
  const [u, sp] = await Promise.all([requireUsuario(), searchParams]);
  const sessoes = await contarSessoesAtivas(u.id);
  const trocar = Boolean(u.trocarSenha) || sp.trocar === "1";
  return (
    <div className="max-w-3xl">
      <PageHeader title="Meu perfil" divisor />
      <div className="flex flex-col gap-5">
        {trocar && (
          <>
            <Aviso tom="warning" titulo="Defina uma senha nova para continuar">
              Sua senha atual é provisória. Escolha uma senha só sua; as outras páginas ficam liberadas logo depois.
            </Aviso>
            <Section titulo="Alterar senha">
              <div className="px-cartao py-4">
                <SenhaForm />
              </div>
            </Section>
          </>
        )}

        {/* Quem é: nome, contato, perfil e área num cartão só (antes era uma lista que repetia o cabeçalho). */}
        <section aria-label="Seus dados" className="rounded-cartao border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-4 px-cartao py-5">
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-bg text-titulo font-semibold text-accent">
              {iniciais(u.nome)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">{u.nome}</p>
              <p className="m-0 mt-0.5 break-all text-corpo text-ink-2">{u.email}</p>
              <p className="m-0 mt-2 flex flex-wrap items-center gap-2 text-pequeno text-ink-3">
                <PerfilBadge perfil={u.perfil} />
                {u.areaNome ? (
                  <span>
                    Área <span className="font-medium text-ink-2">{u.areaNome}</span>
                  </span>
                ) : (
                  <span className="text-muted">sem área</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 border-t border-line-soft px-cartao py-3 text-pequeno text-ink-2">
            <Icone nome="escudo" className="mt-0.5 shrink-0 text-ink-3" />
            <p className="m-0">
              {PERFIL_DESCRICAO[u.perfil]} <span className="text-muted">Para mudar nome, perfil ou área, fale com o administrador.</span>
            </p>
          </div>
        </section>

        <Section titulo="Sessões" sub="A sessão expira depois de 14 dias sem uso ou 30 dias desde a entrada.">
          <div className="px-cartao py-4">
            <EncerrarSessoes outras={Math.max(0, sessoes - 1)} />
          </div>
        </Section>

        {/* O acesso normal é pelo portal Norte; a senha do app só serve para quem entra direto com e-mail e senha. */}
        {!trocar && (
          <details className="group rounded-cartao border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-cartao py-3.5 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-corpo font-semibold text-ink">Senha do app</span>
                <span className="block text-pequeno text-muted">Quem entra pelo portal Norte não precisa. Só para quem entra direto com e-mail e senha.</span>
              </span>
              <Icone nome="chevron-baixo" className="shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <div className="border-t border-line-soft px-cartao py-4">
              <SenhaForm />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
