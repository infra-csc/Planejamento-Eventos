import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/ui/botao-voltar";
import { PageHeader, Section } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Não encontrado" };

/** `notFound()` dentro do app: a mensagem aparece no próprio shell, com menu e busca à mão. */
export default function NaoEncontradoApp() {
  return (
    <>
      <PageHeader title="Não encontrado" breadcrumbs={[{ label: "Painel", href: "/" }, { label: "Não encontrado" }]} />
      <Section padded className="max-w-[640px]">
        <p className="m-0 font-mono text-pequeno text-muted">erro 404</p>
        <p className="mb-0 mt-1 text-secao leading-[1.55] text-ink-2">
          Este registro não existe, foi excluído ou o endereço está incompleto. Eventos e solicitações canceladas continuam acessíveis pela busca.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/" variant="primary" size="lg" className="no-underline">
            Ir para o Painel
          </ButtonLink>
          <BotaoVoltar />
        </div>
      </Section>
    </>
  );
}
