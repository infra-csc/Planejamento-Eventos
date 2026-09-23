"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Aviso, EmptyState } from "@/components/ui/layout";
import { Badge, Tag } from "@/components/ui/badge";
import { TabsControladas } from "@/components/ui/tabs-nav";
import { Stepper } from "@/components/ui/stepper";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { hora } from "@/lib/format";
import { salvarSolicitacaoCompletaAction } from "@/app/(app)/solicitacoes/actions";
import type { ItemOperacao } from "@/server/db/schema";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { combinaBusca } from "@/lib/busca";
import type { ActionResult } from "@/lib/action";
import { ajustarDescricoes, descricoesEsperadas, faltamDescricoes, MAX_DESCRICOES_POR_UNIDADE, TAMANHO_DESCRICAO } from "@/domain/descricoes-itens";
import { kitDaTenda } from "@/domain/tendas";
import { QuadroTendas, type ItemTenda } from "./quadro-tendas";

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
  /** Uma descrição por unidade adicionada (10 pedidas, 10 descrições); acima do limite, uma só. */
  descricoes: string[];
  /** Projeto: delta por peça (pecaId → unidades a mais ou a menos). */
  ajustes: Record<string, number>;
  rotulo: string;
  meta: string;
};
export type LinhaBom = { pecaId: string; codigo: string; nome: string; unidade: string; quantidade: number };
/** `extras`: peças fora do padrão que o projeto aceita como ajuste (fechamento e calha de tenda, quantidade 0). */
type Referencia = { id: string; codigo: string; nome: string; meta: string; bom?: LinhaBom[]; extras?: LinhaBom[]; capaId?: string | null };
type LinhaAta = { id: string; nome: string; quantidade: number; destino: string | null; areaNome: string | null };
type Modo = "projeto" | "peca" | "avulso" | "ata";

let seq = 0;
const novaChave = () => `n${Date.now()}-${seq++}`;
/** Resultados de busca exibidos por vez: o catálogo inteiro (imagem + stepper por linha) pesa no celular. */
const POR_PAGINA = 50;
/** Confirmação só do lado do cliente (trocar de evento): o ConfirmDialog espera uma action. */
const confirmarLocal = async (): Promise<ActionResult> => ({ ok: true });
/** Evita ".." quando o motivo já termina em pontuação. */
const comPontoFinal = (t: string) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

