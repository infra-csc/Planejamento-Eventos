import { ButtonLink } from "@/components/ui/button";

export default function SemPermissaoPage() {
  return (
    <div className="max-w-[560px] rounded-[10px] border border-line bg-surface px-6 py-8">
      <p className="m-0 font-mono text-[12.5px] text-muted">acesso restrito</p>
      <h1 className="mb-0 mt-1 text-[20px] font-semibold tracking-[-0.02em]">Seu perfil não acessa esta página</h1>
      <p className="mb-0 mt-2 text-[13.5px] leading-[1.55] text-ink-2">Solicitações de outras áreas e telas administrativas ficam fora do seu perfil. Se precisar do acesso, fale com o administrador do sistema.</p>
      <ButtonLink href="/" variant="primary" size="md" className="mt-4 no-underline">
        Ir para o painel
      </ButtonLink>
    </div>
  );
}
