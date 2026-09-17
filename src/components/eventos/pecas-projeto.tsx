"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ajustarPecaDoProjetoAction } from "@/app/(app)/eventos/actions";

export type PecaDoProjeto = { pecaId: string; codigo: string; nome: string; unidade: string; porUnidade: number; total: number };

type Edicao = { pecaId: string | null; codigo: string; nome: string; porUnidade: number };

const campo = "rounded-lg border border-line-control bg-surface px-3 text-[13.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none";

/**
 * Peças de um projeto na ata/OS, editáveis uma a uma (quantidade por unidade, tirar ou incluir peça),
 * sempre com motivo. A lista original do projeto padrão não muda: só esta linha do evento.
 */
export function PecasProjeto({
  eventoId,
  linhaId,
  quantidadeProjeto,
  pecas,
  editavel,
  opcoesPecas,
  depoisDaAta,
}: {
  eventoId: string;
  linhaId: string;
  quantidadeProjeto: number;
  pecas: PecaDoProjeto[];
  editavel: boolean;
  opcoesPecas: Array<{ id: string; codigo: string; nome: string }>;
  /** Ata fechada: o ajuste gera nova versão da OS e avisa a área. */
  depoisDaAta: boolean;
}) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [qtd, setQtd] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const abrir = (e: Edicao) => {
    setEdicao(e);
    setQtd(e.pecaId ? e.porUnidade : 1);
    setMotivo("");
    setErro(null);
  };

  const salvar = () => {
    if (!edicao?.pecaId) return setErro("Escolha a peça.");
    if (!motivo.trim()) return setErro("Informe o motivo. Ele fica no histórico.");
    const pecaId = edicao.pecaId;
    iniciar(async () => {
      const r = await ajustarPecaDoProjetoAction(eventoId, linhaId, pecaId, qtd, motivo);
      if (!r.ok) return setErro(r.erro);
      toast(qtd === 0 ? `${edicao.nome} retirada do projeto` : `${edicao.nome}: ${qtd} por unidade`);
      setEdicao(null);
    });
  };

  const naLista = new Set(pecas.map((p) => p.pecaId));
  const totalUnidades = pecas.reduce((a, p) => a + p.total, 0);

  return (
    <>
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">Peças do projeto nesta linha</caption>
        <thead>
          <tr className="bg-subtle text-left text-[11.5px] uppercase tracking-[0.04em] text-muted">
            <th className="px-[18px] py-2 font-medium">Código</th>
            <th className="px-2 py-2 font-medium">Peça</th>
            <th className="w-[90px] px-2 py-2 text-right font-medium">Por un.</th>
            <th className="w-[80px] px-2 py-2 text-right font-medium">Total</th>
            {editavel && <th className="w-[52px] py-2 pr-[18px]" />}
          </tr>
        </thead>
        <tbody>
          {pecas.map((p) => (
            <tr key={p.pecaId} className="border-b border-line-row last:border-b-0 hover:bg-subtle">
              <td className="px-[18px] py-1.5 font-mono text-[12px] text-ink-2">{p.codigo}</td>
              <td className="px-2 py-1.5 text-ink">{p.nome}</td>
              <td className="px-2 py-1.5 text-right font-mono text-ink-2">{p.porUnidade}</td>
              <td className="px-2 py-1.5 text-right font-mono font-medium text-ink">
                {p.total} <span className="text-[11px] font-normal text-muted">{p.unidade}</span>
              </td>
              {editavel && (
                <td className="py-1 pr-[18px] text-right">
                  <button
                    type="button"
                    aria-label={`Ajustar ${p.nome}`}
                    title="Ajustar esta peça (com motivo)"
                    onClick={() => abrir({ pecaId: p.pecaId, codigo: p.codigo, nome: p.nome, porUnidade: p.porUnidade })}
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent text-ink-3 hover:border-line hover:bg-surface hover:text-accent"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.5 12.3 2.5 13l.7-3L11.3 2.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-subtle px-[18px] py-2 text-[12px] text-ink-3">
        <span>
          {pecas.length} {pecas.length === 1 ? "tipo de peça" : "tipos de peça"} · <span className="font-mono">{totalUnidades}</span> unidades para × {quantidadeProjeto}
        </span>
        {editavel && (
          <button type="button" onClick={() => abrir({ pecaId: null, codigo: "", nome: "", porUnidade: 0 })} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-accent hover:underline">
            + Incluir peça
          </button>
        )}
      </div>

      {edicao && (
        <Dialog open onOpenChange={(o) => !o && setEdicao(null)}>
          <DialogContent
            title={edicao.codigo ? `Ajustar ${edicao.codigo}` : "Incluir peça no projeto"}
            description={depoisDaAta ? "A ata já foi fechada: o ajuste gera nova versão da OS e avisa a área." : "Ajuste só deste projeto neste evento. Fica no histórico com seu nome e o motivo."}
            width={460}
          >
            <div className="flex flex-col gap-3.5">
              {!edicao.codigo && (
                <div>
                  <label className="text-[13px] font-medium text-ink">Peça do catálogo</label>
                  <ComboBox
                    className="mt-1.5"
                    value={edicao.pecaId}
                    onChange={(id) => {
                      const p = opcoesPecas.find((x) => x.id === id);
                      if (p) setEdicao({ pecaId: p.id, codigo: "", nome: p.nome, porUnidade: 0 });
                    }}
                    placeholder="Buscar por código ou nome"
                    opcoes={opcoesPecas.filter((p) => !naLista.has(p.id)).map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo }))}
                  />
                </div>
              )}
              {edicao.codigo && <p className="m-0 text-[13px] text-ink-2">{edicao.nome}</p>}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="qtd-peca" className="text-[13px] font-medium text-ink">
                    Por unidade do projeto
                  </label>
                  <input id="qtd-peca" type="number" min={0} value={qtd} onChange={(e) => setQtd(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${campo} mt-1.5 block h-10 w-[110px] font-mono`} />
                </div>
                <p className="m-0 pb-2 text-[12.5px] text-muted">
                  × {quantidadeProjeto} = <span className="font-mono text-ink">{qtd * quantidadeProjeto}</span>
                  {edicao.codigo ? ` (era ${edicao.porUnidade * quantidadeProjeto})` : ""}
                  {qtd === 0 && edicao.codigo ? " · retira a peça" : ""}
                </p>
              </div>
              <div>
                <label htmlFor="motivo-peca" className="text-[13px] font-medium text-ink">
                  Motivo <span className="font-normal text-danger">obrigatório</span>
                </label>
                <textarea id="motivo-peca" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: só 2 tramos disponíveis; o cliente pediu vão menor" className={`${campo} mt-1.5 block min-h-[72px] w-full resize-y py-2`} />
              </div>
              {erro && <p className="m-0 text-[12.5px] text-danger">{erro}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEdicao(null)} disabled={pendente}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={salvar} loading={pendente}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
