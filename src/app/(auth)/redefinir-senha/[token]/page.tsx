import Link from "next/link";
import { tokenValido } from "@/server/services/recuperacao";
import { Notice } from "@/components/ui/layout";
import { RedefinirForm } from "./form";

export default async function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = await tokenValido(token);
  if (!valido) {
    return (
      <div className="space-y-4">
        <Notice tone="danger" title="Link inválido ou expirado">
          Solicite uma nova recuperação de senha.
        </Notice>
        <p className="text-center text-[13px]">
          <Link href="/recuperar-senha" className="text-info hover:underline">
            Solicitar novamente
          </Link>
        </p>
      </div>
    );
  }
  return <RedefinirForm token={token} />;
}
