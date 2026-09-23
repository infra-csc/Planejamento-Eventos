import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/ui/botao-voltar";
import { Icone } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Sem permissão" };

export default function SemPermissaoPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center sm:py-20">
      <span aria-hidden className="mb-4 grid size-11 place-items-center rounded-full bg-neutral-bg text-ink-3">
        <Icone nome="escudo" tamanho={20} />
      </span>
      <p className="m-0 mb-1 text-pequeno text-muted">Acesso restrito</p>
      <h1 className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">Seu perfil não acessa esta página</h1>
      <p className="m-0 mt-1.5 text-corpo text-ink-2">Se precisar do acesso, fale com o administrador do sistema.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/" variant="primary" size="lg" className="no-underline">
          Ir para o painel
        </ButtonLink>
        <BotaoVoltar />
      </div>
    </div>
  );
}
