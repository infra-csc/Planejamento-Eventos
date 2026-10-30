"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { ItemOperacao, ItemStatus } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import { ItemStatusBadge, Tag } from "@/components/ui/badge";
import { Pills } from "@/components/ui/pills";
import { Stepper } from "@/components/ui/stepper";
import { Checkbox, Input, Label } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/layout";
import { Numero } from "@/components/ui/numero";
import { TELAS_INATIVAS } from "@/domain/telas";
import { toast, toastErro, toastSucesso } from "@/components/ui/toast";
import { agruparDescricoes } from "@/domain/descricoes-itens";
import { OBS_REGISTRADO_NA_ATA } from "@/domain/solicitacao";
import { LIMITES } from "@/domain/constantes";
import { agruparLocaisTenda } from "@/domain/agrupamento-pedido";
import { desfazerRespostaAction, responderItemAction, type DadosResposta } from "@/app/(app)/solicitacoes/actions";

export type ItemParaResposta = {
  id: string;
  descricao: string;
  operacao: ItemOperacao;
  quantidadeSolicitada: number;
  quantidadeAtual: number | null;
  destino: string | null;
  /** Observação do solicitante sobre o item (sem as descrições das unidades). */
  justificativa: string | null;
  /** Descrição de cada unidade pedida (texto, arte, medida); uma só quando vale para todas. */
  descricoes?: string[] | null;
  /** Projeto com peças ajustadas pelo solicitante ("+2 Praticável 2×1 · −1 Cubo"). */
  ajustes?: string | null;
  /** Item de um projeto de tendas; pode ter várias configurações para o mesmo destino. */
  tenda?: boolean;
  /** Tenda: total de fechamentos e calhas deste item (por tenda × tendas). */
  pecasTenda?: { fechamentos: number; calhas: number; temCalha: boolean };
  status: ItemStatus;
  quantidadeAtendida: number | null;
  observacaoLogistica: string | null;
  pendenciaCompra: boolean;
  /** Quem pode responder/corrigir este item específico (fase do evento e perfil). */
  respondivel: boolean;
  corrigivel: boolean;
  /** Peça que sempre leva outra (1 cocho = 2 cavaletes): a linha automática não acompanha a resposta. */
  acompanhante?: { codigo: string; fator: number; texto: string };
  /** Pré-reunião com a ata aberta: mostra "Na ata · aguarda conferência" em vez de "Atendido". */
  aguardandoReuniao?: boolean;
};

type Edicao = { id: string; modo: "PARCIAL" | "NAO_ATENDIDO" | "CORRIGIR" };

type Ctx = {
  foco: string | null;
  setFoco: (id: string | null) => void;
  edicao: Edicao | null;
  setEdicao: (e: Edicao | null) => void;
  enviar: (item: ItemParaResposta, dados: DadosResposta) => Promise<boolean>;
  pendente: boolean;
  compacto: boolean;
  /** Ação extra por item, vinda do servidor (ex.: "Vincular" no item descrito à mão), ao lado do nome. */
  extras: Record<string, React.ReactNode>;
};

const RespostaCtx = createContext<Ctx | null>(null);

function useResposta() {
  const c = useContext(RespostaCtx);
  if (!c) throw new Error("ItemResposta fora do RespostaProvider");
  return c;
}

/**
 * Estado de seleção/edição e atalhos de teclado das respostas por item (handoff §5.7):
 * com um item selecionado e o foco fora de campos, A atende, P abre parcial, N abre não atendido, Esc cancela.
 */
