"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
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
      toastSucesso(r.mensagem ?? "OS marcada como enviada");
      setConfirmar(false);
      router.refresh();
    });

  return (
    <div className="px-cartao py-3.5">
      {!enviada ? (
        <>
          <p className="m-0 flex items-start gap-2 text-pequeno text-ink-2">
            <Icone nome="info" className="mt-px shrink-0 text-ink-3" />
            <span>Marque quando a OS for para o galpão: o que entrar depois vira um complemento separado.</span>
          </p>
          {podeEnviar && (
            <Button variant="primary" size="md" className="mt-3 w-full" onClick={() => setConfirmar(true)}>
              Marcar v{versaoAtual} como enviada
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="m-0 text-pequeno text-ink-2">
            <Codigo className="font-medium text-ink">v{enviada.numero}</Codigo> enviada em <span className="numero">{enviada.enviadaEm}</span>
            {enviada.enviadaPor ? ` por ${enviada.enviadaPor}` : ""}.
          </p>
          <p className={cn("mb-0 mt-2 flex items-start gap-2 text-pequeno font-medium", mudou === 0 ? "text-success" : "text-warning")}>
            <Icone nome={mudou === 0 ? "check-circulo" : "alerta"} className="mt-px shrink-0" />
            {mudou === 0 ? "Nada mudou desde o envio: o galpão está com a versão certa." : `${mudou} ${mudou === 1 ? "mudança" : "mudanças"} desde o envio`}
          </p>
          {mudou > 0 && (
            <>
              {enviada.diff.length > 0 && (
                <ul className="m-0 mt-2 list-none rounded-controle border border-line p-0">
                  {enviada.diff.slice(0, 6).map((d) => {
                    const delta = d.depois - d.antes;
                    return (
                      <li key={d.codigo} className="flex items-baseline gap-2 border-b border-line-row px-2.5 py-1.5 text-pequeno last:border-b-0" title={d.nome}>
                        <Codigo className="min-w-0 flex-1 truncate text-ink-2">{d.codigo}</Codigo>
                        <span className="numero text-muted">
                          {d.antes} → <span className="text-ink">{d.depois}</span>
                        </span>
                        <span className={cn("numero w-10 text-right font-medium", delta > 0 ? "text-success" : "text-danger")}>
                          {delta > 0 ? "+" : "−"}
                          {Math.abs(delta)}
                        </span>
                      </li>
                    );
                  })}
                  {enviada.diff.length > 6 && <li className="px-2.5 py-1.5 text-rotulo text-muted">e mais {enviada.diff.length - 6} peças</li>}
                </ul>
              )}
              {enviada.avulsosNovos > 0 && (
                <p className="mb-0 mt-1.5 text-rotulo text-muted">
                  + {enviada.avulsosNovos} {enviada.avulsosNovos === 1 ? "item fora do catálogo" : "itens fora do catálogo"}
                </p>
              )}
              <p className="mb-0 mt-3 text-pequeno text-muted">Mande só o complemento ao galpão ou incorpore tudo numa OS nova.</p>
              <div className="mt-2 flex flex-col gap-2">
                <a href={`/api/os/${eventoId}/complemento`} className={buttonClasses({ variant: "primary", size: "md", className: "w-full no-underline" })}>
                  <Icone nome="download" />
                  Complemento (.xlsx)
                </a>
                {podeEnviar && (
                  <Button variant="secondary" size="md" className="w-full" onClick={() => setConfirmar(true)}>
                    Incorporar numa OS nova
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
            <DialogFooter className="!mt-0">
              <Button variant="primary" size="lg" loading={pendente} onClick={marcar}>
                {incorporar ? "Incorporar e marcar como enviada" : "Marcar como enviada"}
              </Button>
              <DialogClose asChild>
                <Button variant="secondary" size="lg" disabled={pendente}>
                  Cancelar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
