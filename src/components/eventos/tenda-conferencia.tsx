"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { ajustarTendasDoLocalAction } from "@/app/(app)/eventos/actions";
import type { LinhaConferencia } from "@/server/services/conferencia";

type Papel = "fechamento" | "calha";
type Coluna = { papel: Papel; rotulo: string };

/** Um local da tenda: as linhas dele e os totais (tendas e, por papel, peças = tendas × peças por tenda). */
type Local = { chave: string; nome: string | null; ls: LinhaConferencia[]; tendas: number; totais: Record<Papel, number>; ok: number };

const norm = (s: string | null) => (s ?? "").trim().toLocaleLowerCase("pt-BR");

function locaisDe(ls: readonly LinhaConferencia[], colunas: readonly Coluna[]): Local[] {
  const m = new Map<string, Local>();
  for (const l of ls) {
    const k = norm(l.destino);
    const loc = m.get(k) ?? { chave: k, nome: l.destino, ls: [], tendas: 0, totais: { fechamento: 0, calha: 0 }, ok: 0 };
    loc.ls.push(l);
    loc.tendas += l.quantidade;
    if (l.conferidoEm) loc.ok++;
    for (const c of colunas) loc.totais[c.papel] += l.quantidade * (l.tenda?.pecas.find((p) => p.papel === c.papel)?.porUnidade ?? 0);
    m.set(k, loc);
  }
  return [...m.values()].sort((a, b) => (a.nome ?? "~").localeCompare(b.nome ?? "~", "pt-BR"));
}

/** Quem pediu o local, em uma linha: "SOL-0074 · Produção · Ana Lima" (ou "Incluída na reunião"). */
function Origem({ ls }: { ls: readonly LinhaConferencia[] }) {
  const pedidos = [...new Map(ls.filter((l) => l.origem).map((l) => [l.origem!.solicitacaoId, l])).values()];
  const semPedido = ls.some((l) => !l.origem);
  return (
    <span className="block truncate text-rotulo text-ink-3">
      {pedidos.map((l, i) => (
        <span key={l.origem!.solicitacaoId}>
          {i > 0 && " · "}
          <Link href={`/solicitacoes/${l.origem!.solicitacaoId}`} className="text-ink-3 no-underline hover:text-accent hover:underline">
            <Codigo>{l.origem!.codigo}</Codigo>
          </Link>{" "}
          {l.areaNome ?? "Logística"} · {l.origem!.solicitante}
        </span>
      ))}
      {semPedido && (
        <>
          {pedidos.length > 0 && " · "}
          {ls.find((l) => !l.origem)?.regra ? "Regra da logística" : `Incluída na reunião${ls.find((l) => !l.origem)?.incluidaPor ? ` · ${ls.find((l) => !l.origem)!.incluidaPor}` : ""}`}
        </>
      )}
    </span>
  );
}

/**
 * Tenda na conferência, como no quadro de tendas: uma linha por local com quantas tendas e o total de
 * fechamentos e calhas. As linhas do mesmo local (pedidos diferentes, ou tendas com peças diferentes)
 * aparecem juntas; editar o local acerta tendas e peças de uma vez.
 */