function Passo({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-cartao border border-line bg-surface">
      <div className="flex items-start gap-3 rounded-t-cartao border-b border-line-soft px-cartao py-3.5">
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-controle bg-dark font-mono text-rotulo text-accent-light">{n}</span>
        <div>
          <h2 className="m-0 text-secao font-semibold">{titulo}</h2>
          {sub && <p className="mb-0 mt-0.5 text-pequeno text-muted">{sub}</p>}
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
      descricoes: ajustarDescricoes(i.descricoes, descricoesEsperadas(i.operacao, i.quantidade)),
      ajustesBom: Object.entries(i.ajustes)
        .filter(([, d]) => d !== 0)
        .map(([pecaId, quantidade]) => ({ pecaId, quantidade })),
    })),
  });
  const lembrarRascunho = (id: string, codigo: string) => {
    if (rascunhoIdRef.current) return;
    rascunhoIdRef.current = id;
    setCodigoRascunho(codigo);
    window.history.replaceState(null, "", `/solicitacoes/nova?rascunho=${id}`);
  };
  const assinatura = JSON.stringify([eventoId, titulo, observacao, itens.map((i) => [i.operacao, i.projetoId, i.pecaId, i.eventoItemId, i.descricaoLivre, i.quantidade, i.destino, i.justificativa, i.descricoes, i.ajustes])]);
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
    if (descartados > 0) {
      setTroca({ evento: e, mantidos, descartados });
      return;
    }
    aplicarTroca(e, mantidos);
  };
  const aplicarTroca = (e: EventoOpcao, mantidos: ItemNovo[]) => {
    setEventoId(e.id);
    setItens(mantidos);
    if (e.tipo === "PRE_REUNIAO" && modo === "ata") setModo("projeto");
  };
  // Troca de evento que descartaria itens da ata anterior: aguarda confirmação no diálogo.
  const [troca, setTroca] = useState<{ evento: EventoOpcao; mantidos: ItemNovo[]; descartados: number } | null>(null);

  // Quantidade escolhida na própria lista de busca, antes de "Adicionar" (padrão 1).
  const [qtdNova, setQtdNova] = useState<Record<string, number>>({});
  const mudarQtdNova = (id: string, v: number) => setQtdNova((m) => ({ ...m, [id]: Math.max(1, Math.floor(v)) }));
  const adicionarRef = (tipo: "projeto" | "peca", r: Referencia, qtd = 1) => {
    toast(`${r.nome} × ${qtd} adicionado à solicitação`);
    setQtdNova((m) => ({ ...m, [r.id]: 1 }));
    setItens((l) => {
      const chaveRef = tipo === "projeto" ? "projetoId" : "pecaId";
      const existente = l.find((i) => i.operacao === "ADICIONAR" && i[chaveRef] === r.id);
      if (existente) return l.map((i) => (i === existente ? { ...i, quantidade: i.quantidade + qtd } : i));
      return [
        ...l,
        {
          chave: novaChave(),
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
          ajustes: {},
          rotulo: tipo === "projeto" ? r.nome : `${r.codigo} · ${r.nome}`,
          meta: tipo === "projeto" ? `${r.codigo} · projeto padrão` : "peça do catálogo",
        },
      ];
    });
  };

  // Projeto de tenda: em vez do "Adicionar" simples, o quadro por local (Local | Tendas | Fechamentos | Calhas).
  const [tendaAberta, setTendaAberta] = useState<string | null>(null);
  const kitDe = (r: Referencia) => (r.bom?.length ? kitDaTenda(r.bom.map((b) => b.codigo)) : null);
  const extraDoKit = (r: Referencia, papel: "fechamento" | "calha") => {
    const codigo = kitDe(r)?.pecas[papel];
    return (codigo && [...(r.bom ?? []), ...(r.extras ?? [])].find((b) => b.codigo === codigo)?.pecaId) || null;
  };
  const adicionarTendas = (r: Referencia, novos: ItemTenda[]) => {
    setTendaAberta(null);
    const total = novos.reduce((a, x) => a + x.quantidade, 0);
    toast(`${r.nome} × ${total} adicionado à solicitação (${new Set(novos.map((x) => x.destino)).size} ${new Set(novos.map((x) => x.destino)).size === 1 ? "local" : "locais"})`);
    setItens((l) => [
      ...l,
      ...novos.map((x) => ({
        chave: novaChave(),
        operacao: "ADICIONAR" as const,
        projetoId: r.id,
        pecaId: null,
        eventoItemId: null,
        descricaoLivre: null,
        quantidade: x.quantidade,
        quantidadeAtual: null,
        destino: x.destino,
        justificativa: "",
        descricoes: x.descricoes,
        ajustes: x.ajustes,
        rotulo: r.nome,
        meta: `${r.codigo} · projeto padrão`,
      })),
    ]);
  };

  const adicionarAvulso = () => {
    const d = avulso.trim();
    if (!d) {
      setErroAvulso("Descreva o item antes de adicionar.");
      return;
    }
    setErroAvulso(null);
    setAvulso("");
    setItens((l) => [...l, { chave: novaChave(), operacao: "ADICIONAR", projetoId: null, pecaId: null, eventoItemId: null, descricaoLivre: d, quantidade: 1, quantidadeAtual: null, destino: "", justificativa: "", descricoes: [], ajustes: {}, rotulo: d, meta: "fora do catálogo" }]);
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
        ajustes: {},
        rotulo: l.nome,
        meta: operacao === "REMOVER" ? "remover da ata" : `hoje ${l.quantidade} na ata`,
      },
    ]);
  };

  const mudar = (chave: string, patch: Partial<ItemNovo>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));
  /** Remove na hora e oferece desfazer (Ctrl+Z), no mesmo padrão de "Desativar" em Usuários. */
  const removerItem = (item: ItemNovo) => {
    const posicao = itens.findIndex((x) => x.chave === item.chave);
    setItens((l) => l.filter((x) => x.chave !== item.chave));
    toast(`${item.rotulo} removido da solicitação`, {
      desfazer: () => setItens((l) => (l.some((x) => x.chave === item.chave) ? l : [...l.slice(0, posicao), item, ...l.slice(posicao)])),
    });
  };
  // Painel "Ajustar peças" aberto (um por vez).
  const [ajustando, setAjustando] = useState<string | null>(null);
  // Padrão do projeto + peças extras aceitas (tenda: fechamento e calha, padrão 0).
  const bomDe = (i: ItemNovo) => {
    const p = i.projetoId ? projetos.find((x) => x.id === i.projetoId) : undefined;
    return p ? [...(p.bom ?? []), ...(p.extras ?? [])] : [];
  };
  const capaDe = (i: ItemNovo) => (i.projetoId ? projetos.find((p) => p.id === i.projetoId)?.capaId ?? null : null);
  const resumoAjustes = (i: ItemNovo) => {
    const bom = bomDe(i);
    const partes = Object.entries(i.ajustes)
      .filter(([, d]) => d !== 0)
      .map(([pecaId, d]) => `${d > 0 ? "+" : "−"}${Math.abs(d)} ${bom.find((b) => b.pecaId === pecaId)?.nome ?? "peça"}`);
    return partes.length ? partes.join(" · ") : null;
  };

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

  const validarTitulo = (v: string) => setErroTitulo(v.trim() ? null : "Dê um título para a logística identificar a solicitação na fila.");

  const salvar = (enviar: boolean) => {
    setErroGeral(null);
    const irPara = (id: string) => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el?.focus(), 350);
    };
    if (areas && !areaId) {
      setTentouEnviar(true);
      setErroGeral("Escolha a área que está pedindo (passo 1).");
      irPara("area-solicitante");
      return;
    }
    if (!eventoId) {
      setTentouEnviar(true);
      setErroGeral("Escolha o evento no passo 1. Os itens já adicionados continuam na lista.");
      irPara("evento");
      return;
    }
    if (enviar) {
      setTentouEnviar(true);
      validarTitulo(titulo);
      if (!titulo.trim() || itens.length === 0) return;
      const semDescricao = itens.filter((i) => faltamDescricoes({ operacao: i.operacao, quantidadeSolicitada: i.quantidade, descricoes: i.descricoes }) > 0);
      if (semDescricao.length) {
        setErroGeral(semDescricao.length === 1 ? `Descreva cada unidade de “${semDescricao[0].rotulo}” antes de enviar.` : `Faltam descrições em ${semDescricao.length} itens. Descreva cada unidade antes de enviar.`);
        irPara(`descricoes-${semDescricao[0].chave}`);
        return;
      }
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

  const abas: Array<[Modo, string]> = [["projeto", "Projeto padrão"], ["peca", "Peça do catálogo"], ["avulso", "Outro item (fora do catálogo)"], ...(ehAlteracao ? ([["ata", "Alterar linha da ata"]] as Array<[Modo, string]>) : [])];
  const faltaTudo = tentouEnviar && (itens.length === 0 || !titulo.trim());

  return (
    <div className="flex flex-col gap-4">
      {rascunho?.devolvidaMotivo && (
        <Aviso tom="warning" titulo="Devolvida pela logística">
          {comPontoFinal(rascunho.devolvidaMotivo)} Corrija e reenvie.
        </Aviso>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
      <Passo n={1} titulo="Evento" sub="Só aparecem eventos em preparação ou abertos a alterações.">
        {areas && (
          <div className="border-b border-line-soft px-cartao py-3.5">
            <Label htmlFor="area-solicitante">
              Área solicitante <span className="text-muted">você está pedindo como administrador</span>
            </Label>
            <Select id="area-solicitante" value={areaId ?? ""} disabled={Boolean(rascunho)} onValueChange={(v) => setAreaId(v || null)} invalid={tentouEnviar && !areaId} placeholder="Selecione a área" className="max-w-[320px]" opcoes={areas.map((a) => ({ value: a.id, label: a.nome }))} />
          </div>
        )}
        {eventos.length === 0 ? (
          <EmptyState compact title="Nenhum evento aceitando solicitações agora" description="Solicitações entram enquanto o evento está em preparação (antes da reunião) ou depois que a ata é fechada. Fale com a logística se o seu evento não aparece." />
        ) : (
          <div className="flex flex-col gap-3 p-cartao">
            <ComboBox
              id="evento"
              value={eventoId}
              disabled={Boolean(rascunho)}
              invalid={tentouEnviar && !evento}
              placeholder="Buscar evento por nome, código ou cliente"
              onChange={(id) => {
                const e = eventos.find((x) => x.id === id);
                if (e) escolherEvento(e);
              }}
              opcoes={eventos.map((e) => ({
                value: e.id,
                label: e.nome,
                descricao: `${e.codigo} · ${e.cliente} · ${e.periodo} · ${e.marco}`,
                selo: e.tipo === "PRE_REUNIAO" ? "até a reunião" : "alterações",
                seloTom: e.tipo === "PRE_REUNIAO" ? "accent" : "warning",
                disabled: !e.aceita && e.id !== eventoId,
              }))}
            />
            {evento && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-cartao border border-accent-border bg-selected px-3.5 py-2.5 text-pequeno">
                <span className="font-medium text-ink">{evento.nome}</span>
                <span className="text-muted">
                  <span className="font-mono">{evento.codigo}</span> · {evento.cliente} · <span className="font-mono">{evento.periodo}</span> · {evento.marco}
                </span>
                <Badge tom={ehAlteracao ? "warning" : "accent"}>{ehAlteracao ? "ata fechada · aceita alterações" : "aceita pedidos até a reunião"}</Badge>
                {rascunho && <span className="text-meta">para trocar de evento, exclua este rascunho e crie outro</span>}
              </div>
            )}
          </div>
        )}
      </Passo>

      <Passo n={2} titulo="Itens" sub={!evento ? "Já pode montar a lista. Antes de enviar, escolha o evento no passo 1." : ehAlteracao ? "Adicione itens novos ou peça mudança em uma linha que já está na ata." : "Projetos padrão, peças do catálogo ou outro item descrito à mão."}>
        {itens.length === 0 ? (
          <div className={cn("mx-3.5 mt-3.5 rounded-cartao border border-dashed", tentouEnviar ? "border-danger-input" : "border-line-strong")}>
            <EmptyState compact title="Nenhum item ainda" description="Busque abaixo e use “Adicionar”. Cada item recebe resposta separada da logística." />
          </div>
        ) : (
          <div className="border-b border-line-soft">
            {itens.map((i) => (
              <div key={i.chave} className="border-b border-line-row last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-cartao py-2.5">
                {capaDe(i) && <ImagemZoom src={`/api/anexos/${capaDe(i)}`} alt={i.rotulo} className="h-9 w-12 shrink-0 overflow-hidden rounded-chip border border-line" />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words text-corpo text-ink" title={i.rotulo}>
                    {i.rotulo}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-rotulo text-muted">
                    <Tag>{i.meta}</Tag>
                    {resumoAjustes(i) && <span className="text-accent">{resumoAjustes(i)}</span>}
                  </span>
                </span>
                {i.projetoId && bomDe(i).length > 0 && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setAjustando((a) => (a === i.chave ? null : i.chave))}
                    aria-expanded={ajustando === i.chave}
                    className={cn(ajustando === i.chave && "border-accent bg-accent-bg text-accent")}
                  >
                    {ajustando === i.chave ? "Fechar peças" : "Ajustar peças"}
                  </Button>
                )}
                <Input aria-label={`Destino de ${i.rotulo}`} value={i.destino} onChange={(e) => mudar(i.chave, { destino: e.target.value })} placeholder="Onde vai ficar" maxLength={60} className="w-[130px]" />
                {i.operacao === "REMOVER" ? (
                  <span className="w-[112px] text-center text-pequeno font-medium text-danger">remover da ata</span>
                ) : (
                  <Stepper tamanho="sm" valor={i.quantidade} min={i.operacao === "ALTERAR_QUANTIDADE" ? 0 : 1} onChange={(v) => mudar(i.chave, { quantidade: v })} label={`Quantidade de ${i.rotulo}`} />
                )}
                <Button variant="link" size="xs" onClick={() => removerItem(i)} aria-label={`Remover ${i.rotulo}`}>
                  Remover
                </Button>
              </div>
              <DescricoesItem item={i} destacarVazias={tentouEnviar} onChange={(descricoes) => mudar(i.chave, { descricoes })} />
              {ajustando === i.chave && (
                <div className="border-t border-line-faint bg-subtle/60 px-cartao pb-3 pt-2.5">
                  <div className="mb-2 flex items-start gap-3">
                    {capaDe(i) && <ImagemZoom src={`/api/anexos/${capaDe(i)}`} alt={i.rotulo} className="h-[72px] w-24 shrink-0 overflow-hidden rounded-controle border border-line" />}
                    <p className="m-0 text-pequeno text-muted">
                      Peças de <span className="text-ink">{i.rotulo}</span> por unidade do projeto. Mude só o que precisa a mais ou a menos; o resto segue o padrão.
                      {capaDe(i) && <span className="block text-meta">Clique na imagem para ver o desenho em tamanho grande.</span>}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
                    {bomDe(i).map((b) => {
                      const delta = i.ajustes[b.pecaId] ?? 0;
                      const pedir = b.quantidade + delta;
                      const definir = (v: number) => mudar(i.chave, { ajustes: { ...i.ajustes, [b.pecaId]: Math.max(0, v) - b.quantidade } });
                      return (
                        <div key={b.pecaId} className="flex items-center gap-2 py-1">
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 break-words text-pequeno text-ink" title={b.nome}>
                              {b.nome}
                            </span>
                            <span className="block font-mono text-rotulo text-meta">
                              {b.codigo} · padrão {b.quantidade} {b.unidade}
                            </span>
                          </span>
                          <Stepper tamanho="sm" valor={pedir} min={0} onChange={definir} label={`Quantidade de ${b.nome}`} className={cn(delta !== 0 && "border-accent")} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}

        <div className="p-3.5">
          <TabsControladas
            compacta
            rotulo="Tipo de item"
            abas={abas.map(([chave, label]) => ({ chave, label }))}
            valor={modo}
            onChange={(m) => {
              setModo(m);
              setBusca("");
              setLimite(POR_PAGINA);
            }}
          />

          {modo === "avulso" ? (
            <div>
              <div className="flex gap-2">
                <Input
                  aria-label="Descrição do item fora do catálogo"
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
                />
                <Button variant="secondary" size="md" onClick={adicionarAvulso}>
                  Adicionar
                </Button>
              </div>
              {erroAvulso && <p className="mb-0 mt-1.5 text-pequeno text-danger">{erroAvulso}</p>}
              <p className="mb-0 mt-2 text-pequeno text-muted">Um item descrito à mão não soma peças na OS automaticamente; a logística separa manualmente.</p>
            </div>
          ) : (
            <>
              <Input aria-label="Buscar" value={busca} onChange={(e) => {
                  setBusca(e.target.value);
                  setLimite(POR_PAGINA);
                }}
                placeholder={modo === "projeto" ? "Buscar projeto por nome ou código" : modo === "peca" ? "Buscar peça por código ou nome" : "Buscar linha da ata"} />
              {modo !== "ata" && (
                <p className="mb-0 mt-2 text-pequeno text-muted">
                  {resultados.length} {modo === "projeto" ? (resultados.length === 1 ? "projeto" : "projetos") : resultados.length === 1 ? "peça" : "peças"}
                  {busca.trim() ? ` para “${busca.trim()}”` : " no catálogo"}
                </p>
              )}
              <div className="mt-1">
                {modo !== "ata" &&
                  visiveis.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-faint px-1 py-2 last:border-b-0">
                      {modo === "projeto" &&
                        (r.capaId ? (
                          <ImagemZoom src={`/api/anexos/${r.capaId}`} alt={r.nome} className="h-9 w-12 shrink-0 overflow-hidden rounded-chip border border-line" />
                        ) : (
                          <span aria-hidden className="h-9 w-12 shrink-0 rounded-chip border border-dashed border-line-strong" />
                        ))}
                      <span className="hidden w-[92px] shrink-0 font-mono text-pequeno text-ink-2 sm:block">{r.codigo}</span>
                      <span className="min-w-[140px] flex-1">
                        <span className="line-clamp-2 break-words text-corpo text-ink" title={r.nome}>
                          {r.nome}
                        </span>
                        <span className="block text-rotulo text-muted">
                          <span className="font-mono sm:hidden">{r.codigo} · </span>
                          {r.meta}
                        </span>
                      </span>
                      {modo === "projeto" && kitDe(r) ? (
                        <span className="ml-auto flex shrink-0 items-center gap-3">
                          <Button variant="secondary" size="xs" onClick={() => setTendaAberta((t) => (t === r.id ? null : r.id))} aria-expanded={tendaAberta === r.id} aria-label={`Pedir ${r.nome} por local`}>
                            {tendaAberta === r.id ? "Fechar quadro" : "Pedir por local"}
                          </Button>
                        </span>
                      ) : (
                      <span className="ml-auto flex shrink-0 items-center gap-3">
                        <span
                          className="flex items-center"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && evento && e.target instanceof HTMLInputElement) {
                              e.preventDefault();
                              adicionarRef(modo as "projeto" | "peca", r, qtdNova[r.id] ?? 1);
                            }
                          }}
                        >
                          <Stepper tamanho="sm" valor={qtdNova[r.id] ?? 1} min={1} onChange={(v) => mudarQtdNova(r.id, v)} label={`Quantidade de ${r.nome}`} />
                        </span>
                        <Button variant="secondary" size="xs" onClick={() => adicionarRef(modo as "projeto" | "peca", r, qtdNova[r.id] ?? 1)} aria-label={`Adicionar ${r.nome}`}>
                          Adicionar
                        </Button>
                      </span>
                      )}
                      {modo === "projeto" && tendaAberta === r.id && kitDe(r) && (
                        <div className="w-full">
                          <QuadroTendas
                            nome={r.nome}
                            kit={kitDe(r)!}
                            bom={r.bom ?? []}
                            pecaFechamentoId={extraDoKit(r, "fechamento")}
                            pecaCalhaId={extraDoKit(r, "calha")}
                            onConfirmar={(novos) => adicionarTendas(r, novos)}
                            onCancelar={() => setTendaAberta(null)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                {modo !== "ata" && restantes > 0 && (
                  <div className="pt-2.5">
                    <Button variant="secondary" size="sm" onClick={() => setLimite((n) => n + POR_PAGINA)} className="w-full">
                      Mostrar mais ({restantes})
                    </Button>
                  </div>
                )}
                {modo === "ata" &&
                  linhasFiltradas.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-faint px-1 py-2 last:border-b-0">
                      <span className="min-w-[140px] flex-1">
                        <span className="line-clamp-2 break-words text-corpo text-ink" title={l.nome}>
                          {l.nome}
                        </span>
                        <span className="block text-rotulo text-muted">{[`${l.quantidade} na ata`, l.destino, l.areaNome].filter(Boolean).join(" · ")}</span>
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
                  <EmptyState compact title={modo === "ata" && linhas.length === 0 ? "A ata deste evento não tem linhas" : `Nada encontrado${busca ? ` para “${busca}”` : ""}`} />
                )}
              </div>
            </>
          )}
        </div>
      </Passo>
      </div>

      {/* Coluna de envio: acompanha a rolagem, resume o pedido e fecha com título + botões. */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-topo-fixo">
      <Passo n={3} titulo="Resumo e envio" sub={evento ? `${itens.length} ${itens.length === 1 ? "item" : "itens"} para ${evento.nome}` : itens.length ? `${itens.length} ${itens.length === 1 ? "item" : "itens"} · falta escolher o evento` : "Escolha o evento e adicione itens."}>
        {itens.length > 0 && (
          <ul className="m-0 max-h-[220px] list-none overflow-y-auto border-b border-line-soft p-0">
            {itens.map((i) => (
              <li key={i.chave} className="flex items-center gap-2 border-b border-line-faint px-cartao py-2 text-pequeno last:border-b-0">
                <span className="line-clamp-2 min-w-0 flex-1 break-words text-ink" title={i.rotulo}>
                  {i.rotulo}
                </span>
                <span className="shrink-0 font-mono text-ink-2">{i.operacao === "REMOVER" ? "remover" : `× ${i.quantidade}`}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-3.5 p-cartao">
          <Field label="Título" htmlFor="titulo" obrigatorio error={erroTitulo}>
            <Input
              id="titulo"
              value={titulo}
              maxLength={120}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (erroTitulo && e.target.value.trim()) setErroTitulo(null);
              }}
              onBlur={(e) => validarTitulo(e.target.value)}
              placeholder="Ex.: Estrutura do palco principal"
            />
          </Field>
          <Field label="Observação" htmlFor="observacao" optional>
            <Textarea id="observacao" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} placeholder="Contexto que ajuda a logística a responder." />
          </Field>
        </div>
      </Passo>

      {faltaTudo && (
        <Aviso tom="warning">
          {itens.length === 0 && !titulo.trim() ? "Para enviar, adicione ao menos um item e dê um título." : itens.length === 0 ? "Para enviar, adicione ao menos um item." : "Para enviar, dê um título à solicitação."}
        </Aviso>
      )}
      {erroGeral && <Aviso tom="danger">{erroGeral}</Aviso>}

      <div className="flex flex-col gap-2.5">
        <Button variant="primary" size="lg" loading={pendente} onClick={() => salvar(true)} disabled={Boolean(evento) && !evento?.aceita} className="w-full">
          Enviar solicitação
        </Button>
        <Button variant="secondary" size="lg" disabled={pendente} onClick={() => salvar(false)} className="w-full">
          Salvar rascunho
        </Button>
        <span className="text-pequeno text-muted">{!evento ? "" : ehAlteracao ? `Prazo de resposta: ${slaHoras}h após o envio.` : "Envios encerram quando a reunião começa."}</span>
        <span className={cn("text-pequeno", estadoSalvo.tipo === "erro" ? "text-danger" : "text-meta")} aria-live="polite">
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
      </aside>
      </div>

      <ConfirmDialog
        open={troca !== null}
        onOpenChange={(o) => !o && setTroca(null)}
        title="Trocar de evento?"
        description={
          troca
            ? `${troca.descartados} ${troca.descartados === 1 ? "item referencia" : "itens referenciam"} a ata do evento anterior e ${troca.descartados === 1 ? "será removido" : "serão removidos"} da solicitação.`
            : undefined
        }
        confirmLabel="Trocar de evento"
        danger
        action={confirmarLocal}
        onSuccess={() => {
          if (troca) aplicarTroca(troca.evento, troca.mantidos);
          setTroca(null);
        }}
      />
    </div>
  );
}

/**
 * Descrição de cada unidade adicionada: 10 pedidas, 10 campos (texto, arte, medida de cada uma).
 * Acima de 50 unidades, um campo só vale para todas. Obrigatório para enviar.
 */
function DescricoesItem({ item, destacarVazias, onChange }: { item: ItemNovo; destacarVazias: boolean; onChange: (d: string[]) => void }) {
  const esperadas = descricoesEsperadas(item.operacao, item.quantidade);
  if (!esperadas) return null;
  const lista = ajustarDescricoes(item.descricoes, esperadas);
  const vazias = lista.filter((d) => !d.trim()).length;
  const unica = esperadas === 1;
  const definir = (n: number, v: string) => onChange(lista.map((d, k) => (k === n ? v : d)));
  return (
    <div id={`descricoes-${item.chave}`} tabIndex={-1} className="border-t border-line-faint px-cartao pb-3 pt-2.5 focus:outline-none">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-pequeno font-medium text-ink-2">
          {unica ? (item.quantidade > 1 ? `Descrição (vale para as ${item.quantidade} unidades)` : "Descrição") : `Descrição de cada unidade (${esperadas})`}
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        </span>
        {!unica && vazias > 0 && vazias < esperadas && <span className={cn("text-rotulo", destacarVazias ? "text-danger" : "text-muted")}>{vazias} sem descrição</span>}
        {!unica && lista[0].trim() && vazias > 0 && (
          <Button variant="link" size="xs" onClick={() => onChange(lista.map((d) => d.trim() ? d : lista[0]))}>
            Repetir a 1ª nas vazias
          </Button>
        )}
      </div>
      <div className={cn("grid gap-1.5", !unica && "sm:grid-cols-2")}>
        {lista.map((d, n) => (
          <label key={n} className="flex items-center gap-2">
            {!unica && <span className="w-6 shrink-0 text-right font-mono text-rotulo text-meta">{n + 1}</span>}
            <Input
              value={d}
              maxLength={TAMANHO_DESCRICAO}
              onChange={(e) => definir(n, e.target.value)}
              aria-label={unica ? `Descrição de ${item.rotulo}` : `Descrição da unidade ${n + 1} de ${item.rotulo}`}
              aria-invalid={destacarVazias && !d.trim() ? true : undefined}
              placeholder={unica ? "O que é, texto/arte, medida, cor…" : `Unidade ${n + 1}: texto/arte, medida, cor…`}
              className="min-w-0 flex-1"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
