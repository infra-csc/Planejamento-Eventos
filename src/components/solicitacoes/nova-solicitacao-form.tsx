"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Aviso, EmptyState } from "@/components/ui/layout";
import { ChipMono, Tag } from "@/components/ui/badge";
import { TabsControladas } from "@/components/ui/tabs-nav";
import { Stepper } from "@/components/ui/stepper";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { toast, toastSucesso } from "@/components/ui/toast";
import { hora } from "@/lib/format";
import { salvarSolicitacaoCompletaAction } from "@/app/(app)/solicitacoes/actions";
import type { ItemOperacao } from "@/server/db/schema";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { combinaBusca } from "@/lib/busca";
import type { ActionResult } from "@/lib/action";
import { ajustarDescricoes, descricoesEsperadas, faltamDescricoes, TAMANHO_DESCRICAO } from "@/domain/descricoes-itens";
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
/** Cartões de resultado exibidos por vez: poucos o bastante para a lista de itens (passo 3) ficar perto. */
const POR_PAGINA = 12;
/** Confirmação só do lado do cliente (trocar de evento): o ConfirmDialog espera uma action. */
const confirmarLocal = async (): Promise<ActionResult> => ({ ok: true });
/** Evita ".." quando o motivo já termina em pontuação. */
const comPontoFinal = (t: string) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
/** Leva até um campo (rolagem suave) e põe o foco nele. */
const irPara = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "center" });
  window.setTimeout(() => el.focus({ preventScroll: true }), reduzir ? 0 : 350);
};