export function BlocoTenda({
  ls,
  eventoId,
  editavel,
  onConferir,
}: {
  ls: readonly LinhaConferencia[];
  eventoId: string;
  editavel: boolean;
  onConferir: (ls: readonly LinhaConferencia[], v: boolean) => void;
}) {
  const p0 = ls[0];
  const colunas: Coluna[] = (p0.tenda?.pecas ?? []).map((p) => ({ papel: p.papel as Papel, rotulo: p.rotulo }));
  const locais = locaisDe(ls, colunas);
  const ok = ls.filter((l) => l.conferidoEm).length;
  const tudoOk = ok === ls.length;
  const totalTendas = locais.reduce((a, l) => a + l.tendas, 0);
  const [editando, setEditando] = useState<Local | null>(null);
  const grade = cn("grid items-center gap-x-3", colunas.length === 2 ? "grid-cols-[40px_minmax(0,1fr)_64px_88px_64px_40px]" : "grid-cols-[40px_minmax(0,1fr)_64px_88px_40px]");

  return (
    <section aria-label={`${p0.nome}: ${ok} de ${ls.length} linhas conferidas`} className="border-b border-line-row last:border-b-0">
      <h4 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-cartao pb-2 pt-3 font-normal">
        <span className="text-corpo font-semibold text-ink">{p0.nome}</span>
        {p0.codigo && <Codigo className="hidden text-rotulo text-muted xl:inline">{p0.codigo}</Codigo>}
        <span className="text-pequeno text-muted">
          <span className="numero font-medium text-ink">{totalTendas}</span> {totalTendas === 1 ? "tenda" : "tendas"} · {locais.length} {locais.length === 1 ? "local" : "locais"}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-2">
          <span className={cn("numero inline-flex items-center gap-1 text-pequeno", tudoOk ? "text-success" : "text-ink-3")}>
            {tudoOk && <Icone nome="check" className="size-3.5" />}
            {locais.filter((l) => l.ok === l.ls.length).length}/{locais.length} locais
          </span>
          {editavel && !tudoOk && (
            <Button variant="ghost" size="xs" onClick={() => onConferir(ls, true)}>
              <Icone nome="check" />
              Conferir todos
            </Button>
          )}
        </span>
      </h4>

      {/* Quadro do local: Local | Tendas | Fechamentos | Calhas, como na planilha de OS. */}
      <div className="mx-cartao mb-3 overflow-x-auto rounded-controle border border-line-soft">
        <div className="min-w-[440px]">
          <div className={cn(grade, "border-b border-line-soft bg-subtle px-2.5 py-1.5 text-micro font-semibold uppercase tracking-[0.06em] text-muted")} aria-hidden>
            <span />
            <span>Local</span>
            <span className="text-right">Tendas</span>
            {colunas.map((c) => (
              <span key={c.papel} className="text-right">
                {c.rotulo}
              </span>
            ))}
            <span />
          </div>
          <ul className="m-0 list-none p-0">
            {locais.map((loc) => {
              const conferido = loc.ok === loc.ls.length;
              const descricoes = [...new Set(loc.ls.flatMap((l) => (l.origem?.descricoes ?? []).map((d) => (d.unidades > 1 ? `${d.unidades}× ${d.texto}` : d.texto))))];
              return (
                <li key={loc.chave} data-linha={loc.ls[0].id} className={cn(grade, "border-b border-line-row px-2.5 py-2 transition-colors duration-200 last:border-b-0", conferido ? "bg-success-bg/40" : "hover:bg-subtle")}>
                  {editavel ? (
                    <button
                      type="button"
                      role="checkbox"
                      data-check=""
                      data-obrigatoria=""
                      aria-checked={conferido ? true : loc.ok > 0 ? "mixed" : false}
                      aria-label={`${p0.nome}, ${loc.nome ?? "sem local"}: ${conferido ? "conferido, clique para desfazer" : "marcar como conferido"}`}
                      onClick={() => onConferir(loc.ls, !conferido)}
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-full border-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        conferido ? "border-success bg-success text-white" : loc.ok > 0 ? "border-success bg-success-bg text-success" : "border-line-control bg-surface text-transparent hover:border-success hover:text-success/60",
                      )}
                    >
                      <Icone nome="check" tamanho={16} />
                    </button>
                  ) : (
                    <span role="img" aria-label={conferido ? "Conferido" : "Não conferido"} className={cn("grid size-9 place-items-center rounded-full border-2", conferido ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
                      <Icone nome="check" tamanho={16} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <Link href={`/eventos/${eventoId}/itens/${loc.ls[0].id}`} className="block truncate text-corpo font-medium text-ink no-underline hover:text-accent hover:underline" title="Tendas deste local: descrição, peças e histórico">
                      {loc.nome ?? "Sem local informado"}
                    </Link>
                    <Origem ls={loc.ls} />
                    {descricoes.length > 0 && (
                      <span className="block truncate text-rotulo text-ink-2" title={descricoes.join(" · ")}>
                        {descricoes.join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="numero text-right text-secao font-semibold text-ink">{loc.tendas}</span>
                  {colunas.map((c) => (
                    <span key={c.papel} className={cn("numero text-right text-corpo", loc.totais[c.papel] ? "font-medium text-ink" : "text-meta")}>
                      {loc.totais[c.papel]}
                    </span>
                  ))}
                  <span className="flex justify-end">
                    {editavel && (
                      <button
                        type="button"
                        onClick={() => setEditando(loc)}
                        aria-label={`Ajustar ${p0.nome} em ${loc.nome ?? "local não informado"}`}
                        title="Ajustar tendas, fechamentos e calhas deste local"
                        className="grid size-8 cursor-pointer place-items-center rounded-controle border-0 bg-transparent text-ink-3 transition-colors hover:bg-control hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <Icone nome="lapis" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        {editando && <AjusteTendaLocal eventoId={eventoId} nome={p0.nome} local={editando} colunas={colunas} onFechar={() => setEditando(null)} />}
      </Dialog>
    </section>
  );
}

/** Diálogo do local: tendas e o total de cada peça por local, como no quadro de tendas. */
function AjusteTendaLocal({ eventoId, nome, local, colunas, onFechar }: { eventoId: string; nome: string; local: Local; colunas: readonly Coluna[]; onFechar: () => void }) {
  const [tendas, setTendas] = useState(local.tendas);
  const [totais, setTotais] = useState<Record<Papel, number>>({ ...local.totais });
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  const mudou = tendas !== local.tendas || colunas.some((c) => totais[c.papel] !== local.totais[c.papel]);
  const salvar = () =>
    iniciar(async () => {
      const r = await ajustarTendasDoLocalAction(eventoId, { linhaIds: local.ls.map((l) => l.id), tendas, totais: Object.fromEntries(colunas.map((c) => [c.papel, totais[c.papel]])), motivo });
      if (!r.ok) return toastErro(r.erro);
      toastSucesso(`${nome} em ${local.nome ?? "local não informado"}: ${tendas} ${tendas === 1 ? "tenda" : "tendas"}${colunas.map((c) => ` · ${totais[c.papel]} ${c.rotulo.toLowerCase()}`).join("")}`);
      onFechar();
    });
  return (
    <DialogContent title={`${nome} · ${local.nome ?? "local não informado"}`} description="Quantas tendas vão neste local e o total de fechamentos e calhas do local. Fica conferido e registrado no histórico." width={460}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Tendas" htmlFor="tenda-qtd" hint={local.tendas !== tendas ? `era ${local.tendas}` : undefined}>
            <Stepper id="tenda-qtd" valor={tendas} min={0} onChange={setTendas} autoFocus />
          </Field>
          {colunas.map((c) => (
            <Field key={c.papel} label={c.rotulo} htmlFor={`tenda-${c.papel}`} hint={local.totais[c.papel] !== totais[c.papel] ? `era ${local.totais[c.papel]}` : "total do local"}>
              <Stepper id={`tenda-${c.papel}`} valor={totais[c.papel]} min={0} onChange={(v) => setTotais((t) => ({ ...t, [c.papel]: v }))} />
            </Field>
          ))}
        </div>
        {tendas === 0 && <p className="m-0 rounded-controle bg-danger-bg px-3 py-2 text-pequeno text-danger">Com 0 tendas, este local sai da ata.</p>}
        <Field label="Motivo" htmlFor="tenda-motivo" optional>
          <Textarea id="tenda-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ex.: cliente pediu mais uma tenda no buffet" className="min-h-[56px]" />
        </Field>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" size="lg" disabled={pendente}>
            Cancelar
          </Button>
        </DialogClose>
        <Button variant="primary" size="lg" loading={pendente} disabled={!mudou} motivoDesabilitado="Mude algum número para salvar" onClick={salvar}>
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
