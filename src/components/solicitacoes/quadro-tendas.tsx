"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { dividirPorUnidade, previaTendas, type KitTenda, type LocalTenda } from "@/domain/tendas";

export type ItemTenda = { quantidade: number; destino: string; ajustes: Record<string, number>; descricoes: string[] };

/**
 * Quadro "Tendas 5×5 por local", no formato da planilha da cenografia: uma linha por local com a
 * quantidade de tendas, os fechamentos e as calhas daquele local. Ao confirmar, vira um item por
 * local (projeto da tenda, destino = local, fechamentos e calhas como ajuste por unidade). Se o
 * total do local não divide igual entre as tendas, o local vira 2 ou 3 itens com a divisão
 * mais próxima — a soma sempre bate com o que foi digitado.
 */
export function QuadroTendas({
  nome,
  kit,
  bom,
  pecaFechamentoId,
  pecaCalhaId,
  onConfirmar,
  onCancelar,
}: {
  nome: string;
  kit: KitTenda;
  bom: ReadonlyArray<{ codigo: string; quantidade: number }>;
  /** Peça de fechamento/calha do kit no catálogo (null: não cadastrada, a coluna some). */
  pecaFechamentoId: string | null;
  pecaCalhaId: string | null;
  onConfirmar: (itens: ItemTenda[]) => void;
  onCancelar: () => void;
}) {
  const [locais, setLocais] = useState<LocalTenda[]>([{ local: "", quantidade: 1, fechamentos: 0, calhas: 0 }]);
  const [erro, setErro] = useState<string | null>(null);
  const temFechamento = Boolean(pecaFechamentoId);
  const temCalha = Boolean(pecaCalhaId);
  const mudar = (n: number, patch: Partial<LocalTenda>) => setLocais((l) => l.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const previa = previaTendas(kit, bom, locais).filter((p) => (p.papel === "fechamento" ? temFechamento : p.papel === "calha" ? temCalha : true));
  const tendas = locais.reduce((a, l) => a + l.quantidade, 0);

  const confirmar = () => {
    const validos = locais.filter((l) => l.quantidade > 0);
    if (validos.some((l) => !l.local.trim())) {
      setErro("Diga o local de cada linha (ex.: Depósito, GV, Dispersão).");
      return;
    }
    if (validos.length === 0) {
      setErro("Informe ao menos uma tenda.");
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
    <div className="mt-2 rounded-cartao border border-accent-border bg-selected/50 p-3">
      <p className="m-0 text-pequeno font-medium text-ink">
        {nome}: tendas {kit.tamanho} por local
      </p>
      <p className="mb-2 mt-0.5 text-rotulo text-muted">Como na planilha: quantas tendas em cada local e quantos fechamentos{temCalha ? " e calhas" : ""} no total daquele local.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-pequeno">
          <thead>
            <tr className="text-left text-rotulo text-muted">
              <th className="py-1 pr-2 font-medium">Local</th>
              <th className="py-1 pr-2 font-medium">Tendas</th>
              {temFechamento && <th className="py-1 pr-2 font-medium">Fechamentos</th>}
              {temCalha && <th className="py-1 pr-2 font-medium">Calhas</th>}
              <th className="py-1" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {locais.map((l, n) => (
              <tr key={n} className="border-t border-line-faint">
                <td className="py-1 pr-2">
                  <Input aria-label={`Local da linha ${n + 1}`} value={l.local} maxLength={60} onChange={(e) => mudar(n, { local: e.target.value })} placeholder="Ex.: Depósito" className="min-w-[120px]" />
                </td>
                <td className="py-1 pr-2">
                  <Stepper tamanho="sm" valor={l.quantidade} min={0} onChange={(v) => mudar(n, { quantidade: v })} label={`Tendas em ${l.local || `linha ${n + 1}`}`} />
                </td>
                {temFechamento && (
                  <td className="py-1 pr-2">
                    <Stepper tamanho="sm" valor={l.fechamentos} min={0} onChange={(v) => mudar(n, { fechamentos: v })} label={`Fechamentos em ${l.local || `linha ${n + 1}`}`} />
                  </td>
                )}
                {temCalha && (
                  <td className="py-1 pr-2">
                    <Stepper tamanho="sm" valor={l.calhas} min={0} onChange={(v) => mudar(n, { calhas: v })} label={`Calhas em ${l.local || `linha ${n + 1}`}`} />
                  </td>
                )}
                <td className="py-1 text-right">
                  {locais.length > 1 && (
                    <Button variant="link" size="xs" onClick={() => setLocais((ls) => ls.filter((_, i) => i !== n))} aria-label={`Tirar a linha ${n + 1}`}>
                      Tirar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="link" size="xs" onClick={() => setLocais((ls) => [...ls, { local: "", quantidade: 1, fechamentos: 0, calhas: 0 }])}>
        + local
      </Button>
      <div className="mt-2 rounded-controle border border-line bg-surface px-2.5 py-2">
        <p className="m-0 text-rotulo text-muted">
          Total: <span className="font-mono text-ink">{tendas}</span> {tendas === 1 ? "tenda" : "tendas"}
        </p>
        <p className="m-0 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-rotulo text-ink-2">
          {previa.map((p) => (
            <span key={p.papel}>
              {p.rotulo} <span className="font-mono text-ink">{p.total}</span>
            </span>
          ))}
        </p>
      </div>
      {erro && <p className="mb-0 mt-1.5 text-pequeno text-danger">{erro}</p>}
      <div className="mt-2.5 flex gap-2">
        <Button variant="primary" size="xs" onClick={confirmar}>
          Adicionar tendas
        </Button>
        <Button variant="secondary" size="xs" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
