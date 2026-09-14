import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";

export default function SemPermissaoPage() {
  return (
    <EmptyState
      title="Você não tem acesso a esta área"
      description="Seu perfil não permite ver esta página. Se precisar deste acesso, fale com o administrador do sistema."
      action={
        <ButtonLink href="/" variant="primary">
          Ir para o painel
        </ButtonLink>
      }
    />
  );
}
