"use client";

import type { Dispatch, SetStateAction } from "react";
import { Stepper } from "@/components/ui/stepper";
import { listasDaArea } from "@/domain/itens-por-area";
import { novaChave } from "./utilidades";
import type { ItemNovo, Referencia } from "./tipos";

/**
 * Lista de materiais da área (como na ata): os itens já aparecem com 0; mudar o número inclui o item
 * na solicitação, voltar a 0 tira. Item com 0 não é enviado. Outros itens: pela busca, à parte.
 * O cavalete do cocho não se escolhe aqui: vem sozinho, 2 por cocho.
 */
export function ItensDaArea({ areaNome, pecas, itens, setItens }: { areaNome: string | null; pecas: Referencia[]; itens: ItemNovo[]; setItens: Dispatch<SetStateAction<ItemNovo[]>> }) {
  const listas = listasDaArea(areaNome)
    .map((l) => ({ ...l, pecas: l.codigos.map((c) => pecas.find((p) => p.codigo === c)).filter((p): p is Referencia => Boolean(p)) }))
    .filter((l) => l.pecas.length > 0);
  if (!listas.length) return null;
  const qtdDe = (pecaId: string) => itens.filter((i) => i.operacao === "ADICIONAR" && i.pecaId === pecaId).reduce((a, i) => a + i.quantidade, 0);
  const definir = (p: Referencia, v: number) =>
    setItens((l) => {
      const existentes = l.filter((i) => i.operacao === "ADICIONAR" && i.pecaId === p.id);
      if (v <= 0) return l.filter((i) => !existentes.includes(i));
      if (existentes.length) return l.flatMap((i) => (i === existentes[0] ? [{ ...i, quantidade: v }] : existentes.includes(i) ? [] : [i]));
      return [
        ...l,
        { chave: novaChave(), operacao: "ADICIONAR", projetoId: null, pecaId: p.id, eventoItemId: null, descricaoLivre: null, quantidade: v, quantidadeAtual: null, destino: "", justificativa: "", descricoes: [], locais: [], semDescricao: true, ajustes: {}, rotulo: `${p.codigo} · ${p.nome}`, meta: "lista da área" },
      ];
    });

  return (
    <section aria-label={`Itens de ${areaNome}`} className="rounded-cartao border border-line bg-surface">
      <header className="border-b border-line-soft px-cartao py-3">
        <h2 className="m-0 text-corpo font-semibold text-ink">Itens da {areaNome}</h2>
        <p className="m-0 mt-0.5 text-pequeno text-muted">A lista da ata já vem aqui, zerada: coloque só a quantidade do que vai. Outros itens, peça pela busca abaixo.</p>
      </header>
      <div className="grid gap-x-6 px-cartao py-2 md:grid-cols-2">
        {listas.map((l) => (
          <div key={l.titulo} className="py-1.5">
            <h3 className="m-0 mb-1 text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">{l.titulo}</h3>
            <ul className="m-0 list-none p-0">
              {l.pecas.map((p) => {
                const q = qtdDe(p.id);
                const automatico = p.codigo === "CAV-COCHO";
                return (
                  <li key={p.id} className="flex items-center gap-3 border-b border-line-faint py-1.5 last:border-b-0">
                    <span className="min-w-0 flex-1 text-pequeno text-ink">{p.nome}</span>
                    {automatico ? (
                      <span className="text-rotulo text-muted">
                        <span className="numero font-medium text-ink">{q}</span> · 2 por cocho, automático
                      </span>
                    ) : (
                      <Stepper tamanho="sm" valor={q} min={0} onChange={(v) => definir(p, v)} label={`Quantidade de ${p.nome}`} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