/** Cartão de um passo: número (ou check quando concluído), título, uma linha de apoio e ações à direita. */
function Passo({ n, titulo, sub, feito, acoes, children, className }: { n: number; titulo: string; sub?: React.ReactNode; feito?: boolean; acoes?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const idTitulo = `passo-${n}`;
  return (
    <section aria-labelledby={idTitulo} className={cn("rounded-cartao border border-line bg-surface", className)}>
      <header className="flex items-start gap-3 rounded-t-cartao border-b border-line-soft px-cartao py-3.5">
        <span
          aria-hidden
          className={cn("mt-px grid size-6 shrink-0 place-items-center rounded-full text-rotulo font-semibold transition-colors duration-150", feito ? "bg-success-bg text-success" : "bg-control text-ink-2")}
        >
          {feito ? <Icone nome="check" className="size-3.5" /> : <span className="numero">{n}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="m-0 text-secao font-semibold tracking-[-0.01em]">
            {titulo}
            {feito && <span className="sr-only"> (concluído)</span>}
          </h2>
          {sub && <p className="mb-0 mt-0.5 text-pequeno text-muted">{sub}</p>}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

/** Mensagem de erro no padrão do Field (ícone + texto), para blocos que não são um campo só. */
function ErroCampo({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("m-0 flex items-start gap-1 text-pequeno text-danger", className)}>
      <Icone nome="erro" className="mt-px size-4" />
      <span>{children}</span>
    </p>
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
  const [trocandoEvento, setTrocandoEvento] = useState(false);
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
  const eventosAceitando = eventos.filter((e) => e.aceita).length;

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

  // Erro vindo do servidor: no celular o resumo fica abaixo dos passos, então rola até a mensagem.
  useEffect(() => {
    if (erroGeral) document.getElementById("erro-geral")?.scrollIntoView({ block: "nearest" });
  }, [erroGeral]);

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
    setTrocandoEvento(false);
    if (e.tipo === "PRE_REUNIAO" && modo === "ata") setModo("projeto");
  };
  // Troca de evento que descartaria itens da ata anterior: aguarda confirmação no diálogo.
  const [troca, setTroca] = useState<{ evento: EventoOpcao; mantidos: ItemNovo[]; descartados: number } | null>(null);

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
          ajustes: {},
          rotulo: tipo === "projeto" ? r.nome : `${r.codigo} · ${r.nome}`,
          meta: tipo === "projeto" ? `${r.codigo} · projeto padrão` : "peça do catálogo",
        },
      ];
    });
    toastSucesso(`${r.nome} × ${qtd} ${existente ? "somado ao item" : "adicionado"}`, { acao: { rotulo: "Descrever", onClick: () => irPara(`item-${chave}`) } });
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
    const nLocais = new Set(novos.map((x) => x.destino)).size;
    toastSucesso(`${r.nome} × ${total} adicionado (${nLocais} ${nLocais === 1 ? "local" : "locais"})`);
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
    const chave = novaChave();
    setErroAvulso(null);
    setAvulso("");
    setItens((l) => [...l, { chave, operacao: "ADICIONAR", projetoId: null, pecaId: null, eventoItemId: null, descricaoLivre: d, quantidade: 1, quantidadeAtual: null, destino: "", justificativa: "", descricoes: [], ajustes: {}, rotulo: d, meta: "fora do catálogo" }]);
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
        ajustes: {},
        rotulo: l.nome,
        meta: operacao === "REMOVER" ? "remover da ata" : `hoje ${l.quantidade} na ata`,
      },
    ]);
    toastSucesso(operacao === "REMOVER" ? `${l.nome}: pedido para remover da ata` : `${l.nome}: pedido de nova quantidade`);
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
  const capaDe = (i: ItemNovo) => (i.projetoId ? (projetos.find((p) => p.id === i.projetoId)?.capaId ?? null) : null);
  const resumoAjustes = (i: ItemNovo) => {
    const bom = bomDe(i);
    const partes = Object.entries(i.ajustes)
      .filter(([, d]) => d !== 0)
      .map(([pecaId, d]) => `${d > 0 ? "+" : "−"}${Math.abs(d)} ${bom.find((b) => b.pecaId === pecaId)?.nome ?? "peça"}`);
    return partes.length ? partes.join(" · ") : null;
  };
  /** Nome sem o código na frente (peça), para o título sugerido. */
  const nomeCurto = (i: ItemNovo) => (i.pecaId ? (pecas.find((p) => p.id === i.pecaId)?.nome ?? i.rotulo) : i.rotulo);
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

  const validarTitulo = (v: string) => setErroTitulo(v.trim() ? null : "Dê um título para a logística identificar a solicitação na fila.");

  const semDescricao = itens.filter((i) => faltamDescricoes({ operacao: i.operacao, quantidadeSolicitada: i.quantidade, descricoes: i.descricoes }) > 0);
  // Título sugerido a partir dos itens: só placeholder e um atalho "Usar sugestão"; nunca preenche sozinho.
  const sugestaoTitulo = (() => {
    const nomes = itens.map(nomeCurto);
    if (nomes.length === 0) return null;
    const texto = nomes.length === 1 ? nomes[0] : nomes.length === 2 ? `${nomes[0]} e ${nomes[1]}` : `${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2}`;
    return texto.length > 120 ? `${texto.slice(0, 119)}…` : texto;
  })();
  // O que ainda falta para enviar, na ordem da tela. Cada linha leva ao campo.
  const pendencias = [
    areas && !areaId ? { alvo: "area-solicitante", texto: "Escolher a área solicitante" } : null,
    !evento ? { alvo: "evento", texto: "Escolher o evento" } : null,
    itens.length === 0 ? { alvo: "busca-itens", texto: "Adicionar ao menos um item" } : null,
    semDescricao.length > 0 ? { alvo: `descricoes-${semDescricao[0].chave}`, texto: semDescricao.length === 1 ? "Descrever as unidades de 1 item" : `Descrever as unidades de ${semDescricao.length} itens` } : null,
    !titulo.trim() ? { alvo: "titulo", texto: "Dar um título" } : null,
  ].filter((p) => p !== null);

  const salvar = (enviar: boolean) => {
    setErroGeral(null);
    if (areas && !areaId) {
      setTentouEnviar(true);
      irPara("area-solicitante");
      return;
    }
    if (!eventoId) {
      setTentouEnviar(true);
      setTrocandoEvento(true);
      irPara("evento");
      return;
    }
    if (enviar) {
      setTentouEnviar(true);
      validarTitulo(titulo);
      if (itens.length === 0) {
        irPara("busca-itens");
        return;
      }
      if (semDescricao.length) {
        irPara(`descricoes-${semDescricao[0].chave}`);
        return;
      }
      if (!titulo.trim()) {
        irPara("titulo");
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
        setErroGeral(r.campos ? (Object.entries(r.campos).filter(([k]) => k !== "titulo").map(([, v]) => v)[0] ?? (r.campos.titulo ? null : r.erro)) : r.erro);
        if (r.campos?.titulo) irPara("titulo");
        return;
      }
      const d = r.dados;
      if (!d) return;
      salvoRef.current = assinatura;
      pendenteSalvarRef.current = false;
      lembrarRascunho(d.id, d.codigo);
      if (d.enviada) {
        toastSucesso(`${d.codigo} enviada para a logística`);
        router.push(`/solicitacoes/${d.id}`);
      } else if (d.erroEnvio) {
        toast(`${d.codigo} salva como rascunho — ${d.erroEnvio}`);
        router.push(`/solicitacoes/${d.id}`);
      } else {
        toastSucesso(`Rascunho ${d.codigo} salvo`);
        setEstadoSalvo({ tipo: "salvo", em: new Date() });
      }
    });
  };

  const abas: Array<[Modo, string, number | null]> = [
    ["projeto", "Projeto padrão", projetos.length],
    ["peca", "Peça do catálogo", pecas.length],
    ["avulso", "Outro item", null],
    ...(ehAlteracao ? ([["ata", "Linha da ata", linhas.length]] as Array<[Modo, string, number | null]>) : []),
  ];
  const mostrarSeletorEvento = !evento || trocandoEvento;
  const bloqueadoEnvio = Boolean(evento) && !evento?.aceita;
  const textoSalvo =
    estadoSalvo.tipo === "salvando"
      ? "Salvando rascunho…"
      : estadoSalvo.tipo === "salvo"
        ? `Rascunho ${codigoRascunho ?? ""} salvo às ${hora(estadoSalvo.em)}`
        : estadoSalvo.tipo === "erro"
          ? `Rascunho não salvo: ${estadoSalvo.msg}`
          : evento?.aceita
            ? "O rascunho é salvo automaticamente enquanto você preenche."
            : "";
  const tendaAtual = tendaAberta ? (projetos.find((p) => p.id === tendaAberta) ?? null) : null;
  const kitAtual = tendaAtual ? kitDe(tendaAtual) : null;

  return (
    // No celular a barra de envio fica fixa no rodapé: o respiro embaixo evita que ela cubra o fim do formulário.
    <div className="flex flex-col gap-4 max-lg:pb-24">
      {rascunho?.devolvidaMotivo && (
        <Aviso tom="warning" titulo="Devolvida pela logística">
          {comPontoFinal(rascunho.devolvidaMotivo)} Corrija e reenvie.
        </Aviso>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 1 · Evento ------------------------------------------------------------------ */}
          <Passo
            n={1}
            titulo="Evento"
            feito={Boolean(evento) && (!areas || Boolean(areaId))}
            sub={evento && !trocandoEvento ? undefined : "Só aparecem eventos em preparação ou abertos a alterações."}
            acoes={
              evento && !rascunho && eventosAceitando > 1 ? (
                trocandoEvento ? (
                  <Button variant="link" size="sm" onClick={() => setTrocandoEvento(false)}>
                    Manter este
                  </Button>
                ) : (
                  <Button variant="link" size="sm" onClick={() => setTrocandoEvento(true)}>
                    Trocar evento
                  </Button>
                )
              ) : undefined
            }
          >
            {areas && (
              <div className="border-b border-line-soft px-cartao py-3.5">
                <Field label="Área solicitante" htmlFor="area-solicitante" obrigatorio hint="Você está pedindo como administrador, em nome desta área." error={tentouEnviar && !areaId ? "Escolha a área que está pedindo." : null}>
                  <Select id="area-solicitante" value={areaId ?? ""} disabled={Boolean(rascunho)} onValueChange={(v) => setAreaId(v || null)} invalid={tentouEnviar && !areaId} placeholder="Selecione a área" className="sm:max-w-[320px]" opcoes={areas.map((a) => ({ value: a.id, label: a.nome }))} />
                </Field>
              </div>
            )}
            {eventos.length === 0 ? (
              <EmptyState compact title="Nenhum evento aceitando solicitações agora" description="Solicitações entram com o evento em preparação (antes da reunião) ou depois que a ata é fechada. Fale com a logística se o seu evento não aparece." />
            ) : (
              <div className="flex flex-col gap-3 px-cartao py-3.5">
                {mostrarSeletorEvento && (
                  <Field label="Evento" htmlFor="evento" obrigatorio error={tentouEnviar && !evento ? "Escolha o evento para enviar. Os itens já adicionados continuam na lista." : null}>
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
                        seloTom: e.tipo === "PRE_REUNIAO" ? "muted" : "warning",
                        disabled: !e.aceita && e.id !== eventoId,
                      }))}
                    />
                  </Field>
                )}
                {evento && (
                  <div className={cn("flex flex-wrap items-start gap-x-4 gap-y-2", trocandoEvento && "rounded-controle border border-line-soft bg-subtle px-3 py-2.5")}>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-corpo font-medium text-ink">
                        {evento.nome}
                        <Tag tom={ehAlteracao ? "warning" : "muted"}>{ehAlteracao ? "alteração pós-ata" : "pré-reunião"}</Tag>
                      </p>
                      <p className="mb-0 mt-0.5 text-pequeno text-muted">
                        <Codigo>{evento.codigo}</Codigo> · {evento.cliente} · <span className="numero">{evento.periodo}</span> · <span className="numero">{evento.marco}</span>
                      </p>
                    </div>
                    <p className="m-0 flex items-center gap-1.5 text-pequeno text-ink-2">
                      <Icone nome="relogio" className="text-ink-3" />
                      {ehAlteracao ? (
                        <span>
                          Resposta em até <span className="numero font-medium">{slaHoras}h</span> após o envio
                        </span>
                      ) : (
                        "Pedidos até a reunião começar"
                      )}
                    </p>
                    {rascunho && <p className="m-0 basis-full text-pequeno text-meta">Para trocar de evento, exclua este rascunho e crie outro.</p>}
                  </div>
                )}
              </div>
            )}
          </Passo>

          {/* 2 · Adicionar itens --------------------------------------------------------- */}
          <Passo
            n={2}
            titulo="Adicione o que precisa"
            feito={itens.length > 0}
            sub={ehAlteracao ? "Itens novos do catálogo, outro item descrito à mão ou mudança numa linha que já está na ata." : "Projetos padrão, peças do catálogo ou outro item descrito à mão."}
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
                    <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 2xl:grid-cols-3">
                      {visiveis.map((r) => {
                        const kit = modo === "projeto" ? kitDe(r) : null;
                        const jaNaLista = naLista.get(r.id) ?? 0;
                        const adicionar = () => adicionarRef(modo as "projeto" | "peca", r, qtdNova[r.id] ?? 1);
                        return (
                          <li key={r.id} className="flex min-w-0 flex-col rounded-cartao border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong">
                            <div className="flex min-w-0 gap-3">
                              {modo === "projeto" &&
                                (r.capaId ? (
                                  <ImagemZoom src={`/api/anexos/${r.capaId}`} alt={r.nome} className="h-12 w-16 shrink-0 overflow-hidden rounded-controle border border-line" />
                                ) : (
                                  <span aria-hidden className="grid h-12 w-16 shrink-0 place-items-center rounded-controle border border-dashed border-line-strong text-meta">
                                    <Icone nome="camadas" />
                                  </span>
                                ))}
                              <div className="min-w-0 flex-1">
                                <p className="m-0 line-clamp-2 break-words text-corpo font-medium text-ink" title={r.nome}>
                                  {r.nome}
                                </p>
                                <p className="mb-0 mt-0.5 line-clamp-2 text-pequeno text-muted">
                                  <Codigo className="text-ink-3">{r.codigo}</Codigo>
                                  {r.meta ? ` · ${r.meta}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                              {jaNaLista > 0 ? (
                                <span className="inline-flex items-center gap-1 text-pequeno font-medium text-success">
                                  <Icone nome="check" className="size-3.5" />
                                  <Numero valor={jaNaLista} /> na lista
                                </span>
                              ) : (
                                <span aria-hidden />
                              )}
                              {kit ? (
                                <Button variant="secondary" size="sm" onClick={() => setTendaAberta(r.id)} aria-label={`Pedir ${r.nome} por local`}>
                                  Pedir por local
                                </Button>
                              ) : (
                                <span
                                  className="flex items-center gap-2"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                                      e.preventDefault();
                                      adicionar();
                                    }
                                  }}
                                >
                                  <Stepper tamanho="sm" valor={qtdNova[r.id] ?? 1} min={1} onChange={(v) => mudarQtdNova(r.id, v)} label={`Quantidade de ${r.nome}`} />
                                  <Button variant="secondary" size="sm" onClick={adicionar} aria-label={`Adicionar ${r.nome}`}>
                                    Adicionar
                                  </Button>
                                </span>
                              )}
                            </div>
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

          {/* 3 · Detalhar itens ---------------------------------------------------------- */}
          <Passo
            n={3}
            titulo="Detalhe cada item"
            feito={itens.length > 0 && semDescricao.length === 0}
            sub="Quantidade, onde vai ficar e a descrição de cada unidade (texto, arte, medida)."
            acoes={itens.length > 0 ? <ChipMono tom="control">{itens.length}</ChipMono> : undefined}
          >
            {itens.length === 0 ? (
              <div className="px-cartao py-3.5">
                <div className={cn("rounded-cartao border border-dashed", tentouEnviar ? "border-danger-input" : "border-line-strong")}>
                  <EmptyState compact title="Nenhum item ainda" description="Busque no passo 2 e use “Adicionar”. Cada item recebe resposta separada da logística." />
                </div>
                {tentouEnviar && <ErroCampo className="mt-2">Adicione ao menos um item para enviar.</ErroCampo>}
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {itens.map((i) => {
                  const capa = capaDe(i);
                  const bom = bomDe(i);
                  const ajustes = resumoAjustes(i);
                  const abertoAjuste = ajustando === i.chave;
                  return (
                    <li key={i.chave} id={`item-${i.chave}`} tabIndex={-1} className="scroll-mt-24 border-b border-line-row px-cartao py-3.5 last:border-b-0 focus:outline-none">
                      <div className="flex items-start gap-3">
                        {capa ? (
                          <ImagemZoom src={`/api/anexos/${capa}`} alt={i.rotulo} className="h-12 w-16 shrink-0 overflow-hidden rounded-controle border border-line" />
                        ) : (
                          <span aria-hidden className="grid h-12 w-16 shrink-0 place-items-center rounded-controle border border-dashed border-line-strong text-meta max-sm:hidden">
                            <Icone nome={i.projetoId ? "camadas" : "caixa"} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="m-0 line-clamp-2 break-words text-corpo font-medium text-ink" title={i.rotulo}>
                            {i.rotulo}
                          </p>
                          <p className="mb-0 mt-1 flex flex-wrap items-center gap-1.5 text-pequeno text-muted">
                            <Tag tom={i.operacao === "REMOVER" ? "danger" : i.meta === "fora do catálogo" ? "warning" : "muted"}>{i.meta}</Tag>
                            {ajustes && <span className="text-ink-2">{ajustes}</span>}
                          </p>
                        </div>
                        <IconButton label={`Remover ${i.rotulo} da solicitação`} onClick={() => removerItem(i)}>
                          <Icone nome="lixeira" />
                        </IconButton>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3 sm:pl-[76px]">
                        {i.operacao === "REMOVER" ? (
                          <p className="m-0 flex items-center gap-1.5 text-pequeno font-medium text-danger">
                            <Icone nome="lixeira" className="size-3.5" />
                            Sai da ata (hoje <Numero valor={i.quantidadeAtual} />)
                          </p>
                        ) : (
                          <div>
                            <Label htmlFor={`qtd-${i.chave}`}>{i.operacao === "ALTERAR_QUANTIDADE" ? "Nova quantidade" : "Quantidade"}</Label>
                            <Stepper id={`qtd-${i.chave}`} tamanho="sm" valor={i.quantidade} min={i.operacao === "ALTERAR_QUANTIDADE" ? 0 : 1} onChange={(v) => mudar(i.chave, { quantidade: v })} />
                          </div>
                        )}
                        <div className="min-w-[160px] max-w-[280px] flex-1">
                          <Label htmlFor={`destino-${i.chave}`} optional>
                            Onde vai ficar
                          </Label>
                          <Input id={`destino-${i.chave}`} value={i.destino} onChange={(e) => mudar(i.chave, { destino: e.target.value })} placeholder="Ex.: Palco, Dispersão" maxLength={60} />
                        </div>
                        {i.projetoId && bom.length > 0 && (
                          <Button variant={abertoAjuste ? "secondary" : "ghost"} size="sm" onClick={() => setAjustando((a) => (a === i.chave ? null : i.chave))} aria-expanded={abertoAjuste} aria-controls={`ajuste-${i.chave}`}>
                            <Icone nome={abertoAjuste ? "chevron-cima" : "chevron-baixo"} />
                            {abertoAjuste ? "Fechar peças" : "Ajustar peças"}
                          </Button>
                        )}
                      </div>

                      <DescricoesItem item={i} destacarVazias={tentouEnviar} onChange={(descricoes) => mudar(i.chave, { descricoes })} />

                      {abertoAjuste && (
                        <div id={`ajuste-${i.chave}`} className="mt-3 animate-fade-up-rapido rounded-controle border border-line-soft bg-subtle px-3 pb-3 pt-2.5 sm:ml-[76px]">
                          <p className="mb-2 mt-0 text-pequeno text-muted">
                            Peças de <span className="text-ink">{i.rotulo}</span> por unidade do projeto. Mude só o que precisa a mais ou a menos; o resto segue o padrão.
                          </p>
                          <ul className="m-0 grid list-none grid-cols-1 gap-x-6 p-0 md:grid-cols-2">
                            {bom.map((b) => {
                              const delta = i.ajustes[b.pecaId] ?? 0;
                              const pedir = b.quantidade + delta;
                              const definir = (v: number) => mudar(i.chave, { ajustes: { ...i.ajustes, [b.pecaId]: Math.max(0, v) - b.quantidade } });
                              return (
                                <li key={b.pecaId} className="flex items-center gap-2 border-b border-line-faint py-2 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                                  <span className="min-w-0 flex-1">
                                    <span className="line-clamp-2 break-words text-pequeno text-ink" title={b.nome}>
                                      {b.nome}
                                    </span>
                                    <span className="block text-rotulo text-meta">
                                      <Codigo>{b.codigo}</Codigo> · padrão <Numero valor={b.quantidade} unidade={b.unidade} />
                                    </span>
                                  </span>
                                  <Stepper tamanho="sm" valor={pedir} min={0} onChange={definir} label={`Quantidade de ${b.nome}`} className={cn(delta !== 0 && "border-accent")} />
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Passo>
        </div>

        {/* 4 · Resumo e envio: acompanha a rolagem no desktop; no celular vem depois dos passos. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-topo-fixo">
          <Passo
            n={4}
            titulo="Resumo e envio"
            feito={pendencias.length === 0}
            sub={
              evento ? (
                <>
                  <Numero valor={itens.length} /> {itens.length === 1 ? "item" : "itens"} para {evento.nome}
                </>
              ) : (
                "Escolha o evento e adicione itens."
              )
            }
          >
            {itens.length > 0 && (
              <ul className="m-0 max-h-[200px] list-none overflow-y-auto border-b border-line-soft p-0">
                {itens.map((i) => {
                  const falta = semDescricao.some((x) => x.chave === i.chave);
                  return (
                    <li key={i.chave}>
                      <button
                        type="button"
                        onClick={() => irPara(`item-${i.chave}`)}
                        className="flex w-full cursor-pointer items-center gap-2 border-0 border-b border-line-faint bg-transparent px-cartao py-2 text-left text-pequeno transition-colors duration-150 last:border-b-0 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                      >
                        {falta && <Icone nome="alerta" className="size-3.5 text-warning" title="Faltam descrições" />}
                        <span className="line-clamp-2 min-w-0 flex-1 break-words text-ink" title={i.rotulo}>
                          {i.rotulo}
                        </span>
                        <span className="numero shrink-0 text-ink-2">{i.operacao === "REMOVER" ? "remover" : `× ${i.quantidade}`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-col gap-3.5 px-cartao py-3.5">
              <Field
                label="Título"
                htmlFor="titulo"
                obrigatorio
                error={erroTitulo}
                hint={
                  !titulo.trim() && sugestaoTitulo ? (
                    <>
                      É o que a logística vê na fila.{" "}
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => {
                          setTitulo(sugestaoTitulo);
                          setErroTitulo(null);
                        }}
                      >
                        Usar a sugestão
                      </Button>
                    </>
                  ) : (
                    "É o que a logística vê na fila."
                  )
                }
              >
                <Input
                  id="titulo"
                  value={titulo}
                  maxLength={120}
                  onChange={(e) => {
                    setTitulo(e.target.value);
                    if (erroTitulo && e.target.value.trim()) setErroTitulo(null);
                  }}
                  onBlur={(e) => {
                    if (tentouEnviar) validarTitulo(e.target.value);
                  }}
                  placeholder={sugestaoTitulo ?? "Ex.: Estrutura do palco principal"}
                />
              </Field>
              <Field label="Observação" htmlFor="observacao" optional>
                <Textarea id="observacao" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} placeholder="Contexto que ajuda a logística a responder." className="min-h-[64px]" />
              </Field>

              {pendencias.length > 0 ? (
                <div>
                  <p className="mb-1 mt-0 text-pequeno font-medium text-ink-2">Para enviar, falta:</p>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {pendencias.map((p) => (
                      <li key={p.alvo}>
                        <button
                          type="button"
                          onClick={() => irPara(p.alvo)}
                          className={cn(
                            "-mx-1.5 flex w-[calc(100%+12px)] cursor-pointer items-center gap-2 rounded-controle border-0 bg-transparent px-1.5 py-1 text-left text-pequeno transition-colors duration-150 hover:bg-subtle max-md:min-h-10",
                            tentouEnviar ? "text-danger" : "text-ink-2",
                          )}
                        >
                          <span aria-hidden className={cn("block size-1.5 shrink-0 rounded-full", tentouEnviar ? "bg-danger" : "bg-line-strong")} />
                          {p.texto}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="m-0 flex items-center gap-1.5 text-pequeno font-medium text-success">
                  <Icone nome="check-circulo" />
                  Pronto para enviar
                </p>
              )}

              {erroGeral && (
                <div id="erro-geral">
                  <Aviso tom="danger">{erroGeral}</Aviso>
                </div>
              )}

              <div className="flex flex-col gap-2 max-lg:hidden">
                <Button variant="primary" size="lg" loading={pendente} onClick={() => salvar(true)} disabled={bloqueadoEnvio} motivoDesabilitado="O evento não aceita solicitações agora." className="w-full">
                  Enviar solicitação
                </Button>
                <Button variant="secondary" size="lg" disabled={pendente} onClick={() => salvar(false)} className="w-full">
                  Salvar rascunho
                </Button>
              </div>
              {textoSalvo && (
                <p className={cn("m-0 flex items-center gap-1.5 text-pequeno", estadoSalvo.tipo === "erro" ? "text-danger" : "text-meta")} aria-live="polite">
                  {estadoSalvo.tipo === "salvo" && <Icone nome="check" className="size-3.5" />}
                  {textoSalvo}
                </p>
              )}
            </div>
          </Passo>
        </aside>
      </div>

      {/* Barra de envio fixa no celular e tablet: contagem, o que falta e a ação principal sempre à mão. */}
      <div className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-popover lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-corpo font-medium text-ink">
              <Numero valor={itens.length} /> {itens.length === 1 ? "item" : "itens"}
            </p>
            <p className={cn("m-0 truncate text-pequeno", pendencias.length && tentouEnviar ? "text-danger" : "text-muted")}>{pendencias.length ? `Falta: ${pendencias[0].texto.toLowerCase()}` : "Pronto para enviar"}</p>
          </div>
          <Button variant="ghost" size="md" disabled={pendente} onClick={() => salvar(false)}>
            Salvar
          </Button>
          <Button variant="primary" size="md" loading={pendente} onClick={() => salvar(true)} disabled={bloqueadoEnvio} motivoDesabilitado="O evento não aceita solicitações agora.">
            Enviar
          </Button>
        </div>
      </div>

      <Dialog open={tendaAtual !== null && kitAtual !== null} onOpenChange={(o) => !o && setTendaAberta(null)}>
        {tendaAtual && kitAtual && (
          <DialogContent title={`${tendaAtual.nome} por local`} description={`Quantas tendas ${kitAtual.tamanho} em cada local e os fechamentos e calhas do local. Cada local vira um item.`} size="lg">
            <QuadroTendas
              kit={kitAtual}
              bom={tendaAtual.bom ?? []}
              pecaFechamentoId={extraDoKit(tendaAtual, "fechamento")}
              pecaCalhaId={extraDoKit(tendaAtual, "calha")}
              onConfirmar={(novos) => adicionarTendas(tendaAtual, novos)}
              onCancelar={() => setTendaAberta(null)}
            />
          </DialogContent>
        )}
      </Dialog>

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

/** Acima disto, a lista de descrições começa recolhida (mostra as primeiras). */
const RECOLHER_ACIMA = 8;
const VISIVEIS_RECOLHIDO = 6;

/**
 * Descrição de cada unidade adicionada: 10 pedidas, 10 campos numerados (texto, arte, medida de cada uma).
 * Acima de 50 unidades, um campo só vale para todas. Obrigatório para enviar.
 */
function DescricoesItem({ item, destacarVazias, onChange }: { item: ItemNovo; destacarVazias: boolean; onChange: (d: string[]) => void }) {
  const [expandido, setExpandido] = useState(false);
  const esperadas = descricoesEsperadas(item.operacao, item.quantidade);
  if (!esperadas) return null;
  const lista = ajustarDescricoes(item.descricoes, esperadas);
  const vazias = lista.filter((d) => !d.trim()).length;
  const unica = esperadas === 1;
  const definir = (n: number, v: string) => onChange(lista.map((d, k) => (k === n ? v : d)));
  const recolhivel = esperadas > RECOLHER_ACIMA;
  // Com erro de envio, nada que falta fica escondido.
  const aberto = !recolhivel || expandido || (destacarVazias && lista.slice(VISIVEIS_RECOLHIDO).some((d) => !d.trim()));
  const mostradas = aberto ? lista : lista.slice(0, VISIVEIS_RECOLHIDO);
  const idErro = `descricoes-${item.chave}-erro`;
  const comErro = destacarVazias && vazias > 0;

  return (
    <div id={`descricoes-${item.chave}`} tabIndex={-1} className={cn("mt-3 rounded-controle border bg-subtle px-3 pb-3 pt-2.5 focus:outline-none sm:ml-[76px]", comErro ? "border-danger-border" : "border-line-soft")}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-pequeno font-medium text-ink-2">
          {unica ? (item.quantidade > 1 ? "Descrição (vale para todas as unidades)" : "Descrição") : "Descrição de cada unidade"}
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        </span>
        {!unica && (
          <span className={cn("numero text-rotulo", vazias === 0 ? "text-success" : "text-muted")}>
            {esperadas - vazias} de {esperadas} descritas
          </span>
        )}
        {!unica && lista[0].trim() && vazias > 0 && (
          <Button variant="link" size="xs" className="ml-auto" onClick={() => onChange(lista.map((d) => (d.trim() ? d : lista[0])))}>
            Repetir a 1ª nas vazias
          </Button>
        )}
      </div>
      <ol className={cn("m-0 grid list-none gap-1.5 p-0", !unica && "sm:grid-cols-2")}>
        {mostradas.map((d, n) => (
          <li key={n} className="flex items-center gap-2">
            {!unica && (
              <span aria-hidden className="numero w-6 shrink-0 text-right text-rotulo text-meta">
                {n + 1}
              </span>
            )}
            <Input
              value={d}
              maxLength={TAMANHO_DESCRICAO}
              onChange={(e) => definir(n, e.target.value)}
              aria-label={unica ? `Descrição de ${item.rotulo}` : `Descrição da unidade ${n + 1} de ${item.rotulo}`}
              aria-invalid={destacarVazias && !d.trim() ? true : undefined}
              aria-describedby={comErro ? idErro : undefined}
              placeholder={unica ? "O que é, texto/arte, medida, cor…" : "Texto/arte, medida, cor…"}
              className="min-w-0 flex-1"
            />
          </li>
        ))}
      </ol>
      {recolhivel && !(destacarVazias && lista.slice(VISIVEIS_RECOLHIDO).some((d) => !d.trim())) && (
        <Button variant="link" size="xs" className="mt-2" aria-expanded={aberto} onClick={() => setExpandido((v) => !v)}>
          {aberto ? "Recolher" : `Mostrar as outras ${esperadas - VISIVEIS_RECOLHIDO}`}
        </Button>
      )}
      {comErro && (
        <ErroCampo id={idErro} className="mt-2">
          {vazias === 1 ? "Falta descrever 1 unidade." : `Faltam descrever ${vazias} unidades.`}
        </ErroCampo>
      )}
    </div>
  );
}
