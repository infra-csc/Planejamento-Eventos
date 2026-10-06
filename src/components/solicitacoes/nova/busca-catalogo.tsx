"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";
import { TabsControladas } from "@/components/ui/tabs-nav";
import { Stepper } from "@/components/ui/stepper";
import { Field, Input } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { toastSucesso } from "@/components/ui/toast";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { combinaBusca } from "@/lib/busca";
import { cn } from "@/lib/cn";
import { Passo } from "./passo";
import { irPara, kitDe, novaChave, POR_PAGINA } from "./utilidades";
import type { PedidoAnterior } from "@/domain/ja-pedido";
import { AcoesReferencia } from "./aviso-ja-pedido";
import type { ItemNovo, LinhaAta, Modo, Referencia } from "./tipos";

/** Passo do catálogo: abas por tipo de item, busca no catálogo (projetos e peças), item descrito à mão e linhas da ata. */
export function BuscaCatalogo({
  modo,
  setModo,
  ehAlteracao,
  projetos,
  pecas,
  linhas,
  jaPedidos = {},
  itens,
  setItens,
  setTendaAberta,
  n,
  temListaDaArea = false,
}: {
  /** Número do passo (vem depois da lista da área, quando ela existe). */
  n: number;
  /** A área tem lista da ata: aqui ficam só os outros itens. */
  temListaDaArea?: boolean;
  modo: Modo;
  setModo: (m: Modo) => void;
  ehAlteracao: boolean;
  projetos: Referencia[];
  pecas: Referencia[];
  linhas: LinhaAta[];
  /** Já pedido neste evento, por id de projeto/peça (aviso informativo no cartão). */
  jaPedidos?: Record<string, PedidoAnterior[]>;
  itens: ItemNovo[];
  setItens: Dispatch<SetStateAction<ItemNovo[]>>;
  setTendaAberta: (id: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [avulso, setAvulso] = useState("");
  const [erroAvulso, setErroAvulso] = useState<string | null>(null);

  // Quantidade escolhida no próprio cartão de resultado, antes de "Adicionar" (padrão 1).
  const [qtdNova, setQtdNova] = useState<Record<string, number>>({});
  const mudarQtdNova = (id: string, v: number) => setQtdNova((m) => ({ ...m, [id]: Math.max(1, Math.floor(v)) }));
  const adicionarRef = (tipo: "projeto" | "peca", r: Referencia, qtd = 1) => {
    const chaveRef = tipo === "projeto" ? "projetoId" : "pecaId";
    const existente = itens.find((i) => i.operacao === "ADICIONAR" && i[chaveRef] === r.id);
    const chave = existente?.chave ?? novaChave();
    setQtdNova((m) => ({ ...m, [r.id]: 1 }));
    setItens((l) => {
      if (l.some((i) => i.chave === chave)) return l.map((i) => (i.chave === chave ? { ...i, quantidade: i.quantidade + qtd } : i));
      return [
        ...l,
        {
          chave,
          operacao: "ADICIONAR",
          projetoId: tipo === "projeto" ? r.id : null,
          pecaId: tipo === "peca" ? r.id : null,
          eventoItemId: null,
          descricaoLivre: null,
          quantidade: qtd,
          quantidadeAtual: null,
          destino: "",
          justificativa: "",
          descricoes: [],
          locais: [],
          ajustes: {},
          rotulo: tipo === "projeto" ? r.nome : `${r.codigo} · ${r.nome}`,
          meta: tipo === "projeto" ? `${r.codigo} · projeto padrão` : "peça do catálogo",
        },
      ];
    });
    toastSucesso(`${r.nome} × ${qtd} ${existente ? "somado ao item" : "adicionado"}`, { acao: { rotulo: "Descrever", onClick: () => irPara(`item-${chave}`) } });
  };

  const adicionarAvulso = () => {
    const d = avulso.trim();
    if (!d) {
      setErroAvulso("Descreva o item antes de adicionar.");
      return;
    }
    const chave = novaChave();
    setErroAvulso(null);
    setAvulso("");
    setItens((l) => [...l, { chave, operacao: "ADICIONAR", projetoId: null, pecaId: null, eventoItemId: null, descricaoLivre: d, quantidade: 1, quantidadeAtual: null, destino: "", justificativa: "", descricoes: [], locais: [], ajustes: {}, rotulo: d, meta: "fora do catálogo" }]);
    toastSucesso(`${d} adicionado`, { acao: { rotulo: "Descrever", onClick: () => irPara(`item-${chave}`) } });
  };

  const adicionarLinha = (l: LinhaAta, operacao: "ALTERAR_QUANTIDADE" | "REMOVER") => {
    setItens((lista) => [
      ...lista.filter((i) => i.eventoItemId !== l.id),
      {
        chave: novaChave(),
        operacao,
        projetoId: null,
        pecaId: null,
        eventoItemId: l.id,
        descricaoLivre: null,
        quantidade: operacao === "REMOVER" ? 0 : l.quantidade + 1,
        quantidadeAtual: l.quantidade,
        destino: l.destino ?? "",
        justificativa: "",
        descricoes: [],
        locais: [],
        ajustes: {},
        rotulo: l.nome,
        meta: operacao === "REMOVER" ? "remover da ata" : `hoje ${l.quantidade} na ata`,
      },
    ]);
    toastSucesso(operacao === "REMOVER" ? `${l.nome}: pedido para remover da ata` : `${l.nome}: pedido de nova quantidade`);
  };

  // Quanto de cada referência já está na lista (selo "na lista" no cartão de resultado).
  const naLista = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens) {
      if (i.operacao !== "ADICIONAR") continue;
      const id = i.projetoId ?? i.pecaId;
      if (id) m.set(id, (m.get(id) ?? 0) + i.quantidade);
    }
    return m;
  }, [itens]);

  const resultados = useMemo(() => {
    // Lista completa (sem corte) e busca sem acento: "po" acha "Pórtico" e "Posto".
    const filtra = <T extends { codigo?: string; nome: string; categoria?: string | null; familia?: string | null }>(xs: T[]) =>
      busca.trim() ? xs.filter((x) => combinaBusca(`${x.codigo ?? ""} ${x.nome} ${x.categoria ?? ""} ${x.familia ?? ""}`, busca)) : xs;
    if (modo === "projeto") return filtra(projetos);
    if (modo === "peca") return filtra(pecas);
    return [];
  }, [busca, modo, projetos, pecas]);
  const [limite, setLimite] = useState(POR_PAGINA);
  const visiveis = resultados.slice(0, limite);
  const restantes = resultados.length - visiveis.length;
  const linhasFiltradas = useMemo(() => {
    return busca.trim() ? linhas.filter((l) => combinaBusca(l.nome, busca)) : linhas;
  }, [busca, linhas]);

  const abas: Array<[Modo, string, number | null]> = [
    ["projeto", "Projeto padrão", projetos.length],
    ["peca", "Peça do catálogo", pecas.length],
    ["avulso", "Outro item", null],
    ...(ehAlteracao ? ([["ata", "Linha da ata", linhas.length]] as Array<[Modo, string, number | null]>) : []),
  ];

  return (
    <Passo
      n={n}
      titulo={temListaDaArea ? "Outros itens" : "Adicione o que precisa"}
      feito={itens.length > 0}
      sub={
        ehAlteracao
          ? "Itens novos do catálogo, outro item descrito à mão ou mudança numa linha que já está na ata."
          : temListaDaArea
            ? "O que não está na lista da sua área: projetos padrão, peças do catálogo ou um item descrito à mão."
            : "Projetos padrão, peças do catálogo ou outro item descrito à mão."
      }
    >
      <div className="px-cartao pb-4 pt-3">
        <TabsControladas
          compacta
          rotulo="Tipo de item"
          abas={abas.map(([chave, label, n]) => ({ chave, label, n }))}
          valor={modo}
          onChange={(m) => {
            setModo(m);
            setBusca("");
            setLimite(POR_PAGINA);
          }}
        />

        {modo === "avulso" ? (
          <div className="flex flex-col gap-3">
            <Field label="Descreva o item" htmlFor="busca-itens" error={erroAvulso} hint="Um item descrito à mão não soma peças na OS automaticamente: a logística vincula ao catálogo ou separa manualmente.">
              <div className="flex gap-2">
                <Input
                  id="busca-itens"
                  value={avulso}
                  onChange={(e) => {
                    setAvulso(e.target.value);
                    if (erroAvulso && e.target.value.trim()) setErroAvulso(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarAvulso();
                    }
                  }}
                  placeholder="Ex.: Fechamento lateral de tenda 10×10"
                  maxLength={160}
                  aria-invalid={Boolean(erroAvulso) || undefined}
                />
                <Button variant="secondary" size="md" onClick={adicionarAvulso}>
                  <Icone nome="mais" />
                  Adicionar
                </Button>
              </div>
            </Field>
          </div>
        ) : (
          <>
            <div className="relative">
              <Icone nome="busca" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input
                id="busca-itens"
                type="search"
                aria-label={modo === "projeto" ? "Buscar projeto padrão" : modo === "peca" ? "Buscar peça do catálogo" : "Buscar linha da ata"}
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setLimite(POR_PAGINA);
                }}
                placeholder={modo === "projeto" ? "Buscar projeto por nome ou código" : modo === "peca" ? "Buscar peça por código ou nome" : "Buscar linha da ata"}
                className="pl-9"
              />
            </div>
            <p className="mb-2 mt-2 text-pequeno text-muted" aria-live="polite">
              <Numero valor={modo === "ata" ? linhasFiltradas.length : resultados.length} />{" "}
              {modo === "projeto"
                ? resultados.length === 1
                  ? "projeto"
                  : "projetos"
                : modo === "peca"
                  ? resultados.length === 1
                    ? "peça"
                    : "peças"
                  : linhasFiltradas.length === 1
                    ? "linha"
                    : "linhas"}
              {busca.trim() ? ` para “${busca.trim()}”` : modo === "ata" ? " na ata" : " no catálogo"}
            </p>

            {modo !== "ata" && visiveis.length > 0 && (
              <ul className="m-0 list-none divide-y divide-line-row overflow-hidden rounded-cartao border border-line p-0">
                {visiveis.map((r) => {
                  const kit = modo === "projeto" ? kitDe(r) : null;
                  const jaNaLista = naLista.get(r.id) ?? 0;
                  const adicionar = () => adicionarRef(modo as "projeto" | "peca", r, qtdNova[r.id] ?? 1);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        // Linha de resultado: o que importa é o nome; código e categoria vêm baixo; ações à direita.
                        "flex flex-wrap items-center gap-x-3 gap-y-2 border-l-2 px-3 py-2.5 transition-colors duration-150 sm:flex-nowrap",
                        jaNaLista > 0 ? "border-success bg-success-bg/30" : "border-transparent hover:bg-subtle",
                      )}
                    >
                      {modo === "projeto" &&
                        (r.capaId ? (
                          <ImagemZoom src={`/api/anexos/${r.capaId}`} alt={r.nome} className="h-10 w-14 shrink-0 overflow-hidden rounded-controle border border-line max-sm:hidden" />
                        ) : (
                          <span aria-hidden className="grid h-10 w-14 shrink-0 place-items-center rounded-controle bg-subtle text-meta max-sm:hidden">
                            <Icone nome="camadas" className="size-4" />
                          </span>
                        ))}
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="m-0 flex min-w-0 items-baseline gap-2">
                          <span className="truncate text-corpo font-medium text-ink" title={r.descricao ? `${r.nome} — ${r.descricao}` : r.nome}>
                            {r.nome}
                          </span>
                          {jaNaLista > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-rotulo font-medium text-success">
                              <Icone nome="check" className="size-3" />
                              <Numero valor={jaNaLista} /> na lista
                            </span>
                          )}
                        </p>
                        <p className="mb-0 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-rotulo text-muted">
                          <span className="min-w-0 truncate">
                            <Codigo className="text-ink-3">{r.codigo}</Codigo>
                            {r.meta ? ` · ${r.meta}` : ""}
                          </span>
                          {/* Descrição inteira e lista de peças ficam em "Ver peças"; o já pedido, no selo ao lado. */}
                          <AcoesReferencia
                            referencia={{ nome: r.nome, codigo: r.codigo, meta: r.meta, descricao: r.descricao, capaId: r.capaId, bom: modo === "projeto" ? r.bom : undefined }}
                            pedidos={jaPedidos[r.id]}
                            quantidade={qtdNova[r.id] ?? 1}
                          />
                        </p>
                      </div>
                      {kit ? (
                        <Button variant="secondary" size="sm" className="ml-auto shrink-0" onClick={() => setTendaAberta(r.id)} aria-label={`${jaNaLista ? "Editar" : "Pedir"} ${r.nome} por local`}>
                          {jaNaLista ? "Editar tendas" : "Pedir por local"}
                        </Button>
                      ) : (
                        <span
                          className="ml-auto flex shrink-0 items-center gap-2"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                              e.preventDefault();
                              adicionar();
                            }
                          }}
                        >
                          <Stepper tamanho="sm" valor={qtdNova[r.id] ?? 1} min={1} onChange={(v) => mudarQtdNova(r.id, v)} label={`Quantidade de ${r.nome}`} />
                          <Button variant={jaNaLista > 0 ? "ghost" : "secondary"} size="sm" onClick={adicionar} aria-label={`Adicionar ${r.nome}`}>
                            <Icone nome="mais" />
                            {jaNaLista > 0 ? "Somar" : "Adicionar"}
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {modo !== "ata" && restantes > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setLimite((n) => n + POR_PAGINA)} className="mt-2 w-full">
                Mostrar mais <span className="numero text-muted">({restantes})</span>
              </Button>
            )}

            {modo === "ata" && linhasFiltradas.length > 0 && (
              <ul className="m-0 list-none overflow-hidden rounded-cartao border border-line p-0">
                {linhasFiltradas.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-row px-3 py-2.5 last:border-b-0">
                    <span className="min-w-[160px] flex-1">
                      <span className="line-clamp-2 break-words text-corpo text-ink" title={l.nome}>
                        {l.nome}
                      </span>
                      <span className="block text-pequeno text-muted">
                        <Numero valor={l.quantidade} /> na ata
                        {[l.destino, l.areaNome].filter(Boolean).map((x) => ` · ${x}`)}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => adicionarLinha(l, "ALTERAR_QUANTIDADE")}>
                        Mudar quantidade
                      </Button>
                      <Button variant="dangerOutline" size="sm" onClick={() => adicionarLinha(l, "REMOVER")}>
                        Remover da ata
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {((modo !== "ata" && resultados.length === 0) || (modo === "ata" && linhasFiltradas.length === 0)) && (
              <div className="rounded-cartao border border-dashed border-line-strong">
                <EmptyState
                  compact
                  title={modo === "ata" && linhas.length === 0 ? "A ata deste evento não tem linhas" : `Nada encontrado${busca.trim() ? ` para “${busca.trim()}”` : ""}`}
                  description={modo === "ata" && linhas.length === 0 ? undefined : "Confira o código ou tente outra palavra. Não achou? Use “Outro item” e descreva."}
                  action={
                    modo !== "ata" ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setModo("avulso");
                          setAvulso(busca.trim());
                          setBusca("");
                        }}
                      >
                        Descrever como outro item
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </Passo>
  );
}
