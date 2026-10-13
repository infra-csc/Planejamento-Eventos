"use client";

import { useState } from "react";
import { descricaoDaUnidade } from "@/domain/unidades-tenda";

const UNIDADES_POR_PAGINA = 10;

export function DetalhesUnidadesTenda({
  quantidade,
  descricoes,
  pecas,
  unidadeInicial = 1,
  destino,
}: {
  quantidade: number;
  descricoes: string[] | null;
  pecas: Array<{ pecaId: string; codigo: string; nome: string; unidade: string; porUnidade: number }>;
  unidadeInicial?: number;
  destino: string | null;
}) {
  const quantidadeValida = Number.isSafeInteger(quantidade) && quantidade > 0 ? quantidade : 0;
  const [selecionada, setUnidade] = useState(() => Number.isSafeInteger(unidadeInicial) ? unidadeInicial : 1);
  const unidade = Math.min(Math.max(1, selecionada), Math.max(1, quantidadeValida));
  const totalPaginas = Math.max(1, Math.ceil(quantidadeValida / UNIDADES_POR_PAGINA));
  const pagina = Math.floor((unidade - 1) / UNIDADES_POR_PAGINA);
  const inicio = pagina * UNIDADES_POR_PAGINA + 1;
  const fim = Math.min(inicio + UNIDADES_POR_PAGINA - 1, quantidadeValida);
  const descricao = descricaoDaUnidade(descricoes, unidade);

  return (
    <section aria-label="Detalhes das unidades de tenda" className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-pequeno font-semibold uppercase tracking-wide text-muted">Unidades desta linha</p>
          <h2 className="m-0 mt-1 text-subtitulo font-semibold text-ink">
            Tenda <span className="numero">{unidade}</span> <span className="text-pequeno font-normal text-ink-2">de {quantidadeValida}</span>
          </h2>
        </div>
        <p className="m-0 max-w-full break-words rounded-md bg-subtle px-3 py-2 text-pequeno text-ink-2">
          Local: <span className="font-medium text-ink">{destino ?? "não informado"}</span>
        </p>
      </div>

      {quantidadeValida > 0 ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-rotulo font-medium text-ink-2">Escolha uma tenda</p>
            {totalPaginas > 1 && (
              <span className="text-rotulo text-muted">
                Página {pagina + 1} de {totalPaginas}
              </span>
            )}
          </div>
          <div role="group" aria-label="Selecionar unidade de tenda" className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {Array.from({ length: fim - inicio + 1 }, (_, indice) => inicio + indice).map((numero) => (
              <button
                key={numero}
                type="button"
                aria-pressed={unidade === numero}
                aria-label={`Selecionar Tenda ${numero}`}
                onClick={() => setUnidade(numero)}
                className={`min-h-10 min-w-0 rounded-md border px-1 text-pequeno font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  unidade === numero
                    ? "border-accent bg-selected text-accent"
                    : "border-line-control bg-surface text-ink-2 hover:border-accent hover:text-accent"
                }`}
              >
                {numero}
              </button>
            ))}
          </div>
          {totalPaginas > 1 && (
            <nav aria-label="Paginação das tendas" className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setUnidade(Math.max(1, inicio - 1))}
                disabled={pagina === 0}
                className="min-h-10 rounded-md px-2 text-rotulo font-medium text-accent hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted"
              >
                Tendas anteriores
              </button>
              <span className="text-rotulo text-muted">{inicio}–{fim}</span>
              <button
                type="button"
                onClick={() => setUnidade(Math.min(quantidadeValida, fim + 1))}
                disabled={pagina === totalPaginas - 1}
                className="min-h-10 rounded-md px-2 text-rotulo font-medium text-accent hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted"
              >
                Próximas tendas
              </button>
            </nav>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-subtle p-3 text-pequeno text-ink-2">Quantidade de tendas indisponível.</p>
      )}

      <div className="mt-5 border-t border-line-row pt-4">
        <h3 className="m-0 text-pequeno font-semibold text-ink">Descrição da unidade</h3>
        <p className="m-0 mt-1 whitespace-pre-line break-words text-corpo text-ink-2">
          {descricao === null ? (descricoes === null ? "Descrição restrita" : "Sem descrição") : descricao}
        </p>
      </div>

      <div className="mt-5 border-t border-line-row pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="m-0 text-pequeno font-semibold text-ink">Peças nesta tenda</h3>
          <span className="text-rotulo text-muted">quantidade efetiva por unidade</span>
        </div>
        {pecas.length > 0 ? (
          <ul className="m-0 mt-2 list-none divide-y divide-line-row p-0">
            {pecas.map((peca) => (
              <li key={peca.pecaId} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 break-words text-pequeno text-ink">
                  <span className="mr-2 text-muted">{peca.codigo}</span>
                  {peca.nome}
                </span>
                <span className="shrink-0 text-pequeno font-medium text-ink">
                  <span className="numero">{peca.porUnidade}</span> {peca.unidade}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-2 text-pequeno text-muted">Nenhuma peça informada para esta composição.</p>
        )}
        <p className="m-0 mt-3 rounded-md bg-subtle p-3 text-pequeno leading-relaxed text-ink-2">
          As tendas desta linha compartilham a mesma composição de peças. Alterações continuam sendo feitas na tabela da linha e valem para o grupo todo.
        </p>
      </div>
    </section>
  );
}
