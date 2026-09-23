"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { encerrarOutrasSessoesAction } from "@/app/(app)/perfil/actions";
import { Button } from "@/components/ui/button";
import { toast, toastErro } from "@/components/ui/toast";

/** "Encerrar outras sessões": desconecta a conta em todos os outros navegadores, mantendo este. */
export function EncerrarSessoes({ outras }: { outras: number }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const encerrar = () =>
    iniciar(async () => {
      const r = await encerrarOutrasSessoesAction();
      if (r.ok) {
        toast(r.mensagem ?? "Outras sessões encerradas.");
        router.refresh();
      } else toastErro(r.erro);
    });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="m-0 text-corpo text-ink-2">
        {outras === 0 ? "Sua conta está aberta só neste navegador." : `Sua conta também está aberta em ${outras} ${outras === 1 ? "outro navegador" : "outros navegadores"}.`}
      </p>
      <Button variant="secondary" onClick={encerrar} loading={pendente} disabled={outras === 0} motivoDesabilitado={outras === 0 ? "Não há outras sessões abertas." : undefined}>
        Encerrar outras sessões
      </Button>
    </div>
  );
}
