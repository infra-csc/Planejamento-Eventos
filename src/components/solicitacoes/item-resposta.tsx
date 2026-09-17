"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { ItemOperacao, ItemStatus } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import { COR_ITEM, ItemStatusBadge } from "@/components/ui/badge";
import { Pills } from "@/components/ui/pills";
import { Stepper } from "@/components/ui/stepper";
import { Checkbox, Input } from "@/components/ui/field";
import { Kbd, Marcador } from "@/components/ui/layout";
import { toast, toastErro } from "@/components/ui/toast";
import { desfazerRespostaAction, responderItemAction, type DadosResposta } from "@/app/(app)/solicitacoes/actions";

export type ItemParaResposta = {
  id: string;
  descricao: string;
  operacao: ItemOperacao;
  quantidadeSolicitada: number;
  quantidadeAtual: number | null;
  destino: string | null;
  justificativa: string | null;
  /** Projeto com peças ajustadas pelo solicitante ("+2 Praticável 2×1 · −1 Cubo"). */
  ajustes?: string | null;
  status: ItemStatus;
  quantidadeAtendida: number | null;
  observacaoLogistica: string | null;
  pendenciaCompra: boolean;
  /** Quem pode responder/corrigir este item específico (fase do evento e perfil). */
  respondivel: boolean;
  corrigivel: boolean;
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
  children,
}: {
  itens: ItemParaResposta[];
  /** "ata atualizada" (reunião) ou "OS regerada" (alteração pós-ata). */
  sufixoToast: string;
  compacto?: boolean;
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
  const enviar = (item: ItemParaResposta, dados: DadosResposta) =>
    new Promise<boolean>((resolve) => {
      if (enviandoRef.current) {
        resolve(false);
        return;
      }
      enviandoRef.current = true;
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
        toast(msg, {
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
      if (document.querySelector("[role=dialog]")) return;
      const item = lista.find((i) => i.id === f);
      if (!item || !item.respondivel || item.status !== "EM_ANALISE") return;
      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        void enviar(item, { status: "ATENDIDO" });
      } else if (k === "p" && item.operacao !== "REMOVER" && item.quantidadeSolicitada > 1) {
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

  return <RespostaCtx.Provider value={{ foco, setFoco, edicao, setEdicao, enviar, pendente, compacto }}>{children}</RespostaCtx.Provider>;
}

function textoQuantidade(i: ItemParaResposta) {
  if (i.operacao === "REMOVER") return "(remover da ata)";
  if (i.operacao === "ALTERAR_QUANTIDADE") return `de ${i.quantidadeAtual ?? "?"} para ${i.quantidadeSolicitada}`;
  return `× ${i.quantidadeSolicitada}`;
}

function resultado(i: ItemParaResposta) {
  if (i.operacao === "REMOVER") return i.status === "ATENDIDO" ? "removido da ata" : "mantido na ata";
  return `${i.quantidadeAtendida ?? 0} de ${i.quantidadeSolicitada}`;
}

function PainelEdicao({ item, modo }: { item: ItemParaResposta; modo: Edicao["modo"] }) {
  const { enviar, setEdicao, pendente } = useResposta();
  const corrigir = modo === "CORRIGIR";
  const [status, setStatus] = useState<Exclude<ItemStatus, "EM_ANALISE">>(corrigir ? (item.status === "EM_ANALISE" ? "ATENDIDO" : item.status) : modo);
  const [qtd, setQtd] = useState<number>(corrigir && item.quantidadeAtendida ? item.quantidadeAtendida : Math.max(1, item.quantidadeSolicitada - 1));
  const [obs, setObs] = useState(corrigir ? item.observacaoLogistica ?? "" : "");
  const [pendencia, setPendencia] = useState(corrigir ? item.pendenciaCompra : modo === "PARCIAL");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async () => {
    if (pendente) return;
    if (status === "PARCIAL" && (!Number.isInteger(qtd) || qtd < 1 || qtd >= item.quantidadeSolicitada)) {
      setErro(`No parcial, a quantidade atendida fica entre 1 e ${item.quantidadeSolicitada - 1}.`);
      return;
    }
    if (status !== "ATENDIDO" && !obs.trim()) {
      setErro("Parcial e não atendido exigem motivo.");
      return;
    }
    if (corrigir && !justificativa.trim()) {
      setErro("Informe por que a resposta está sendo corrigida.");
      return;
    }
    setErro(null);
    await enviar(item, {
      status,
      quantidadeAtendida: status === "PARCIAL" ? qtd : undefined,
      observacaoLogistica: obs.trim() || null,
      pendenciaCompra: status !== "ATENDIDO" && pendencia,
      justificativa: corrigir ? justificativa.trim() : null,
    });
  };

  const opcoes: Array<[Exclude<ItemStatus, "EM_ANALISE">, string]> = item.operacao === "REMOVER" ? [["ATENDIDO", "Atendido"], ["NAO_ATENDIDO", "Não atendido"]] : [["ATENDIDO", "Atendido"], ["PARCIAL", "Parcial"], ["NAO_ATENDIDO", "Não atendido"]];

  return (
    <div className="ml-[19px] mt-2.5 rounded-cartao border border-line bg-subtle p-3" onClick={(e) => e.stopPropagation()}>
      {corrigir && <Pills className="mb-2.5" rotulo="Nova resposta" itens={opcoes.map(([v, label]) => ({ label, ativo: status === v, onSelect: () => setStatus(v) }))} />}
      {status === "PARCIAL" && (
        <div className="mb-[9px] flex items-center gap-2.5">
          <label htmlFor={`qtd-${item.id}`} className="text-pequeno text-ink-2">
            Quantidade atendida
          </label>
          <Stepper id={`qtd-${item.id}`} tamanho="sm" min={1} max={item.quantidadeSolicitada - 1} valor={qtd} onChange={setQtd} />
          <span className="text-pequeno text-muted">de {item.quantidadeSolicitada}</span>
        </div>
      )}
      {status !== "ATENDIDO" || corrigir ? (
        <Input
          autoFocus
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void confirmar();
            }
          }}
          aria-label="Motivo"
          placeholder={status === "ATENDIDO" ? "Observação (opcional)" : "Motivo — obrigatório em parcial e não atendido"}
          className="mb-[9px]"
        />
      ) : null}
      {corrigir && <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} aria-label="Justificativa da correção" placeholder="Por que a resposta está sendo corrigida — fica no histórico" className="mb-[9px]" />}
      {status !== "ATENDIDO" && (
        <div className="mb-2.5">
          <Checkbox id={`pendencia-${item.id}`} label="Gerar pendência de compra ou locação" checked={pendencia} onChange={setPendencia} />
        </div>
      )}
      {erro && (
        <p role="alert" className="mb-2.5 mt-0 text-pequeno text-danger">
          {erro}
        </p>
      )}
      <div className="flex gap-[7px]">
        <Button variant="primary" size="sm" onClick={confirmar} loading={pendente}>
          {corrigir ? "Salvar correção" : "Confirmar resposta"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setEdicao(null)} className="font-normal text-ink-2">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function ItemResposta({ item, semStatus = false }: { item: ItemParaResposta; semStatus?: boolean }) {
  const { foco, setFoco, edicao, setEdicao, enviar, pendente, compacto } = useResposta();
  const selecionado = foco === item.id;
  const editando = edicao?.id === item.id ? edicao : null;
  const emAnalise = item.status === "EM_ANALISE";
  const contexto = [item.ajustes ? `Peças ajustadas: ${item.ajustes}` : null, item.destino ? `Destino: ${item.destino}` : null, item.justificativa].filter(Boolean).join(" · ") || "sem observação do solicitante";
  const naAta = Boolean(item.aguardandoReuniao) && item.status === "ATENDIDO";
  const observacao = naAta
    ? "aguarda conferência na reunião de OS"
    : [item.observacaoLogistica, item.pendenciaCompra ? "pendência de compra/locação" : null].filter(Boolean).join(" · ") || "sem ressalvas";

  return (
    <div
      tabIndex={0}
      aria-label={`${item.descricao}, ${textoQuantidade(item)}${emAnalise && item.respondivel ? ". Atalhos: A atende, P parcial, N não atende" : ""}`}
      aria-current={selecionado ? "true" : undefined}
      onClick={() => setFoco(item.id)}
      onFocus={(e) => {
        if (e.target === e.currentTarget) setFoco(item.id);
      }}
      className={cn("relative cursor-pointer border-b border-line-row py-3 last:border-b-0", compacto ? "px-4" : "px-[18px]", selecionado && "bg-selected before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent")}
    >
      <div className="flex items-start gap-3">
        <Marcador cor={naAta ? "var(--color-accent)" : COR_ITEM[item.status]} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-corpo text-ink">
            {item.descricao} <span className="text-muted">{textoQuantidade(item)}</span>
          </p>
          <p className="mt-0.5 text-pequeno text-muted">{contexto}</p>
        </div>
        {!semStatus && <ItemStatusBadge status={item.status} naAta={naAta} className="shrink-0" />}
      </div>

      {emAnalise && item.respondivel && !editando && (
        <div className="ml-[19px] mt-2.5 flex flex-wrap items-center gap-[7px]" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="atender"
            size="sm"
            disabled={pendente}
            onClick={() => {
              setFoco(item.id);
              void enviar(item, { status: "ATENDIDO" });
            }}
          >
            {item.operacao === "REMOVER" ? "Remover da ata" : `Atender ${item.quantidadeSolicitada}`}
          </Button>
          {item.operacao !== "REMOVER" && item.quantidadeSolicitada > 1 && (
            <Button
              variant="parcial"
              size="sm"
              onClick={() => {
                setFoco(item.id);
                setEdicao({ id: item.id, modo: "PARCIAL" });
              }}
            >
              Parcial
            </Button>
          )}
          <Button
            variant="recusar"
            size="sm"
            onClick={() => {
              setFoco(item.id);
              setEdicao({ id: item.id, modo: "NAO_ATENDIDO" });
            }}
          >
            Não atender
          </Button>
        </div>
      )}

      {editando && <PainelEdicao key={`${editando.id}-${editando.modo}`} item={item} modo={editando.modo} />}

      {!emAnalise && !editando && (
        <div className="ml-[19px] mt-2 flex items-baseline gap-2 text-pequeno text-ink-2">
          <span className="font-mono font-medium">{naAta ? `× ${item.quantidadeSolicitada} na ata` : resultado(item)}</span>
          <span className="min-w-0 flex-1 text-ink-3">{observacao}</span>
          {item.corrigivel && (
            <Button
              variant="link"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setFoco(item.id);
                setEdicao({ id: item.id, modo: "CORRIGIR" });
              }}
            >
              {naAta ? "Ajustar" : "Corrigir"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function DicaAtalhos() {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="text-rotulo text-meta">atalhos com um item selecionado:</span>
      {([["A", "atender"], ["P", "parcial"], ["N", "não atender"]] as const).map(([k, o]) => (
        <span key={k} className="flex items-center gap-1 text-rotulo text-meta">
          <Kbd>{k}</Kbd>
          {o}
        </span>
      ))}
    </span>
  );
}
