"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChipMono } from "@/components/ui/badge";
import { toast, toastErro } from "@/components/ui/toast";
import { marcarOsEnviadaAction } from "@/app/(app)/eventos/actions";

type Diferenca = { codigo: string; nome: string; antes: number; depois: number };

/**
 * Envio da OS ao carregamento. Depois de enviada, o que entra vira "complemento": a logística
 * escolhe entre exportar só a diferença (adendo para o galpão) ou incorporar tudo numa OS nova,
 * que passa a ser a enviada.
 */
export function EnvioOs({
  eventoId,
  versaoAtual,
  podeEnviar,
  enviada,
}: {
  eventoId: string;
  versaoAtual: number;
  podeEnviar: boolean;
  enviada: { numero: number; enviadaEm: string; enviadaPor: string | null; diff: Diferenca[]; avulsosNovos: number } | null;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, iniciar] = useTransition();
  const mudou = enviada ? enviada.diff.length + enviada.avulsosNovos : 0;
  const incorporar = Boolean(enviada);

  const marcar = () =>
    iniciar(async () => {
      const r = await marcarOsEnviadaAction(eventoId);
      if (!r.ok) return toastErro(r.erro);
      toast(r.mensagem ?? "OS marcada como enviada");
      setConfirmar(false);
      router.refresh();
    });

  return (
    <div className="px-[18px] py-3.5">
      {!enviada ? (
        <>
          <p className="m-0 text-pequeno leading-[1.5] text-ink-2">Quando a OS for para o galpão, marque aqui. O que entrar depois vira um complemento separado, em vez de sumir dentro de uma versão nova.</p>
          {podeEnviar && (
            <Button variant="primary" size="md" className="mt-3 w-full" onClick={() => setConfirmar(true)}>
              Marcar OS v{versaoAtual} como enviada
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="m-0 text-pequeno text-ink-2">
            <span className="font-medium text-ink">OS v{enviada.numero}</span> enviada em {enviada.enviadaEm}
            {enviada.enviadaPor ? ` por ${enviada.enviadaPor}` : ""}.
          </p>
          {mudou === 0 ? (
            <p className="mb-0 mt-1.5 text-pequeno text-success">Nada mudou desde o envio: o galpão está com a versão certa.</p>
          ) : (
            <>
              <p className="mb-0 mt-1.5 text-pequeno text-warning">
                {mudou} {mudou === 1 ? "mudança" : "mudanças"} desde o envio. Escolha: mandar só o complemento ou incorporar numa OS nova.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {enviada.diff.slice(0, 6).map((d) => (
                  <ChipMono key={d.codigo} tom={d.depois > d.antes ? "success" : "danger"} title={d.nome}>
                    {d.codigo} {d.antes} → {d.depois}
                  </ChipMono>
                ))}
                {enviada.diff.length > 6 && <ChipMono tom="control">+{enviada.diff.length - 6}</ChipMono>}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <a href={`/api/os/${eventoId}/complemento`} className={buttonClasses({ variant: "primary", size: "md", className: "w-full no-underline" })}>
                  Exportar só o complemento (.xlsx)
                </a>
                {podeEnviar && (
                  <Button variant="secondary" size="md" className="w-full" onClick={() => setConfirmar(true)}>
                    Incorporar: nova OS enviada
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        {confirmar && (
          <DialogContent
            title={incorporar ? "Incorporar o complemento numa OS nova" : `Marcar a OS v${versaoAtual} como enviada`}
            description={
              incorporar
                ? "A OS de agora (com tudo que entrou depois do envio) passa a ser a versão enviada ao carregamento. O complemento deixa de existir separado: o galpão precisa receber a OS completa de novo."
                : "Fica registrado quem enviou e quando. A partir daqui, toda mudança aparece como complemento até você decidir o que fazer com ela."
            }
            width={480}
          >
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={pendente}>
                Cancelar
              </Button>
              <Button variant="primary" loading={pendente} onClick={marcar}>
                {incorporar ? "Incorporar e marcar como enviada" : "Marcar como enviada"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
