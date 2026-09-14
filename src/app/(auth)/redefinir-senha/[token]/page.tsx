import Link from "next/link";
import { tokenValido } from "@/server/services/recuperacao";
import { Aviso } from "@/components/ui/layout";
import { RedefinirForm } from "./form";

export default async function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await tokenValido(token))) {
    return (
      <>
        <h2 className="mb-5 mt-0 text-[24px] font-semibold tracking-[-0.02em]">Link inválido</h2>
        <Aviso tom="danger" titulo="Este link expirou ou já foi usado">
          Peça um novo link ao administrador ou pela recuperação de acesso.
        </Aviso>
        <p className="mb-0 mt-4 text-center text-[13.5px]">
          <Link href="/recuperar-senha" className="link">
            Recuperar acesso
          </Link>
        </p>
      </>
    );
  }
  return <RedefinirForm token={token} />;
}
