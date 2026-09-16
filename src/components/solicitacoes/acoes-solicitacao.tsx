"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast, toastErro } from "@/components/ui/toast";
import { atenderTudoAction, cancelarSolicitacaoAction, devolverSolicitacaoAction, enviarRascunhoAction, excluirRascunhoAction } from "@/app/(app)/solicitacoes/actions";

/** Botões do cabeçalho da solicitação (handoff §5.10). */
export function AcoesSolicitacao({
  id,
  codigo,
  podeDevolver,
  podeAtenderTudo,
  pendentes,
  podeEditar,
  podeEnviar,
  podeCancelar,
  podeExcluir,
  proximaHref,
  sufixo,
}: {
  id: string;
  codigo: string;
  podeDevolver: boolean;
  podeAtenderTudo: boolean;
  pendentes: number;
  podeEditar: boolean;
  podeEnviar: boolean;
  podeCancelar: boolean;
  podeExcluir: boolean;
  proximaHref: string | null;
  sufixo: string;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<"devolver" | "cancelar" | "excluir" | null>(null);
  const [pendente, iniciar] = useTransition();
  // Dois cliques no mesmo tick chegam antes do re-render com `pendente`; o ref segura o segundo.
  const emVoo = useRef(false);

  return (
    <>
      {podeCancelar && (
        <Button variant="ghost" size="lg" onClick={() => setDialogo("cancelar")}>
          Cancelar solicitação
        </Button>
      )}
      {podeExcluir && (
        <Button variant="ghost" size="lg" onClick={() => setDialogo("excluir")}>
          Excluir rascunho
        </Button>
      )}
      {podeDevolver && (
        <Button variant="secondary" size="lg" onClick={() => setDialogo("devolver")}>
          Devolver para ajuste
        </Button>
      )}
      {podeAtenderTudo && (
        <Button
          variant="primary"
          size="lg"
          loading={pendente}
          onClick={() => {
            if (emVoo.current) return;
            emVoo.current = true;
            iniciar(async () => {
              try {
                const r = await atenderTudoAction(id);
                if (!r.ok) {
                  toastErro(r.erro);
                  return;
                }
                toast(`${codigo} respondida — ${pendentes} ${pendentes === 1 ? "item atendido" : "itens atendidos"}, ${sufixo}`);
                if (proximaHref) router.push(proximaHref);
              } finally {
                emVoo.current = false;
              }
            });
          }}
        >
          Atender tudo
        </Button>
      )}
      {podeEditar && (
        <ButtonLink href={`/solicitacoes/nova?rascunho=${id}`} variant="secondary" size="lg" className="no-underline">
          Editar itens
        </ButtonLink>
      )}
      {podeEnviar && (
        <Button
          variant="primary"
          size="lg"
          loading={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await enviarRascunhoAction(id);
              if (r.ok) toast(`${codigo} enviada para a logística`);
              else toastErro(r.erro);
            })
          }
        >
          Enviar
        </Button>
      )}

      {dialogo === "devolver" && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialogo(null)}
          title={`Devolver ${codigo} para ajuste`}
          description="A solicitação volta para a área como devolvida. Diga o que precisa ser corrigido."
          confirmLabel="Devolver"
          reasonLabel="Motivo da devolução"
          reasonPlaceholder="Ex.: faltou o destino das torres de som"
          action={devolverSolicitacaoAction}
          hidden={{ solicitacaoId: id }}
          onSuccess={() => proximaHref && router.push(proximaHref)}
        />
      )}
      {dialogo === "cancelar" && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialogo(null)}
          title={`Cancelar ${codigo}`}
          description="A solicitação sai da fila da logística. Não dá para desfazer."
          confirmLabel="Cancelar solicitação"
          danger
          reasonLabel="Motivo"
          reasonRequired={false}
          action={cancelarSolicitacaoAction}
          hidden={{ solicitacaoId: id }}
        />
      )}
      {dialogo === "excluir" && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialogo(null)}
          title={`Excluir o rascunho ${codigo}`}
          description="O rascunho e seus itens são descartados. A logística nunca chegou a vê-lo."
          confirmLabel="Excluir rascunho"
          danger
          action={excluirRascunhoAction}
          hidden={{ solicitacaoId: id }}
        />
      )}
    </>
  );
}
