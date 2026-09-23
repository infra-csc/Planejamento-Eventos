import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/ui/botao-voltar";
import { Icone } from "@/components/ui/icons";
import { DefinirTrilha } from "@/components/shell/trilha";

export const metadata: Metadata = { title: "Não encontrado" };

/** `notFound()` dentro do app: a mensagem aparece no próprio shell, com menu e busca à mão. */
export default function NaoEncontradoApp() {
  return (
    <>
      <DefinirTrilha itens={[{ label: "Painel", href: "/" }, { label: "Não encontrado" }]} />
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center sm:py-20">
        <span aria-hidden className="mb-4 grid size-11 place-items-center rounded-full bg-neutral-bg text-ink-3">
          <Icone nome="busca" tamanho={20} />
        </span>
        <p className="m-0 mb-1 text-pequeno text-muted">
          Erro <span className="numero">404</span>
        </p>
        <h1 className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">Não encontrado</h1>
        <p className="m-0 mt-1.5 text-corpo text-ink-2">Este registro não existe, foi excluído ou o endereço está incompleto.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/" variant="primary" size="lg" className="no-underline">
            Ir para o painel
          </ButtonLink>
          <BotaoVoltar />
        </div>
      </div>
    </>
  );
}
