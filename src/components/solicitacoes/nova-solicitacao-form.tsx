"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { hora } from "@/lib/format";
import { salvarSolicitacaoCompletaAction } from "@/app/(app)/solicitacoes/actions";
import type { ItemOperacao } from "@/server/db/schema";

export type EventoOpcao = { id: string; codigo: string; nome: string; cliente: string; periodo: string; marco: string; tipo: "PRE_REUNIAO" | "ALTERACAO"; aceita: boolean };
export type ItemNovo = {
  chave: string;
  operacao: ItemOperacao;
  projetoId: string | null;
  pecaId: string | null;
  eventoItemId: string | null;
  descricaoLivre: string | null;
  quantidade: number;
  quantidadeAtual: number | null;
  destino: string;
  justificativa: string;
  rotulo: string;
  meta: string;
};
type Referencia = { id: string; codigo: string; nome: string; meta: string };
type LinhaAta = { id: string; nome: string; quantidade: number; destino: string | null; areaNome: string | null };
type Modo = "projeto" | "peca" | "avulso" | "ata";

const campo = "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none";
let seq = 0;
const novaChave = () => `n${Date.now()}-${seq++}`;

function Passo({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line-soft px-[18px] py-3.5">
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-dark font-mono text-[11.5px] text-accent-light">{n}</span>
        <div>
          <h2 className="m-0 text-[14px] font-semibold">{titulo}</h2>
          {sub && <p className="mb-0 mt-0.5 text-[12.5px] text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function NovaSolicitacaoForm({
  rascunho,
  eventos,
  eventoInicial,
  itensIniciais,
  projetos,
  pecas,
  linhasPorEvento,
  slaHoras,
}: {
  rascunho: { id: string; codigo: string; titulo: string; observacao: string; eventoId: string; devolvidaMotivo: string | null } | null;
  eventos: EventoOpcao[];
  eventoInicial: string | null;
  itensIniciais: ItemNovo[];
  projetos: Referencia[];
  pecas: Referencia[];
  linhasPorEvento: Record<string, LinhaAta[]>;
  slaHoras: number;
}) {
  const router = useRouter();
  const [eventoId, setEventoId] = useState<string | null>(eventoInicial);
  const [itens, setItens] = useState<ItemNovo[]>(itensIniciais);
  const [modo, setModo] = useState<Modo>("projeto");
  const [busca, setBusca] = useState("");
  const [avulso, setAvulso] = useState("");
  const [erroAvulso, setErroAvulso] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(rascunho?.titulo ?? "");
  const [observacao, setObservacao] = useState(rascunho?.observacao ?? "");
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const evento = eventos.find((e) => e.id === eventoId) ?? null;
  const ehAlteracao = evento?.tipo === "ALTERACAO";
  const linhas = useMemo(() => (eventoId ? (linhasPorEvento[eventoId] ?? []) : []), [eventoId, linhasPorEvento]);

  /*
   * Rascunho salvo automaticamente (briefing, slide 7: "a área digita aos poucos, sem perder o que já
   * preencheu"). Todos os salvamentos passam por uma fila para que o primeiro crie o rascunho e os
   * seguintes (automáticos ou pelo botão) reutilizem o mesmo id, sem duplicar.
   */
  const rascunhoIdRef = useRef<string | null>(rascunho?.id ?? null);
  const [codigoRascunho, setCodigoRascunho] = useState<string | null>(rascunho?.codigo ?? null);
  const [estadoSalvo, setEstadoSalvo] = useState<{ tipo: "ocioso" } | { tipo: "salvando" } | { tipo: "salvo"; em: Date } | { tipo: "erro"; msg: string }>({ tipo: "ocioso" });
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const enviandoRef = useRef(false);
  const pendenteSalvarRef = useRef(false);
  const emFila = <T,>(fn: () => Promise<T>): Promise<T> => {
    const promessa = fila.current.then(fn, fn);
    fila.current = promessa.catch(() => undefined);
    return promessa;
  };
  const montarPayload = (enviar: boolean, evId: string) => ({
    id: rascunhoIdRef.current,
    eventoId: evId,
    titulo,
    observacao,
    enviar,
    itens: itens.map((i) => ({
      operacao: i.operacao,
      projetoId: i.projetoId,
      pecaId: i.pecaId,
      eventoItemId: i.eventoItemId,
      descricaoLivre: i.descricaoLivre,
      quantidadeSolicitada: i.quantidade,
      destino: i.destino,
      justificativa: i.justificativa,
    })),
  });
  const lembrarRascunho = (id: string, codigo: string) => {
    if (rascunhoIdRef.current) return;
    rascunhoIdRef.current = id;
    setCodigoRascunho(codigo);
    window.history.replaceState(null, "", `/solicitacoes/nova?rascunho=${id}`);
  };
  const assinatura = JSON.stringify([eventoId, titulo, observacao, itens.map((i) => [i.operacao, i.projetoId, i.pecaId, i.eventoItemId, i.descricaoLivre, i.quantidade, i.destino, i.justificativa])]);
  const salvoRef = useRef(rascunho ? assinatura : "");
  const podeAutosalvar = Boolean(evento?.aceita) && (titulo.trim() !== "" || itens.length > 0);

  useEffect(() => {
    if (!podeAutosalvar || !eventoId || assinatura === salvoRef.current || enviandoRef.current) return;
    pendenteSalvarRef.current = true;
    const t = setTimeout(async () => {
      if (enviandoRef.current) return;
      setEstadoSalvo({ tipo: "salvando" });
      const r = await emFila(() => salvarSolicitacaoCompletaAction(montarPayload(false, eventoId)));
      if (r.ok && r.dados) {
        salvoRef.current = assinatura;
        pendenteSalvarRef.current = false;
        lembrarRascunho(r.dados.id, r.dados.codigo);
        setEstadoSalvo({ tipo: "salvo", em: new Date() });
      } else if (!r.ok) {
        setEstadoSalvo({ tipo: "erro", msg: r.campos ? (Object.values(r.campos)[0] ?? r.erro) : r.erro });
      }
    }, 1500);
    return () => clearTimeout(t);
    // montarPayload/emFila/lembrarRascunho mudam a cada render; a assinatura já representa o conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, podeAutosalvar, eventoId]);

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (pendenteSalvarRef.current && !enviandoRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  const escolherEvento = (e: EventoOpcao) => {
    if (rascunhoIdRef.current && e.id !== eventoId) {
      toast("Para trocar de evento, exclua este rascunho e crie outro");
      return;
    }
    setEventoId(e.id);
    if (e.tipo === "PRE_REUNIAO") {
      setItens((l) => l.filter((i) => i.operacao === "ADICIONAR"));
      if (modo === "ata") setModo("projeto");
    } else {
      setItens((l) => l.filter((i) => i.operacao === "ADICIONAR" || (linhasPorEvento[e.id] ?? []).some((x) => x.id === i.eventoItemId)));
    }
  };

  const adicionarRef = (tipo: "projeto" | "peca", r: Referencia) => {
    setItens((l) => {
      const chaveRef = tipo === "projeto" ? "projetoId" : "pecaId";
      const existente = l.find((i) => i.operacao === "ADICIONAR" && i[chaveRef] === r.id);
      if (existente) return l.map((i) => (i === existente ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [
        ...l,
        {
          chave: novaChave(),
          operacao: "ADICIONAR",
          projetoId: tipo === "projeto" ? r.id : null,
          pecaId: tipo === "peca" ? r.id : null,
          eventoItemId: null,
          descricaoLivre: null,
          quantidade: 1,
          quantidadeAtual: null,
          destino: "",
          justificativa: "",
          rotulo: tipo === "projeto" ? r.nome : `${r.codigo} · ${r.nome}`,
          meta: tipo === "projeto" ? `${r.codigo} · projeto padrão` : "peça do catálogo",
        },
      ];
    });
  };

  const adicionarAvulso = () => {
    const d = avulso.trim();
    if (!d) {
      setErroAvulso("Descreva o item antes de adicionar.");
      return;
    }
    setErroAvulso(null);
    setAvulso("");
    setItens((l) => [...l, { chave: novaChave(), operacao: "ADICIONAR", projetoId: null, pecaId: null, eventoItemId: null, descricaoLivre: d, quantidade: 1, quantidadeAtual: null, destino: "", justificativa: "", rotulo: d, meta: "item avulso" }]);
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
        rotulo: l.nome,
        meta: operacao === "REMOVER" ? "remover da ata" : `hoje ${l.quantidade} na ata`,
      },
    ]);
  };

  const mudar = (chave: string, patch: Partial<ItemNovo>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtra = <T extends { codigo?: string; nome: string }>(xs: T[]) => (t ? xs.filter((x) => `${x.codigo ?? ""} ${x.nome}`.toLowerCase().includes(t)) : xs);
    if (modo === "projeto") return filtra(projetos).slice(0, 8);
    if (modo === "peca") return filtra(pecas).slice(0, 8);
    return [];
  }, [busca, modo, projetos, pecas]);
  const linhasFiltradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? linhas.filter((l) => l.nome.toLowerCase().includes(t)) : linhas;
  }, [busca, linhas]);

  const validarTitulo = (v: string) => setErroTitulo(v.trim() ? null : "Dê um título para a logística identificar a solicitação na fila.");

  const salvar = (enviar: boolean) => {
    setErroGeral(null);
    if (!eventoId) {
      setErroGeral("Escolha o evento.");
      return;
    }
    if (enviar) {
      setTentouEnviar(true);
      validarTitulo(titulo);
      if (!titulo.trim() || itens.length === 0) return;
    }
    iniciar(async () => {
      if (enviar) enviandoRef.current = true;
      const r = await emFila(() => salvarSolicitacaoCompletaAction(montarPayload(enviar, eventoId)));
      if (!r.ok || !r.dados?.enviada) enviandoRef.current = false;
      if (!r.ok) {
        if (r.campos?.titulo) setErroTitulo(r.campos.titulo);
        setErroGeral(r.campos ? Object.entries(r.campos).filter(([k]) => k !== "titulo").map(([, v]) => v)[0] ?? r.erro : r.erro);
        return;
      }
      const d = r.dados!;
      salvoRef.current = assinatura;
      pendenteSalvarRef.current = false;
      lembrarRascunho(d.id, d.codigo);
      if (d.enviada) {
        toast(`${d.codigo} enviada para a logística`);
        router.push(`/solicitacoes/${d.id}`);
      } else if (d.erroEnvio) {
        toast(`${d.codigo} salva como rascunho — ${d.erroEnvio}`);
        router.push(`/solicitacoes/${d.id}`);
      } else {
        toast(`Rascunho ${d.codigo} salvo`);
        setEstadoSalvo({ tipo: "salvo", em: new Date() });
      }
    });
  };

  const abas: Array<[Modo, string]> = [["projeto", "Projeto padrão"], ["peca", "Peça do catálogo"], ["avulso", "Item avulso"], ...(ehAlteracao ? ([["ata", "Alterar linha da ata"]] as Array<[Modo, string]>) : [])];
  const faltaTudo = tentouEnviar && (itens.length === 0 || !titulo.trim());

  return (
    <div className="flex flex-col gap-4">
      {rascunho?.devolvidaMotivo && (
        <Aviso tom="warning" titulo="Devolvida pela logística">
          {rascunho.devolvidaMotivo}. Corrija e reenvie.
        </Aviso>
      )}

      <Passo n={1} titulo="Evento" sub="Só aparecem eventos em preparação ou abertos a alterações.">
        {eventos.length === 0 ? (
          <p className="m-0 px-[18px] py-8 text-center text-[13px] text-muted">Nenhum evento aceitando solicitações agora.</p>
        ) : (
          <div role="radiogroup" aria-label="Evento" className="flex flex-col gap-2 p-3.5">
            {eventos.map((e) => {
              const sel = e.id === eventoId;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  disabled={!e.aceita && !sel}
                  onClick={() => escolherEvento(e)}
                  className={cn("flex w-full cursor-pointer items-center gap-3 rounded-[9px] border px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60", sel ? "border-accent-border bg-selected" : "border-line bg-surface hover:bg-subtle")}
                >
                  <span aria-hidden className={cn("block size-4 shrink-0 rounded-full", sel ? "border-4 border-accent" : "border border-line-strong")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{e.nome}</span>
                    <span className="block text-[12px] text-muted">
                      <span className="font-mono">{e.codigo}</span> · {e.cliente} · <span className="font-mono">{e.periodo}</span> · {e.marco}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-[5px] px-2 py-0.5 text-[11px] font-medium", e.tipo === "PRE_REUNIAO" ? "bg-accent-bg text-accent" : "bg-warning-bg text-warning")}>
                    {e.tipo === "PRE_REUNIAO" ? "necessidade pré-reunião" : "alteração pós-ata"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Passo>

      <Passo n={2} titulo="Itens" sub={ehAlteracao ? "Adicione itens novos ou peça mudança em uma linha que já está na ata." : "Projetos padrão, peças do catálogo ou itens avulsos."}>
        {itens.length === 0 ? (
          <div className={cn("mx-3.5 mt-3.5 rounded-[9px] border border-dashed px-4 py-6 text-center", tentouEnviar ? "border-danger-input" : "border-line-strong")}>
            <p className="m-0 text-[13px] font-medium text-ink">Nenhum item ainda</p>
            <p className="mb-0 mt-1 text-[12.5px] text-muted">Busque abaixo e use “Adicionar”. Cada item recebe resposta separada da logística.</p>
          </div>
        ) : (
          <div className="border-b border-line-soft">
            {itens.map((i) => (
              <div key={i.chave} className="flex items-center gap-3 border-b border-line-row px-[18px] py-2.5 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{i.rotulo}</span>
                  <span className="block text-[11.5px] text-muted">{i.meta}</span>
                </span>
                <input
                  aria-label={`Destino de ${i.rotulo}`}
                  value={i.destino}
                  onChange={(e) => mudar(i.chave, { destino: e.target.value })}
                  placeholder="Destino"
                  maxLength={60}
                  className="h-8 w-[130px] rounded-[7px] border border-line-strong bg-surface px-2.5 text-[12.5px] focus:border-accent focus:outline-none"
                />
                {i.operacao === "REMOVER" ? (
                  <span className="w-[112px] text-center text-[12px] font-medium text-danger">remover da ata</span>
                ) : (
                  <span className="flex w-[112px] items-center">
                    <button type="button" aria-label="Diminuir" onClick={() => mudar(i.chave, { quantidade: Math.max(i.operacao === "ALTERAR_QUANTIDADE" ? 0 : 1, i.quantidade - 1) })} className="h-8 w-8 cursor-pointer rounded-l-[7px] border border-line-strong bg-subtle text-[14px] text-ink-2 hover:bg-control">
                      −
                    </button>
                    <input
                      type="number"
                      aria-label={`Quantidade de ${i.rotulo}`}
                      min={i.operacao === "ALTERAR_QUANTIDADE" ? 0 : 1}
                      value={i.quantidade}
                      onChange={(e) => mudar(i.chave, { quantidade: Math.max(0, Number(e.target.value) || 0) })}
                      className="h-8 w-12 border-y border-line-strong bg-surface text-center font-mono text-[13px] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button type="button" aria-label="Aumentar" onClick={() => mudar(i.chave, { quantidade: i.quantidade + 1 })} className="h-8 w-8 cursor-pointer rounded-r-[7px] border border-line-strong bg-subtle text-[14px] text-ink-2 hover:bg-control">
                      +
                    </button>
                  </span>
                )}
                <button type="button" onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-ink-3 hover:text-danger">
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-3.5">
          <div className="mb-2.5 flex flex-wrap gap-1 border-b border-line">
            {abas.map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModo(m);
                  setBusca("");
                }}
                aria-pressed={modo === m}
                className={cn("-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-2.5 py-2 text-[13px]", modo === m ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>

          {modo === "avulso" ? (
            <div>
              <div className="flex gap-2">
                <input
                  aria-label="Descrição do item avulso"
                  value={avulso}
                  onChange={(e) => setAvulso(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarAvulso();
                    }
                  }}
                  placeholder="Ex.: Fechamento lateral de tenda 10×10"
                  maxLength={160}
                  aria-invalid={Boolean(erroAvulso)}
                  className={cn(campo, "aria-[invalid=true]:border-danger-input")}
                />
                <Button variant="secondary" size="md" onClick={adicionarAvulso} disabled={!evento}>
                  Adicionar
                </Button>
              </div>
              {erroAvulso && <p className="mb-0 mt-1.5 text-[12px] text-danger">{erroAvulso}</p>}
              <p className="mb-0 mt-2 text-[12px] text-muted">Item avulso não soma peças na OS; a logística separa manualmente.</p>
            </div>
          ) : (
            <>
              <input aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={modo === "projeto" ? "Buscar projeto por nome ou código" : modo === "peca" ? "Buscar peça por código ou nome" : "Buscar linha da ata"} className={campo} />
              <div className="mt-2 max-h-[300px] overflow-y-auto">
                {modo !== "ata" &&
                  resultados.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 border-b border-line-faint px-1 py-2 last:border-b-0">
                      <span className="w-[92px] shrink-0 font-mono text-[12px] text-ink-2">{r.codigo}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{r.nome}</span>
                        <span className="block text-[11.5px] text-muted">{r.meta}</span>
                      </span>
                      <Button variant="secondary" size="xs" disabled={!evento} onClick={() => adicionarRef(modo as "projeto" | "peca", r)}>
                        Adicionar
                      </Button>
                    </div>
                  ))}
                {modo === "ata" &&
                  linhasFiltradas.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 border-b border-line-faint px-1 py-2 last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{l.nome}</span>
                        <span className="block text-[11.5px] text-muted">{[`${l.quantidade} na ata`, l.destino, l.areaNome].filter(Boolean).join(" · ")}</span>
                      </span>
                      <Button variant="secondary" size="xs" onClick={() => adicionarLinha(l, "ALTERAR_QUANTIDADE")}>
                        Alterar quantidade
                      </Button>
                      <Button variant="secondary" size="xs" className="text-danger" onClick={() => adicionarLinha(l, "REMOVER")}>
                        Remover
                      </Button>
                    </div>
                  ))}
                {((modo !== "ata" && resultados.length === 0) || (modo === "ata" && linhasFiltradas.length === 0)) && (
                  <p className="m-0 py-4 text-center text-[12.5px] text-muted">{modo === "ata" && linhas.length === 0 ? "A ata deste evento não tem linhas." : `Nada encontrado${busca ? ` para “${busca}”` : ""}.`}</p>
                )}
              </div>
              {!evento && <p className="mb-0 mt-2 text-[12px] text-muted">Escolha o evento para adicionar itens.</p>}
            </>
          )}
        </div>
      </Passo>

      <Passo n={3} titulo="Contexto">
        <div className="flex flex-col gap-3.5 p-[18px]">
          <div>
            <label htmlFor="titulo" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Título <span className="font-normal text-muted">obrigatório</span>
            </label>
            <input
              id="titulo"
              value={titulo}
              maxLength={120}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (erroTitulo && e.target.value.trim()) setErroTitulo(null);
              }}
              onBlur={(e) => validarTitulo(e.target.value)}
              placeholder="Ex.: Estrutura do palco principal"
              aria-invalid={Boolean(erroTitulo)}
              aria-describedby={erroTitulo ? "erro-titulo" : undefined}
              className={cn(campo, "h-10 aria-[invalid=true]:border-danger-input")}
            />
            {erroTitulo && (
              <p id="erro-titulo" className="mb-0 mt-[5px] text-[12px] text-danger">
                {erroTitulo}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="observacao" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Observação <span className="font-normal text-muted">opcional</span>
            </label>
            <textarea id="observacao" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} placeholder="Contexto que ajuda a logística a responder." className="min-h-[88px] w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] focus:border-accent focus:outline-none" />
          </div>
        </div>
      </Passo>

      {faltaTudo && <Aviso tom="warning">Falta preencher antes de enviar — ao menos um item e o título.</Aviso>}
      {erroGeral && <Aviso tom="danger">{erroGeral}</Aviso>}

      <div className="flex items-center gap-2.5">
        <Button variant="primary" size="lg" loading={pendente} onClick={() => salvar(true)} disabled={!evento?.aceita}>
          Enviar solicitação
        </Button>
        <Button variant="secondary" size="lg" disabled={pendente || !evento} onClick={() => salvar(false)}>
          Salvar rascunho
        </Button>
        <span className="text-[12.5px] text-muted">{!evento ? "" : ehAlteracao ? `Prazo de resposta: ${slaHoras}h após o envio.` : "Envios encerram quando a reunião começa."}</span>
        <span className="ml-auto text-right text-[12px]" aria-live="polite" style={{ color: estadoSalvo.tipo === "erro" ? "#a8400f" : "#6f6366" }}>
          {estadoSalvo.tipo === "salvando"
            ? "salvando rascunho…"
            : estadoSalvo.tipo === "salvo"
              ? `Rascunho ${codigoRascunho ?? ""} salvo às ${hora(estadoSalvo.em)}`
              : estadoSalvo.tipo === "erro"
                ? `Rascunho não salvo: ${estadoSalvo.msg}`
                : evento?.aceita
                  ? "O rascunho é salvo automaticamente enquanto você preenche."
                  : ""}
        </span>
      </div>
    </div>
  );
}
