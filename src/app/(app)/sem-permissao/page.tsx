import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { BotaoVoltar } from "@/components/ui/botao-voltar";
import { Icone } from "@/components/ui/icons";
import { DefinirTrilha } from "@/components/shell/trilha";

export const metadata: Metadata = { title: "Sem permissão" };

/**
 * Motivos conhecidos de recusa. A solicitação de outra área (ou rascunho alheio) caía em "Seu perfil não acessa esta
 * página", mas o motivo não é o perfil (auditoria 28/10, nº 106).
 */
const MOTIVOS = {
  solicitacao: {
    titulo: "Esta solicitação não é da sua área",
    texto: "Ela é de outra área ou ainda é um rascunho que não foi enviado. Cada área vê as próprias solicitações; a logística vê as que já foram enviadas.",
  },
} as const;

export default async function SemPermissaoPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const m = motivo && Object.hasOwn(MOTIVOS, motivo) ? MOTIVOS[motivo as keyof typeof MOTIVOS] : null;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center sm:py-20">
      {/* Trilha, aba e título com o mesmo nome (a trilha dizia "Sem acesso"; auditoria 28/10, nº 173). */}
      <DefinirTrilha itens={[{ label: "Painel", href: "/" }, { label: "Sem permissão" }]} />
      <span aria-hidden className="mb-4 grid size-11 place-items-center rounded-full bg-neutral-bg text-ink-3">
        <Icone nome="escudo" tamanho={20} />
      </span>
      <p className="m-0 mb-1 text-pequeno text-muted">Acesso restrito</p>
      <h1 className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">{m?.titulo ?? "Seu perfil não acessa esta página"}</h1>
      <p className="m-0 mt-1.5 text-corpo text-ink-2">{m?.texto ?? "Se precisar do acesso, fale com o administrador do sistema."}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/" variant="primary" size="lg" className="no-underline">
          Ir para o painel
        </ButtonLink>
        <BotaoVoltar />
      </div>
    </div>
  );
}
