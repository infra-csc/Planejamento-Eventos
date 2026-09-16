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

const campo = "h-9 w-full rounded-lg border border-line-control bg-surface px-3 text-[13.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none";
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
  areas,
  areaInicial,
  eventoInicial,
  itensIniciais,
  projetos,
  pecas,
  linhasPorEvento,
  slaHoras,
}: {
  rascunho: { id: string; codigo: string; titulo: string; observacao: string; eventoId: string; devolvidaMotivo: string | null } | null;
  eventos: EventoOpcao[];
  /** Só para o Administrador, que pede em nome de uma área. `null` para os demais perfis. */
  areas: Array<{ id: string; nome: string }> | null;
  areaInicial: string | null;
  eventoInicial: string | null;
  itensIniciais: ItemNovo[];
  projetos: Referencia[];
  pecas: Referencia[];
  linhasPorEvento: Record<string, LinhaAta[]>;
  slaHoras: number;
}) {
  const router = useRouter();
  const [eventoId, setEventoId] = useState<string | null>(eventoInicial);
  const [areaId, setAreaId] = useState<string | null>(areaInicial);
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
    areaId: areas ? areaId : null,
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
  const podeAutosalvar = Boolean(evento?.aceita) && (!areas || Boolean(areaId)) && (titulo.trim() !== "" || itens.length > 0);

  const autosalvar = async (assin: string, evId: string) => {
    if (enviandoRef.current || assin === salvoRef.current) return;
    setEstadoSalvo({ tipo: "salvando" });
    try {
      const r = await emFila(() => salvarSolicitacaoCompletaAction(montarPayload(false, evId)));
      if (r.ok && r.dados) {
        salvoRef.current = assin;
        pendenteSalvarRef.current = false;
        lembrarRascunho(r.dados.id, r.dados.codigo);
        setEstadoSalvo({ tipo: "salvo", em: new Date() });
      } else if (!r.ok) {
        setEstadoSalvo({ tipo: "erro", msg: r.campos ? (Object.values(r.campos)[0] ?? r.erro) : r.erro });
      }
    } catch {
      setEstadoSalvo({ tipo: "erro", msg: "sem conexão com o servidor. Tentaremos de novo na próxima alteração." });
    }
  };
  /* Guarda a versão mais recente para salvar ao sair da página (link da sidebar cancela o debounce). */
  const flushRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    flushRef.current = podeAutosalvar && eventoId ? () => void autosalvar(assinatura, eventoId) : null;
  });

  useEffect(() => {
    if (!podeAutosalvar || !eventoId || assinatura === salvoRef.current || enviandoRef.current) return;
    pendenteSalvarRef.current = true;
    const t = setTimeout(() => void autosalvar(assinatura, eventoId), 1500);
    return () => clearTimeout(t);
    // autosalvar/montarPayload mudam a cada render; a assinatura já representa o conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, podeAutosalvar, eventoId]);

  useEffect(() => {
    const aoOcultar = () => {
      if (document.visibilityState === "hidden") flushRef.current?.();
    };
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      document.removeEventListener("visibilitychange", aoOcultar);
      // Navegação interna (sidebar, busca): salva o que ainda não foi salvo antes de desmontar.
      if (!enviandoRef.current) flushRef.current?.();
    };
  }, []);

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
    const mantidos = itens.filter((i) => i.operacao === "ADICIONAR" || (e.tipo === "ALTERACAO" && (linhasPorEvento[e.id] ?? []).some((x) => x.id === i.eventoItemId)));
    const descartados = itens.length - mantidos.length;
    if (descartados > 0 && !window.confirm(`${descartados} ${descartados === 1 ? "item referencia" : "itens referenciam"} a ata do evento anterior e ${descartados === 1 ? "será removido" : "serão removidos"}. Trocar de evento mesmo assim?`)) return;
    setEventoId(e.id);
    setItens(mantidos);
    if (e.tipo === "PRE_REUNIAO" && modo === "ata") setModo("projeto");
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
    if (areas && !areaId) {
      setErroGeral("Escolha a área que está pedindo.");
      return;
    }
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
      let r: Awaited<ReturnType<typeof salvarSolicitacaoCompletaAction>>;
      try {
        r = await emFila(() => salvarSolicitacaoCompletaAction(montarPayload(enviar, eventoId)));
      } catch {
        enviandoRef.current = false;
        setErroGeral("Não foi possível falar com o servidor. O que você preencheu continua aqui — tente de novo.");
        return;
      }
      if (!r.ok || !r.dados?.enviada) enviandoRef.current = false;
      if (!r.ok) {
        if (r.campos?.titulo) setErroTitulo(r.campos.titulo);
        setErroGeral(r.campos ? (Object.entries(r.campos).filter(([k]) => k !== "titulo").map(([, v]) => v)[0] ?? r.erro) : r.erro);
        return;
      }
      const d = r.dados;
      if (!d) return;
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

  const abas: Array<[Modo, string]> = [["projeto", "Projeto padrão"], ["peca", "Peça do catálogo"], ["avulso", "Outro item (descrever)"], ...(ehAlteracao ? ([["ata", "Alterar linha da ata"]] as Array<[Modo, string]>) : [])];
  const faltaTudo = tentouEnviar && (itens.length === 0 || !titulo.trim());

  return (
    <div className="flex flex-col gap-4">
      {rascunho?.devolvidaMotivo && (
        <Aviso tom="warning" titulo="Devolvida pela logística">
          {rascunho.devolvidaMotivo}. Corrija e reenvie.
        </Aviso>
      )}

      <Passo n={1} titulo="Evento" sub="Só aparecem eventos em preparação ou abertos a alterações.">
        {areas && (
          <div className="border-b border-line-soft px-[18px] py-3.5">
            <label htmlFor="area-solicitante" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Área solicitante <span className="font-normal text-muted">você está pedindo como administrador</span>
            </label>
            <select
              id="area-solicitante"
              value={areaId ?? ""}
              disabled={Boolean(rascunho)}
              onChange={(e) => setAreaId(e.target.value || null)}
              aria-invalid={tentouEnviar && !areaId}
              className={cn(campo, "max-w-[320px] aria-[invalid=true]:border-danger-input disabled:bg-subtle disabled:text-ink-3")}
            >
              <option value="">Selecione a área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        {eventos.length === 0 ? (
          <div className="px-[18px] py-8 text-center">
            <p className="m-0 text-[13px] font-medium text-ink">Nenhum evento aceitando solicitações agora.</p>
            <p className="mb-0 mt-1 text-[12.5px] text-muted">
              Solicitações entram enquanto o evento está em preparação (antes da reunião) ou depois que a ata é fechada. Fale com a logística se o seu evento não aparece.
            </p>
          </div>
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
                    {e.tipo === "PRE_REUNIAO" ? "aceita pedidos até a reunião" : "ata fechada · aceita alterações"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Passo>

      <Passo n={2} titulo="Itens" sub={!evento ? "Escolha o evento acima para liberar a lista." : ehAlteracao ? "Adicione itens novos ou peça mudança em uma linha que já está na ata." : "Projetos padrão, peças do catálogo ou outro item descrito à mão."}>
        {itens.length === 0 ? (
          <div className={cn("mx-3.5 mt-3.5 rounded-[9px] border border-dashed px-4 py-6 text-center", tentouEnviar ? "border-danger-input" : "border-line-strong")}>
            <p className="m-0 text-[13px] font-medium text-ink">Nenhum item ainda</p>
            <p className="mb-0 mt-1 text-[12.5px] text-muted">Busque abaixo e use “Adicionar”. Cada item recebe resposta separada da logística.</p>
          </div>
        ) : (
          <div className="border-b border-line-soft">
            {itens.map((i) => (
              <div key={i.chave} className="flex flex-wrap items-center gap-3 border-b border-line-row px-[18px] py-2.5 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{i.rotulo}</span>
                  <span className="block text-[11.5px] text-muted">{i.meta}</span>
                </span>
                <input
                  aria-label={`Destino de ${i.rotulo}`}
                  value={i.destino}
                  onChange={(e) => mudar(i.chave, { destino: e.target.value })}
                  placeholder="Onde vai ficar"
                  maxLength={60}
                  className="h-8 w-[130px] rounded-[7px] border border-line-control bg-surface px-2.5 text-[12.5px] focus:border-accent focus:outline-none"
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
                      className="h-8 w-12 border-y border-line-control bg-surface text-center font-mono text-[13px] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
              <p className="mb-0 mt-2 text-[12px] text-muted">Um item descrito à mão não soma peças na OS automaticamente; a logística separa manualmente.</p>
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
            <textarea id="observacao" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} placeholder="Contexto que ajuda a logística a responder." className="min-h-[88px] w-full resize-y rounded-lg border border-line-control bg-surface px-3 py-2.5 text-[13.5px] focus:border-accent focus:outline-none" />
          </div>
        </div>
      </Passo>

      {faltaTudo && (
        <Aviso tom="warning">
          {itens.length === 0 && !titulo.trim() ? "Para enviar, adicione ao menos um item e dê um título." : itens.length === 0 ? "Para enviar, adicione ao menos um item." : "Para enviar, dê um título à solicitação."}
        </Aviso>
      )}
      {erroGeral && <Aviso tom="danger">{erroGeral}</Aviso>}

      <div className="flex items-center gap-2.5">
        <Button variant="primary" size="lg" loading={pendente} onClick={() => salvar(true)} disabled={!evento?.aceita}>
          Enviar solicitação
        </Button>
        <Button variant="secondary" size="lg" disabled={pendente || !evento} onClick={() => salvar(false)}>
          Salvar rascunho
        </Button>
        <span className="text-[12.5px] text-muted">{!evento ? "" : ehAlteracao ? `Prazo de resposta: ${slaHoras}h após o envio.` : "Envios encerram quando a reunião começa."}</span>
        <span className={cn("ml-auto text-right text-[12px]", estadoSalvo.tipo === "erro" ? "text-danger" : "text-meta")} aria-live="polite">
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
