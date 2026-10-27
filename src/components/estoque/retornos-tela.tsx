"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { periodoCurto } from "@/lib/format";
import { problemaRetorno } from "@/domain/estoque";
import { registrarRetornoAction } from "@/app/(app)/ativacao/actions";
import type { EventoRetorno } from "@/server/services/ativacao";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Field, FormError, Input } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { EmptyState } from "@/components/ui/layout";
import { toastErro, toastSucesso } from "@/components/ui/toast";

const SITUACAO: Record<EventoRetorno["situacao"], { rotulo: string; tom: "warning" | "info" | "success" }> = {
  pendente: { rotulo: "Retorno pendente", tom: "warning" },
  proximo: { rotulo: "Ainda vai sair", tom: "info" },
  registrado: { rotulo: "Retorno registrado", tom: "success" },
};

/**
 * Retornos por evento: pendentes primeiro (o evento já montou e ainda falta registrar), depois os próximos (a OS já
 * reserva os itens) e os registrados. Um botão por evento abre o registro de todos os itens de uma vez.
 */
export function RetornosTela({ eventos }: { eventos: EventoRetorno[] }) {
  const [registrando, setRegistrando] = useState<EventoRetorno | null>(null);
  const [verRegistrados, setVerRegistrados] = useState(false);
  const abertos = eventos.filter((e) => e.situacao !== "registrado");
  const registrados = eventos.filter((e) => e.situacao === "registrado");

  if (!eventos.length)
    return (
      <EmptyState
        icone="caixa"
        title="Nenhum evento leva itens do estoque"
        description="Os itens saem com a OS quando estão ligados a uma peça do catálogo (no Estoque, em Editar › Peça do catálogo) e o evento tem a ata fechada."
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {abertos.length === 0 && <p className="m-0 rounded-cartao border border-line bg-surface px-cartao py-4 text-corpo text-ink-2">Todos os retornos estão registrados.</p>}
      {abertos.map((e) => (
        <CartaoEvento key={e.evento.id} e={e} onRegistrar={() => setRegistrando(e)} />
      ))}
      {registrados.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setVerRegistrados((v) => !v)} aria-expanded={verRegistrados}>
            <Icone nome={verRegistrados ? "seta-cima" : "seta-baixo"} />
            {verRegistrados ? "Esconder" : "Ver"} retornos registrados ({registrados.length})
          </Button>
          {verRegistrados && (
            <div className="mt-3 flex flex-col gap-4">
              {registrados.map((e) => (
                <CartaoEvento key={e.evento.id} e={e} onRegistrar={() => setRegistrando(e)} />
              ))}
            </div>
          )}
        </div>
      )}
      <Dialog open={registrando !== null} onOpenChange={(v) => !v && setRegistrando(null)}>
        {registrando && <FormRetorno key={registrando.evento.id} e={registrando} onFechar={() => setRegistrando(null)} />}
      </Dialog>
    </div>
  );
}