export function RespostaProvider({
  itens,
  sufixoToast,
  compacto = false,
  extras = {},
  children,
}: {
  itens: ItemParaResposta[];
  /** "ata atualizada" (reunião) ou "OS regerada" (alteração pós-ata). */
  sufixoToast: string;
  compacto?: boolean;
  extras?: Record<string, React.ReactNode>;
  children: React.ReactNode;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [pendente, iniciar] = useTransition();
  const refs = useRef({ foco, edicao, itens });
  useEffect(() => {
    refs.current = { foco, edicao, itens };
  });

  /* Trava síncrona: A A rápido ou Enter repetido não pode disparar duas respostas antes de `pendente` virar true. */
  const enviandoRef = useRef(false);
  // Depois de responder, o foco volta ao item (o botão do painel some e o foco caía no <body>: quem responde pelo
  // teclado voltava ao "Pular para o conteúdo" a cada item) — auditoria 30/10, parte A N8.
  const focoAoTerminar = useRef<string | null>(null);
  useEffect(() => {
    if (pendente || !focoAoTerminar.current) return;
    const id = focoAoTerminar.current;
    focoAoTerminar.current = null;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && ativo.isConnected) return;
    document.querySelector<HTMLElement>(`[data-item-resposta="${CSS.escape(id)}"]`)?.focus();
  }, [pendente]);
  const enviar = (item: ItemParaResposta, dados: DadosResposta) =>
    new Promise<boolean>((resolve) => {
      if (enviandoRef.current) {
        resolve(false);
        return;
      }
      enviandoRef.current = true;
      focoAoTerminar.current = item.id;
      iniciar(async () => {
        let r: Awaited<ReturnType<typeof responderItemAction>>;
        try {
          r = await responderItemAction(item.id, dados);
        } catch {
          enviandoRef.current = false;
          toastErro("Não foi possível responder. Verifique a conexão e tente de novo.");
          resolve(false);
          return;
        }
        enviandoRef.current = false;
        if (!r.ok) {
          toastErro(r.campos ? (Object.values(r.campos)[0] ?? r.erro) : r.erro);
          resolve(false);
          return;
        }
        setEdicao(null);
        const d = r.dados;
        if (!d) {
          resolve(true);
          return;
        }
        const msg = dados.status === "ATENDIDO" && !dados.justificativa ? `${item.descricao} atendido — ${sufixoToast}` : `${d.codigo} · item respondido — ${sufixoToast}`;
        toastSucesso(msg, {
          desfazer: d.podeDesfazer
            ? async () => {
                const u = await desfazerRespostaAction(item.id);
                if (u.ok) toast("Resposta desfeita");
                else toastErro(u.erro);
              }
            : undefined,
        });
        resolve(true);
      });
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { foco: f, edicao: ed, itens: lista } = refs.current;
      if (e.key === "Escape" && ed) {
        setEdicao(null);
        return;
      }
      if (!f || ed || e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(input|textarea|select)$/i.test(alvo.tagName)) return;
      // Só com o foco no item selecionado (ou dentro dele): com o foco em outro lugar da página, "A" gravava
      // "Atendido" no item que ficou marcado (WCAG 2.1.4, auditoria de acessibilidade 28/10).
      if (alvo?.closest?.("[data-item-resposta]")?.getAttribute("data-item-resposta") !== f) return;
      if (document.querySelector("[role=dialog]")) return;
      const item = lista.find((i) => i.id === f);
      if (!item || !item.respondivel || item.status !== "EM_ANALISE") return;
      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        void enviar(item, { status: "ATENDIDO" });
      } else if (k === "p" && temParcial(item)) {
        e.preventDefault();
        setEdicao({ id: item.id, modo: "PARCIAL" });
      } else if (k === "n") {
        e.preventDefault();
        setEdicao({ id: item.id, modo: "NAO_ATENDIDO" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // enviar é estável o suficiente: usa apenas setters e a action
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <RespostaCtx.Provider value={{ foco, setFoco, edicao, setEdicao, enviar, pendente, compacto, extras }}>{children}</RespostaCtx.Provider>;
}

function textoQuantidade(i: ItemParaResposta) {
  if (i.operacao === "REMOVER") return "remover da ata";
  if (i.operacao === "ALTERAR_QUANTIDADE") return `de ${i.quantidadeAtual ?? "?"} para ${i.quantidadeSolicitada}`;
  return `× ${i.quantidadeSolicitada}`;
}

/** Faixa válida do parcial. Em "alterar quantidade", fica entre o que está na ata e o que foi pedido. */
function faixaParcial(item: ItemParaResposta) {
  if (item.operacao === "ALTERAR_QUANTIDADE" && item.quantidadeAtual != null) {
    return { min: Math.min(item.quantidadeAtual, item.quantidadeSolicitada) + 1, max: Math.max(item.quantidadeAtual, item.quantidadeSolicitada) - 1 };
  }
  return { min: 1, max: item.quantidadeSolicitada - 1 };
}
const temParcial = (item: ItemParaResposta) => item.operacao !== "REMOVER" && faixaParcial(item).max >= faixaParcial(item).min;

/** Mensagem de erro no padrão do Field. */
function Erro({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="m-0 flex items-start gap-1 text-pequeno text-danger">
      <Icone nome="erro" className="mt-px" />
      {children}
    </p>
  );
}

function PainelEdicao({ item, modo }: { item: ItemParaResposta; modo: Edicao["modo"] }) {
  const { enviar, setEdicao, pendente } = useResposta();
  const corrigir = modo === "CORRIGIR";
  const [status, setStatus] = useState<Exclude<ItemStatus, "EM_ANALISE">>(corrigir ? (item.status === "EM_ANALISE" ? "ATENDIDO" : item.status) : modo);
  const faixa = faixaParcial(item);
  const [qtd, setQtd] = useState<number>(corrigir && item.quantidadeAtendida ? item.quantidadeAtendida : Math.min(faixa.max, Math.max(faixa.min, item.quantidadeSolicitada - 1)));
  // A frase automática da pré-reunião não é motivo de ninguém: o campo começa vazio.
  const obsInicial = corrigir && item.observacaoLogistica?.trim() !== OBS_REGISTRADO_NA_ATA ? (item.observacaoLogistica ?? "") : "";
  const [obs, setObs] = useState(obsInicial);
  const [pendencia, setPendencia] = useState(corrigir ? item.pendenciaCompra : modo === "PARCIAL");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<{ campo: "qtd" | "obs" | "justificativa"; msg: string } | null>(null);
  const idErro = (campo: "qtd" | "obs" | "justificativa") => `erro-resposta-${item.id}-${campo}`;
  const aria = (campo: "qtd" | "obs" | "justificativa") => (erro?.campo === campo ? { "aria-invalid": true, "aria-describedby": idErro(campo) } : {});
  const motivoObrigatorio = status !== "ATENDIDO";
  // Quanto do item fica na ata com esta resposta (para o aviso do acompanhante).
  const ficaNaAta = status === "PARCIAL" ? qtd : item.operacao === "ALTERAR_QUANTIDADE" ? (item.quantidadeAtual ?? 0) : 0;
  // Corrigir para "Atendido" não leva junto o motivo do parcial/não atendido: o item ficava "Atendido 3 · Logística:
  // Não há outro stand livre." (auditoria 30/10, parte A N3). Voltando à resposta antiga, o motivo volta.
  const trocarStatus = (v: Exclude<ItemStatus, "EM_ANALISE">) => {
    setStatus(v);
    if (v === "ATENDIDO" && item.status !== "ATENDIDO" && obs === obsInicial) setObs("");
    else if (v === item.status && !obs.trim()) setObs(obsInicial);
  };

  const confirmar = async () => {
    if (pendente) return;
    if (status === "PARCIAL" && (!Number.isInteger(qtd) || qtd < faixa.min || qtd > faixa.max)) {
      setErro({ campo: "qtd", msg: `No parcial, a quantidade fica entre ${faixa.min} e ${faixa.max}.` });
      return;
    }
    if (status !== "ATENDIDO" && !obs.trim()) {
      setErro({ campo: "obs", msg: "Parcial e não atendido exigem motivo." });
      return;
    }
    if (corrigir && !justificativa.trim()) {
      setErro({ campo: "justificativa", msg: "Informe por que a resposta está sendo corrigida." });
      return;
    }
    // Limite do servidor conferido aqui, no campo: antes 655 caracteres davam só o toast "Máximo de 500 caracteres",
    // sem dizer qual campo (auditoria 30/10, parte A N7).
    if (obs.trim().length > LIMITES.justificativa) {
      setErro({ campo: "obs", msg: `${motivoObrigatorio ? "O motivo" : "A observação"} tem ${obs.trim().length} caracteres; o máximo é ${LIMITES.justificativa}.` });
      return;
    }
    if (justificativa.trim().length > LIMITES.justificativa) {
      setErro({ campo: "justificativa", msg: `A justificativa tem ${justificativa.trim().length} caracteres; o máximo é ${LIMITES.justificativa}.` });
      return;
    }
    setErro(null);
    await enviar(item, {
      status,
      quantidadeAtendida: status === "PARCIAL" ? qtd : undefined,
      observacaoLogistica: obs.trim() || null,
      pendenciaCompra: status !== "ATENDIDO" && !TELAS_INATIVAS.pendencias && pendencia,
      justificativa: corrigir ? justificativa.trim() : null,
    });
  };

  const opcoes: Array<[Exclude<ItemStatus, "EM_ANALISE">, string]> =
    item.operacao === "REMOVER"
      ? [
          ["ATENDIDO", "Atendido"],
          ["NAO_ATENDIDO", "Não atendido"],
        ]
      : [
          ["ATENDIDO", "Atendido"],
          ["PARCIAL", "Parcial"],
          ["NAO_ATENDIDO", "Não atendido"],
        ];
  const tituloPainel = corrigir ? "Corrigir resposta" : status === "PARCIAL" ? "Atender parcialmente" : "Não atender";
  const aoEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void confirmar();
    }
  };

  return (
    <div
      role="group"
      aria-label={tituloPainel}
      className={cn("mt-3 animate-fade-up-rapido rounded-controle border bg-subtle px-3.5 py-3", status === "PARCIAL" ? "border-warning-border" : status === "NAO_ATENDIDO" ? "border-danger-border" : "border-line")}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2.5 mt-0 text-pequeno font-medium text-ink">{tituloPainel}</p>
      <div className="flex flex-col gap-3">
        {corrigir && <Pills rotulo="Nova resposta" itens={opcoes.map(([v, label]) => ({ label, ativo: status === v, onSelect: () => trocarStatus(v) }))} />}
        {status === "PARCIAL" && (
          <div>
            <Label htmlFor={`qtd-${item.id}`}>Quantidade atendida</Label>
            <div className="flex flex-wrap items-center gap-2.5">
              <Stepper id={`qtd-${item.id}`} tamanho="sm" min={faixa.min} max={faixa.max} valor={qtd} onChange={setQtd} />
              <span className="numero text-pequeno text-muted">{item.operacao === "ALTERAR_QUANTIDADE" ? `entre ${faixa.min} e ${faixa.max}` : `de ${item.quantidadeSolicitada} pedidas`}</span>
            </div>
            {erro?.campo === "qtd" && <Erro id={idErro("qtd")}>{erro.msg}</Erro>}
          </div>
        )}
        {motivoObrigatorio || corrigir ? (
          <div>
            <Label htmlFor={`obs-${item.id}`} obrigatorio={motivoObrigatorio} optional={!motivoObrigatorio}>
              {motivoObrigatorio ? "Motivo" : "Observação"}
            </Label>
            <Input
              id={`obs-${item.id}`}
              autoFocus
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onKeyDown={aoEnter}
              {...aria("obs")}
              placeholder={motivoObrigatorio ? "Ex.: só temos 6 em estoque na data" : "Algo que a área precisa saber"}
            />
            {erro?.campo === "obs" && (
              <div className="mt-[5px]">
                <Erro id={idErro("obs")}>{erro.msg}</Erro>
              </div>
            )}
          </div>
        ) : null}
        {corrigir && (
          <div>
            <Label htmlFor={`just-${item.id}`} obrigatorio>
              Por que corrigir
            </Label>
            <Input id={`just-${item.id}`} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} onKeyDown={aoEnter} {...aria("justificativa")} placeholder="Fica registrado no histórico" />
            {erro?.campo === "justificativa" && (
              <div className="mt-[5px]">
                <Erro id={idErro("justificativa")}>{erro.msg}</Erro>
              </div>
            )}
          </div>
        )}
        {/* A linha automática do acompanhante (cavaletes do cocho…) não muda com esta resposta: antes a ata ficava
            com Cocho 2 e Cavalete 6, e só a conferência acusava (auditoria 30/10, parte A N5). Recalcular sozinho é
            decisão do time; por ora, o aviso. */}
        {item.acompanhante && item.operacao !== "REMOVER" && status !== "ATENDIDO" && (
          <p className="m-0 text-pequeno text-warning" role="status">
            {item.acompanhante.texto}: com {ficaNaAta} na ata, a regra pede {ficaNaAta * item.acompanhante.fator}. A linha automática ({item.acompanhante.codigo}) não muda com esta resposta; ajuste-a também.
          </p>
        )}
        {status !== "ATENDIDO" && !TELAS_INATIVAS.pendencias && <Checkbox id={`pendencia-${item.id}`} label="Gerar pendência de compra ou locação" checked={pendencia} onChange={setPendencia} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={confirmar} loading={pendente}>
          {/* O botão diz o que vai acontecer (antes: "Confirmar resposta" para parcial e para não atender). */}
          {corrigir ? "Salvar correção" : status === "PARCIAL" ? "Atender parcialmente" : "Não atender o item"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEdicao(null)}>
          Cancelar
        </Button>
        <span className="ml-auto flex items-center gap-1 text-rotulo text-meta max-md:hidden">
          <Kbd>Enter</Kbd> confirma · <Kbd>Esc</Kbd> cancela
        </span>
      </div>
    </div>
  );
}

/** Acima disto, a lista de descrições das unidades começa recolhida. */
const RECOLHER_ACIMA = 6;
const VISIVEIS_RECOLHIDO = 4;

/** Descrições das unidades: uma frase quando é igual para todas; lista numerada (recolhível) quando varia. */
function DescricoesUnidades({ lista, quantidade }: { lista: string[] | null | undefined; quantidade: number }) {
  const [aberto, setAberto] = useState(false);
  const itens = (lista ?? []).map((d) => d.trim());
  if (!itens.some(Boolean)) return null;
  const iguais = itens.every((d) => d === itens[0]);
  if (itens.length === 1 || iguais) {
    return (
      <p className="m-0 text-pequeno text-ink-2">
        <span className="text-muted">{quantidade > 1 ? `Descrição das ${quantidade} unidades: ` : "Descrição: "}</span>
        {itens[0]}
      </p>
    );
  }
  // Descrições iguais juntas, com quantas unidades cada: sem numerar unidade (o número parecia quantidade).
  const grupos = agruparDescricoes(itens);
  const recolhivel = grupos.length > RECOLHER_ACIMA;
  const mostradas = recolhivel && !aberto ? grupos.slice(0, VISIVEIS_RECOLHIDO) : grupos;
  return (
    <div>
      <p className="mb-1 mt-0 text-pequeno text-muted">
        Descrição das unidades <span className="numero">({itens.length} un.)</span>
      </p>
      <ul className="m-0 grid list-none gap-x-6 gap-y-0.5 p-0 sm:grid-cols-2">
        {mostradas.map((g, n) => (
          <li key={n} className="flex min-w-0 items-baseline gap-2 text-pequeno">
            <span className="numero shrink-0 whitespace-nowrap rounded-chip bg-control px-1.5 text-rotulo text-ink-3">{g.unidades} un.</span>
            <span className={cn("min-w-0 break-words", g.texto ? "text-ink-2" : "text-meta")}>{g.texto || "sem descrição"}</span>
          </li>
        ))}
      </ul>
      {recolhivel && (
        <Button variant="link" size="xs" className="mt-1" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Mostrar menos" : `Ver todas as ${grupos.length} descrições`}
        </Button>
      )}
    </div>
  );
}

const ROTULO_OPERACAO: Partial<Record<ItemOperacao, string>> = { ALTERAR_QUANTIDADE: "mudar quantidade", REMOVER: "remover da ata" };

/**
 * O mesmo item pedido para vários locais (tendas no Depósito, no GV…) aparece junto: um cabeçalho com
 * o nome e o total, e uma linha por local — cada uma com status, descrição e resposta próprios.
 */
export function GrupoItens({ itens, semStatus = false }: { itens: ItemParaResposta[]; semStatus?: boolean }) {
  if (itens[0].tenda) {
    const locais = agruparLocaisTenda(itens);
    const total = itens.reduce((a, i) => a + i.quantidadeSolicitada, 0);
    const somenteAdicoes = itens.every((i) => i.operacao === "ADICIONAR");
    const primeiro = itens[0];
    const naAtaGrupo = Boolean(primeiro.aguardandoReuniao) && primeiro.status === "ATENDIDO";
    const mesmoEstado =
      itens.every((i) => i.status === primeiro.status && Boolean(i.aguardandoReuniao) === Boolean(primeiro.aguardandoReuniao)) &&
      (primeiro.status === "EM_ANALISE" || naAtaGrupo);

    return (
      <div
        role="group"
        aria-label={`${primeiro.descricao}: ${somenteAdicoes ? `${total} no total` : `${itens.length} partes`}, ${locais.length} ${locais.length === 1 ? "local" : "locais"}`}
        className="border-b border-line-row last:border-b-0"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-cartao pb-1 pt-4">
          <p className="m-0 min-w-0 flex-1 break-words text-corpo font-medium text-ink">{primeiro.descricao}</p>
          {/* Um local só: o total já está na linha do local ("6 tendas · sem fechamento"); aqui repetia. */}
          {!(somenteAdicoes && locais.length === 1) && (
          <span className="shrink-0 text-pequeno text-muted">
            {somenteAdicoes ? (
              <>
                <Numero valor={total} className="font-semibold text-ink" /> no total
              </>
            ) : (
              <>
                <Numero valor={itens.length} className="font-semibold text-ink" /> {itens.length === 1 ? "parte" : "partes"}
              </>
            )}
            {" · "}
            <Numero valor={locais.length} className="font-semibold text-ink" /> {locais.length === 1 ? "local" : "locais"}
          </span>
          )}
          {!semStatus && mesmoEstado && <ItemStatusBadge status={primeiro.status} naAta={naAtaGrupo} className="shrink-0" />}
        </div>
        {mesmoEstado && naAtaGrupo && <p className="m-0 px-cartao pb-1 text-pequeno text-ink-2">Aguarda conferência na reunião de OS.</p>}
        <div className="ml-cartao border-l-2 border-line-soft">
          {locais.map(({ local, itens: partes }, localIndex) => (
            <section key={`${local ?? "sem-local"}-${localIndex}`} aria-label={local ? `Local: ${local}` : "Local não informado"} className="min-w-0 border-b border-line-row last:border-b-0">
              <h3 className="m-0 flex min-w-0 items-center gap-1.5 break-words px-4 pb-2 pt-3 text-pequeno font-semibold text-ink-2">
                <Icone nome="local" className="size-3.5 shrink-0 text-ink-3" />
                {local || <span className="font-normal text-muted">Local não informado</span>}
                <span className="ml-auto shrink-0 pl-2 text-rotulo font-normal text-muted">
                  {somenteAdicoes ? (
                    <>
                      <Numero valor={partes.reduce((soma, i) => soma + i.quantidadeSolicitada, 0)} /> {partes.reduce((soma, i) => soma + i.quantidadeSolicitada, 0) === 1 ? "tenda" : "tendas"}
                      {(() => {
                        // Total do local: "6 fechamentos · 3 calhas" (o que a área pediu, de uma vez).
                        const f = partes.reduce((t, i) => t + (i.pecasTenda?.fechamentos ?? 0), 0);
                        const c = partes.reduce((t, i) => t + (i.pecasTenda?.calhas ?? 0), 0);
                        const comCalha = partes.some((i) => i.pecasTenda?.temCalha);
                        return (
                          <>
                            {" · "}
                            {f ? (
                              <>
                                <Numero valor={f} /> {f === 1 ? "fechamento" : "fechamentos"}
                              </>
                            ) : (
                              "sem fechamento"
                            )}
                            {comCalha && (
                              <>
                                {" · "}
                                {c ? (
                                  <>
                                    <Numero valor={c} /> {c === 1 ? "calha" : "calhas"}
                                  </>
                                ) : (
                                  "sem calha"
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <><Numero valor={partes.length} /> {partes.length === 1 ? "parte" : "partes"}</>
                  )}
                </span>
              </h3>
              {/* Na ata, sem descrição por tenda: o resumo do local basta (a conferência ajusta). */}
              {!(mesmoEstado && naAtaGrupo && somenteAdicoes && partes.every((i) => !i.descricoes?.some((d) => d.trim()))) && (
              <ul className="m-0 list-none p-0 [&>li:last-child>div]:border-b-0">
                {partes.map((item, parteIndex) => (
                  <li key={item.id} className="min-w-0">
                    <ItemResposta
                      item={item}
                      semStatus={semStatus}
                      emGrupo
                      estadoNoGrupo={mesmoEstado}
                      localNoGrupo
                      parte={parteIndex + 1}
                      unicaNoLocal={partes.length === 1}
                    />
                  </li>
                ))}
              </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    );
  }

  const total = itens.reduce((a, i) => a + i.quantidadeSolicitada, 0);
  // Mesma situação em todos os locais: o selo (e o "aguarda conferência") aparece uma vez, no cabeçalho.
  const primeiro = itens[0];
  const naAtaGrupo = Boolean(primeiro.aguardandoReuniao) && primeiro.status === "ATENDIDO";
  const mesmoEstado = itens.every((i) => i.status === primeiro.status && Boolean(i.aguardandoReuniao) === Boolean(primeiro.aguardandoReuniao)) && (primeiro.status === "EM_ANALISE" || naAtaGrupo);
  return (
    <div role="group" aria-label={`${itens[0].descricao}: ${total} no total em ${itens.length} locais`} className="border-b border-line-row last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-cartao pb-1 pt-4">
        <p className="m-0 min-w-0 flex-1 break-words text-corpo font-medium text-ink">{itens[0].descricao}</p>
        <span className="shrink-0 text-pequeno text-muted">
          <Numero valor={total} className="font-semibold text-ink" /> no total · {itens.length} locais
        </span>
        {!semStatus && mesmoEstado && <ItemStatusBadge status={primeiro.status} naAta={naAtaGrupo} className="shrink-0" />}
      </div>
      {mesmoEstado && naAtaGrupo && <p className="m-0 px-cartao pb-1 text-pequeno text-ink-2">Aguarda conferência na reunião de OS.</p>}
      <div className="ml-cartao border-l-2 border-line-soft [&>*:last-child]:border-b-0">
        {itens.map((i) => (
          <ItemResposta key={i.id} item={i} semStatus={semStatus} emGrupo estadoNoGrupo={mesmoEstado} />
        ))}
      </div>
    </div>
  );
}

/** Descrição gerada que só repete o local ("Tenda 3×3 — Buffet"): dentro do grupo por local, não informa nada. */
const soRepeteLocal = (d: string, destino: string | null) => Boolean(destino) && d.trim().toLowerCase().endsWith(`— ${destino!.trim().toLowerCase()}`);

export function ItemResposta({
  item: itemOriginal,
  semStatus = false,
  emGrupo = false,
  estadoNoGrupo = false,
  localNoGrupo = false,
  parte,
  unicaNoLocal = false,
}: {
  item: ItemParaResposta;
  semStatus?: boolean;
  emGrupo?: boolean;
  /** O grupo já mostra a situação (igual em todos os locais). */
  estadoNoGrupo?: boolean;
  /** O cabeçalho de destino já foi renderizado acima da lista de partes. */
  localNoGrupo?: boolean;
  parte?: number;
  /** Tenda: a única parte do local. "6 tendas" e "Por tenda: sem fechamento" já estão na linha do local. */
  unicaNoLocal?: boolean;
}) {
  const item = emGrupo && itemOriginal.descricoes?.every((d) => !d.trim() || soRepeteLocal(d, itemOriginal.destino)) ? { ...itemOriginal, descricoes: null } : itemOriginal;
  const { foco, setFoco, edicao, setEdicao, enviar, pendente, compacto, extras } = useResposta();
  const extra = extras[item.id];
  const selecionado = foco === item.id;
  const editando = edicao?.id === item.id ? edicao : null;
  const emAnalise = item.status === "EM_ANALISE";
  const naAta = Boolean(item.aguardandoReuniao) && item.status === "ATENDIDO";
  const podeResponder = emAnalise && item.respondivel;
  const temContexto = Boolean(item.descricoes?.some((d) => d.trim()) || item.justificativa);
  // A frase automática do pedido pré-reunião se repetia em todo item depois da reunião: só a observação escrita aparece.
  const observacao = naAta ? (estadoNoGrupo ? null : "Aguarda conferência na reunião de OS.") : item.observacaoLogistica?.trim() === OBS_REGISTRADO_NA_ATA ? null : item.observacaoLogistica;
  const rotuloOp = ROTULO_OPERACAO[item.operacao];

  return (
    <div
      tabIndex={0}
      role="group"
      data-item-resposta={item.id}
      aria-label={`${item.descricao}${localNoGrupo && parte ? `, parte ${parte}` : emGrupo && item.destino ? ` em ${item.destino}` : ""}, ${textoQuantidade(item)}${podeResponder ? ". Atalhos: A atende, P parcial, N não atende" : ""}`}
      aria-current={selecionado ? "true" : undefined}
      onClick={() => setFoco(item.id)}
      onFocus={(e) => {
        if (e.target === e.currentTarget) setFoco(item.id);
      }}
      className={cn(
        "relative border-b border-line-row transition-colors duration-150 last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        emGrupo ? "py-3 pl-4 pr-cartao" : cn("py-4", compacto ? "px-4" : "px-cartao"),
        podeResponder && "cursor-pointer",
        selecionado ? "bg-selected before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : podeResponder && "hover:bg-subtle",
      )}
    >
      {/* Cabeçalho: o que foi pedido, quanto e o estado (um selo só). */}
      {/* Estreito: "fora do catálogo · Vincular" e o selo descem para baixo do nome em vez de espremê-lo. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-56">
          {emGrupo && !localNoGrupo ? (
            <p className="m-0 flex items-center gap-1.5 break-words text-corpo font-medium text-ink">
              <Icone nome="local" className="size-3.5 shrink-0 text-ink-3" />
              {item.destino || <span className="font-normal text-muted">Local não informado</span>}
            </p>
          ) : localNoGrupo ? (
            // "Tenda 1", "Tenda 2" (ou "3 tendas" quando a parte junta várias iguais): "Parte 1 · configuração
            // específica" era linguagem do sistema, não de quem montou o pedido. Parte única: o local já diz.
            unicaNoLocal ? null : <p className="m-0 break-words text-rotulo font-medium text-ink-3">{item.quantidadeSolicitada === 1 ? `Tenda ${parte}` : `${item.quantidadeSolicitada} tendas`}</p>
          ) : (
            <p className="m-0 break-words text-corpo font-medium text-ink">{item.descricao}</p>
          )}
          <p className="mb-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-pequeno text-muted">
            {rotuloOp && <Tag tom={item.operacao === "REMOVER" ? "danger" : "muted"}>{rotuloOp}</Tag>}
            <span>
              Pedido{" "}
              {item.operacao === "REMOVER" ? (
                <span className="text-ink-2">
                  remover (hoje <Numero valor={item.quantidadeAtual} />)
                </span>
              ) : item.operacao === "ALTERAR_QUANTIDADE" ? (
                <span className="text-ink-2">
                  <Numero valor={item.quantidadeAtual} /> → <Numero valor={item.quantidadeSolicitada} className="font-semibold text-ink" />
                </span>
              ) : (
                <Numero valor={item.quantidadeSolicitada} className="font-semibold text-ink" />
              )}
            </span>
            {/* Mudança de quantidade não atendida: a linha fica como estava. "Atendido 0" fazia pensar que a peça
                tinha saído do evento (auditoria 30/10, parte A N4). */}
            {!emAnalise && !naAta && item.operacao === "ALTERAR_QUANTIDADE" && item.status === "NAO_ATENDIDO" ? (
              <span>
                Fica <Numero valor={item.quantidadeAtual} className="font-semibold text-ink" /> (sem mudança)
              </span>
            ) : !emAnalise && !naAta && item.operacao !== "REMOVER" && (
              <span>
                Atendido <Numero valor={item.quantidadeAtendida ?? 0} className={cn("font-semibold", item.status === "ATENDIDO" ? "text-success" : item.status === "PARCIAL" ? "text-warning" : "text-danger")} />
              </span>
            )}
            {item.destino && !emGrupo && (
              <span className="inline-flex items-center gap-1">
                <Icone nome="local" className="size-3.5 text-ink-3" />
                {item.destino}
              </span>
            )}
          </p>
          {item.ajustes && !(item.tenda && unicaNoLocal) && (
            <p className="mb-0 mt-1 text-pequeno text-ink-2">
              {!item.tenda && <span className="text-muted">Peças ajustadas: </span>}
              {item.ajustes}
            </p>
          )}
        </div>
        {extra && (
          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {extra}
          </span>
        )}
        {/* Quem responde vê os botões: o selo "Em análise" ao lado deles só repetia que falta responder. */}
        {!semStatus && !estadoNoGrupo && !podeResponder && <ItemStatusBadge status={item.status} naAta={naAta} className="shrink-0" />}
      </div>

      {/* O que o solicitante escreveu: descrições das unidades e observação, em texto (sem caixa dentro do item). */}
      {temContexto && (
        <div className="mt-1.5 flex flex-col gap-1">
          <DescricoesUnidades lista={item.descricoes} quantidade={item.quantidadeSolicitada} />
          {/* A observação que só repete a descrição não aparece duas vezes. */}
          {item.justificativa && !((item.descricoes ?? []).some((d) => d.trim()) && (item.descricoes ?? []).every((d) => d.trim() === item.justificativa!.trim())) && (
            <p className="m-0 text-pequeno text-ink-2">
              <span className="text-muted">Observação: </span>
              {item.justificativa}
            </p>
          )}
        </div>
      )}

      {/* Resposta: Atender é a ação principal; parcial e não atender ficam em segundo plano. */}
      {podeResponder && !editando && (
        <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="atender"
            size="md"
            disabled={pendente}
            onClick={() => {
              setFoco(item.id);
              void enviar(item, { status: "ATENDIDO" });
            }}
          >
            <Icone nome="check" />
            {item.operacao === "REMOVER" ? "Remover da ata" : item.operacao === "ALTERAR_QUANTIDADE" ? `Atender (${item.quantidadeSolicitada})` : `Atender ${item.quantidadeSolicitada}`}
            {selecionado && (
              <span className="max-md:hidden">
                <Kbd>A</Kbd>
              </span>
            )}
          </Button>
          {temParcial(item) && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setFoco(item.id);
                setEdicao({ id: item.id, modo: "PARCIAL" });
              }}
            >
              Parcial
              {selecionado && (
                <span className="max-md:hidden">
                  <Kbd>P</Kbd>
                </span>
              )}
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setFoco(item.id);
              setEdicao({ id: item.id, modo: "NAO_ATENDIDO" });
            }}
          >
            Não atender
            {selecionado && (
              <span className="max-md:hidden">
                <Kbd>N</Kbd>
              </span>
            )}
          </Button>
        </div>
      )}

      {editando && <PainelEdicao key={`${editando.id}-${editando.modo}`} item={item} modo={editando.modo} />}

      {/* Já respondido: observação da logística, pendência e correção. */}
      {!emAnalise && !editando && (observacao || item.pendenciaCompra || item.corrigivel) && (
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-pequeno">
          {observacao && (
            <span className="min-w-0 flex-1 text-ink-2">
              <span className="text-muted">{naAta ? "" : "Logística: "}</span>
              {observacao}
            </span>
          )}
          {item.pendenciaCompra && !naAta && <Tag tom="warning">pendência de compra/locação</Tag>}
          {item.corrigivel && (
            <Button
              variant="link"
              size="xs"
              className="ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                setFoco(item.id);
                setEdicao({ id: item.id, modo: "CORRIGIR" });
              }}
            >
              {naAta ? "Ajustar" : "Corrigir resposta"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Atalhos de teclado, discretos no cabeçalho da lista (só no desktop: no celular não há teclado físico). */
export function DicaAtalhos() {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-rotulo text-meta max-md:hidden">
      <span>Com um item selecionado:</span>
      {(
        [
          ["A", "atender"],
          ["P", "parcial"],
          ["N", "não atender"],
        ] as const
      ).map(([k, o]) => (
        <span key={k} className="flex items-center gap-1">
          <Kbd>{k}</Kbd>
          {o}
        </span>
      ))}
    </span>
  );
}
