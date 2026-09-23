"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Numero } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { dividirPorUnidade, previaTendas, type KitTenda, type LocalTenda } from "@/domain/tendas";

export type ItemTenda = { quantidade: number; destino: string; ajustes: Record<string, number>; descricoes: string[] };

/** Rótulo de coluna: visível acima do campo no celular (cada local vira um cartão); no desktop, só o cabeçalho. */
const rotuloCls = "mb-1 block text-rotulo text-muted sm:sr-only";

/**
 * Quadro "Tendas 5×5 por local", no formato da planilha da cenografia: uma linha por local com a
 * quantidade de tendas, os fechamentos e as calhas daquele local. Ao confirmar, vira um item por
 * local (projeto da tenda, destino = local, fechamentos e calhas como ajuste por unidade). Se o
 * total do local não divide igual entre as tendas, o local vira 2 ou 3 itens com a divisão
 * mais próxima — a soma sempre bate com o que foi digitado.
 * Vive dentro de um DialogContent (o rodapé usa DialogFooter).
 */
export function QuadroTendas({
  kit,
  bom,
  pecaFechamentoId,
  pecaCalhaId,
  onConfirmar,
  onCancelar,
}: {
  kit: KitTenda;
  bom: ReadonlyArray<{ codigo: string; quantidade: number }>;
  /** Peça de fechamento/calha do kit no catálogo (null: não cadastrada, a coluna some). */
  pecaFechamentoId: string | null;
  pecaCalhaId: string | null;
  onConfirmar: (itens: ItemTenda[]) => void;
  onCancelar: () => void;
}) {
  const [locais, setLocais] = useState<LocalTenda[]>([{ local: "", quantidade: 1, fechamentos: 0, calhas: 0 }]);
  const [erro, setErro] = useState<{ linha: number | null; msg: string } | null>(null);
  const temFechamento = Boolean(pecaFechamentoId);
  const temCalha = Boolean(pecaCalhaId);
  const mudar = (n: number, patch: Partial<LocalTenda>) => {
    setLocais((l) => l.map((x, i) => (i === n ? { ...x, ...patch } : x)));
    if (erro && (erro.linha === null || erro.linha === n)) setErro(null);
  };
  const previa = previaTendas(kit, bom, locais).filter((p) => (p.papel === "fechamento" ? temFechamento : p.papel === "calha" ? temCalha : true));
  const tendas = locais.reduce((a, l) => a + l.quantidade, 0);
  // Colunas: Local | Tendas | (Fechamentos) | (Calhas) | remover.
  // (`cn` só concatena: uma classe de grade por vez.)
  const colunas =
    temFechamento && temCalha ? "sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_36px]" : temFechamento || temCalha ? "sm:grid-cols-[minmax(0,1fr)_auto_auto_36px]" : "sm:grid-cols-[minmax(0,1fr)_auto_36px]";

  const confirmar = () => {
    const validos = locais.filter((l) => l.quantidade > 0);
    const semLocal = locais.findIndex((l) => l.quantidade > 0 && !l.local.trim());
    if (semLocal >= 0) {
      setErro({ linha: semLocal, msg: "Diga o local desta linha (ex.: Depósito, GV, Dispersão)." });
      document.getElementById(`tenda-local-${semLocal}`)?.focus();
      return;
    }
    if (validos.length === 0) {
      setErro({ linha: null, msg: "Informe ao menos uma tenda." });
      return;
    }
    const itens: ItemTenda[] = [];
    for (const l of validos) {
      const local = l.local.trim().slice(0, 60);
      for (const g of dividirPorUnidade(l.quantidade, [temFechamento ? l.fechamentos : 0, temCalha ? l.calhas : 0])) {
        const ajustes: Record<string, number> = {};
        if (pecaFechamentoId && g.porUnidade[0] > 0) ajustes[pecaFechamentoId] = g.porUnidade[0];
        if (pecaCalhaId && g.porUnidade[1] > 0) ajustes[pecaCalhaId] = g.porUnidade[1];
        itens.push({ quantidade: g.quantidade, destino: local, ajustes, descricoes: descricoesIguais(g.quantidade, `Tenda ${kit.tamanho} — ${local}`) });
      }
    }
    onConfirmar(itens);
  };

  return (
    <>
      <div className={cn("hidden gap-3 border-b border-line-soft pb-1.5 text-micro font-semibold uppercase tracking-[0.06em] text-muted sm:grid", colunas)}>
        <span>Local</span>
        <span>Tendas</span>
        {temFechamento && <span>Fechamentos</span>}
        {temCalha && <span>Calhas</span>}
        <span className="sr-only">Remover</span>
      </div>
      <ol className="m-0 list-none p-0">
        {locais.map((l, n) => {
          const nomeLinha = l.local || `linha ${n + 1}`;
          const erroLinha = erro?.linha === n;
          return (
            <li key={n} className={cn("grid grid-cols-2 items-end gap-x-3 gap-y-2 border-b border-line-row py-3 last:border-b-0 sm:py-2", colunas)}>
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <label htmlFor={`tenda-local-${n}`} className={rotuloCls}>
                  Local
                </label>
                <Input
                  id={`tenda-local-${n}`}
                  value={l.local}
                  maxLength={60}
                  onChange={(e) => mudar(n, { local: e.target.value })}
                  placeholder="Ex.: Depósito"
                  aria-label={`Local da linha ${n + 1}`}
                  aria-invalid={erroLinha || undefined}
                  aria-describedby={erroLinha ? "tenda-erro" : undefined}
                />
              </div>
              <div>
                <span className={rotuloCls}>Tendas</span>
                <Stepper tamanho="sm" valor={l.quantidade} min={0} onChange={(v) => mudar(n, { quantidade: v })} label={`Tendas em ${nomeLinha}`} />
              </div>
              {temFechamento && (
                <div>
                  <span className={rotuloCls}>Fechamentos</span>
                  <Stepper tamanho="sm" valor={l.fechamentos} min={0} onChange={(v) => mudar(n, { fechamentos: v })} label={`Fechamentos em ${nomeLinha}`} />
                </div>
              )}
              {temCalha && (
                <div>
                  <span className={rotuloCls}>Calhas</span>
                  <Stepper tamanho="sm" valor={l.calhas} min={0} onChange={(v) => mudar(n, { calhas: v })} label={`Calhas em ${nomeLinha}`} />
                </div>
              )}
              <div className="flex justify-end max-sm:col-span-2">
                {locais.length > 1 && (
                  <IconButton label={`Tirar ${nomeLinha}`} onClick={() => setLocais((ls) => ls.filter((_, i) => i !== n))}>
                    <Icone nome="lixeira" />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={() => setLocais((ls) => [...ls, { local: "", quantidade: 1, fechamentos: 0, calhas: 0 }])}>
        <Icone nome="mais" />
        Outro local
      </Button>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-controle border border-line-soft bg-subtle px-3 py-2.5 text-pequeno text-ink-2">
        <span>
          Total <Numero valor={tendas} className="font-semibold text-ink" /> {tendas === 1 ? "tenda" : "tendas"}
        </span>
        {previa.map((p) => (
          <span key={p.papel}>
            {p.rotulo} <Numero valor={p.total} className="font-medium text-ink" />
          </span>
        ))}
      </div>
      {erro && (
        <p id="tenda-erro" role="alert" className="mb-0 mt-2 flex items-start gap-1 text-pequeno text-danger">
          <Icone nome="erro" className="mt-px" />
          {erro.msg}
        </p>
      )}

      <DialogFooter>
        <Button variant="primary" size="lg" onClick={confirmar} disabled={tendas === 0} motivoDesabilitado="Informe ao menos uma tenda.">
          {tendas === 1 ? "Adicionar 1 tenda" : `Adicionar ${tendas} tendas`}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
      </DialogFooter>
    </>
  );
}