function CartaoEvento({ e, onRegistrar }: { e: EventoRetorno; onRegistrar: () => void }) {
  const s = SITUACAO[e.situacao];
  const corrigir = e.itens.some((i) => i.retorno);
  return (
    <section className="overflow-hidden rounded-cartao border border-line bg-surface" aria-label={`${e.evento.codigo} ${e.evento.nome}: ${s.rotulo}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-cartao py-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/eventos/${e.evento.id}`} className="text-destaque font-semibold text-ink no-underline hover:underline">
              {e.evento.nome}
            </Link>
            <Tag tom={s.tom}>{s.rotulo}</Tag>
          </p>
          <p className="m-0 mt-0.5 text-pequeno text-ink-3">
            <Codigo>{e.evento.codigo}</Codigo> · montagem a desmontagem <span className="numero">{periodoCurto(e.evento.dataMontagem, e.evento.dataDesmontagem)}</span>
          </p>
        </div>
        {e.saiu ? (
          <Button variant={e.situacao === "pendente" ? "primary" : "secondary"} size="sm" onClick={onRegistrar}>
            <Icone nome={corrigir ? "lapis" : "check"} />
            {corrigir ? (e.situacao === "pendente" ? "Completar retorno" : "Corrigir retorno") : "Registrar retorno"}
          </Button>
        ) : (
          <span className="text-pequeno text-ink-3">Sai na montagem; o retorno é registrado depois do evento.</span>
        )}
      </header>
      <div className="overflow-x-auto">
        {/* Larguras fixas: as colunas de números ficam alinhadas de um evento para o outro. */}
        <table className="w-full min-w-[560px] table-fixed border-collapse">
          <thead>
            <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted">
              <th className="px-3 py-2 pl-cartao">Item</th>
              <th className="w-24 px-3 py-2 text-right">Levou</th>
              <th className="w-24 px-3 py-2 text-right">Voltaram</th>
              <th className="w-24 px-3 py-2 text-right">Reforma</th>
              <th className="w-28 px-3 py-2 pr-cartao text-right">Perdidos</th>
            </tr>
          </thead>
          <tbody>
            {e.itens.map((i) => (
              <tr key={i.itemId} className="border-t border-line-row">
                <td className="px-3 py-2 pl-cartao text-corpo">
                  <Link href={`/ativacao/itens/${i.itemId}`} className="text-ink no-underline hover:underline">
                    {i.nome}
                  </Link>
                  {i.retorno?.observacao && <span className="block text-rotulo text-muted">{i.retorno.observacao}</span>}
                </td>
                <td className="numero px-3 py-2 text-right text-corpo font-semibold">{i.levou}</td>
                {i.retorno ? (
                  <>
                    <td className="numero px-3 py-2 text-right text-corpo text-success">{i.retorno.voltaram}</td>
                    <td className={cn("numero px-3 py-2 text-right text-corpo", i.retorno.reforma ? "text-warning" : "text-line-strong")}>{i.retorno.reforma || "—"}</td>
                    <td className={cn("numero px-3 py-2 pr-cartao text-right text-corpo", i.retorno.perdidos ? "text-danger" : "text-line-strong")}>{i.retorno.perdidos || "—"}</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-3 py-2 pr-cartao text-right text-pequeno text-ink-3">
                    {e.saiu ? "falta registrar" : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Linha = { itemId: string; nome: string; levou: number; voltaram: number; reforma: number; perdidos: number; observacao: string; travada: boolean };

/** Um formulário para todos os itens do evento: começa com "voltaram = levou" (o caso comum é voltar tudo). */
function FormRetorno({ e, onFechar }: { e: EventoRetorno; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    e.itens.map((i) => ({
      itemId: i.itemId,
      nome: i.nome,
      levou: i.levou,
      voltaram: i.retorno?.voltaram ?? i.levou,
      reforma: i.retorno?.reforma ?? 0,
      perdidos: i.retorno?.perdidos ?? 0,
      observacao: i.retorno?.observacao ?? "",
      travada: Boolean(i.retorno?.reformaConcluida),
    })),
  );
  const [erro, setErro] = useState<string | null>(null);
  // Mexeu num número ou na observação: o aviso de erro de antes já não vale.
  const mudar = (k: number, campo: keyof Linha, v: number | string) => {
    setErro(null);
    setLinhas((ls) => ls.map((l, i) => (i === k ? { ...l, [campo]: v } : l)));
  };
  const problemas = useMemo(() => linhas.map((l) => problemaRetorno(l)), [linhas]);

  const salvar = () =>
    iniciar(async () => {
      const k = problemas.findIndex(Boolean);
      if (k >= 0) {
        setErro(`${linhas[k].nome}: ${problemas[k]}`);
        return;
      }
      const r = await registrarRetornoAction({ eventoId: e.evento.id, itens: linhas.map((l) => ({ itemId: l.itemId, voltaram: l.voltaram, reforma: l.reforma, perdidos: l.perdidos, observacao: l.observacao || null })) });
      if (!r.ok) {
        setErro(r.erro);
        toastErro(r.erro);
        return;
      }
      toastSucesso(`Retorno do ${e.evento.codigo} registrado`);
      onFechar();
      router.refresh();
    });

  return (
    <DialogContent title={`Retorno · ${e.evento.nome}`} description="Quantos voltaram em bom estado, quantos vão para reforma e quantos se perderam. Reforma e perdidos saem do estoque; a reforma aparece na aba Reformas." width={720}>
      <div className="flex flex-col gap-3">
        {linhas.map((l, k) => {
          const soma = l.voltaram + l.reforma + l.perdidos;
          return (
            <fieldset key={l.itemId} className="m-0 rounded-controle border border-line p-3">
              <legend className="px-1 text-corpo font-medium text-ink">
                {l.nome} <span className="font-normal text-ink-3">· levou <Numero valor={l.levou} /></span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Voltaram bons" htmlFor={`ret-v-${k}`}>
                  <Stepper id={`ret-v-${k}`} valor={l.voltaram} min={0} onChange={(v) => mudar(k, "voltaram", v)} label={`Voltaram bons de ${l.nome}`} />
                </Field>
                <Field label="Para reforma" htmlFor={`ret-r-${k}`} hint={l.travada ? "A reforma já foi concluída." : undefined}>
                  <Stepper id={`ret-r-${k}`} valor={l.reforma} min={0} onChange={(v) => mudar(k, "reforma", v)} label={`Para reforma de ${l.nome}`} disabled={l.travada} />
                </Field>
                <Field label="Perdidos" htmlFor={`ret-p-${k}`}>
                  <Stepper id={`ret-p-${k}`} valor={l.perdidos} min={0} onChange={(v) => mudar(k, "perdidos", v)} label={`Perdidos de ${l.nome}`} />
                </Field>
              </div>
              <div className="mt-2.5">
                <Field label="Observação" htmlFor={`ret-o-${k}`} optional={soma === l.levou} obrigatorio={soma !== l.levou} hint={soma !== l.levou ? `Soma ${soma}, a OS levou ${l.levou}: diga o que aconteceu.` : "Ex.: 2 com o tecido rasgado."}>
                  <Input id={`ret-o-${k}`} aria-label={`Observação de ${l.nome}`} value={l.observacao} maxLength={500} onChange={(ev) => mudar(k, "observacao", ev.target.value)} />
                </Field>
              </div>
            </fieldset>
          );
        })}
        {erro && <FormError message={erro} />}
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={salvar} loading={pendente}>
          Registrar retorno
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
