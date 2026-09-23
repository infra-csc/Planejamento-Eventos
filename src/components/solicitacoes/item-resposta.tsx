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
import { toast, toastErro, toastSucesso } from "@/components/ui/toast";
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

  return <RespostaCtx.Provider value={{ foco, setFoco, edicao, setEdicao, enviar, pendente, compacto }}>{children}</RespostaCtx.Provider>;
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
  const [obs, setObs] = useState(corrigir ? (item.observacaoLogistica ?? "") : "");
  const [pendencia, setPendencia] = useState(corrigir ? item.pendenciaCompra : modo === "PARCIAL");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<{ campo: "qtd" | "obs" | "justificativa"; msg: string } | null>(null);
  const idErro = (campo: "qtd" | "obs" | "justificativa") => `erro-resposta-${item.id}-${campo}`;
  const aria = (campo: "qtd" | "obs" | "justificativa") => (erro?.campo === campo ? { "aria-invalid": true, "aria-describedby": idErro(campo) } : {});
  const motivoObrigatorio = status !== "ATENDIDO";

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
    setErro(null);
    await enviar(item, {
      status,
      quantidadeAtendida: status === "PARCIAL" ? qtd : undefined,
      observacaoLogistica: obs.trim() || null,
      pendenciaCompra: status !== "ATENDIDO" && pendencia,
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
        {corrigir && <Pills rotulo="Nova resposta" itens={opcoes.map(([v, label]) => ({ label, ativo: status === v, onSelect: () => setStatus(v) }))} />}
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
        {status !== "ATENDIDO" && <Checkbox id={`pendencia-${item.id}`} label="Gerar pendência de compra ou locação" checked={pendencia} onChange={setPendencia} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={confirmar} loading={pendente}>
          {corrigir ? "Salvar correção" : "Confirmar resposta"}
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
        <span className="text-muted">{quantidade > 1 ? `Descrição (todas as ${quantidade} unidades): ` : "Descrição: "}</span>
        {itens[0]}
      </p>
    );
  }
  const recolhivel = itens.length > RECOLHER_ACIMA;
  const mostradas = recolhivel && !aberto ? itens.slice(0, VISIVEIS_RECOLHIDO) : itens;
  return (
    <div>
      <p className="mb-1 mt-0 text-pequeno text-muted">
        Descrição de cada unidade <span className="numero">({itens.length})</span>
      </p>
      <ol className="m-0 grid list-none gap-x-6 gap-y-0.5 p-0 sm:grid-cols-2">
        {mostradas.map((d, n) => (
          <li key={n} className="flex min-w-0 gap-2 text-pequeno">
            <span aria-hidden className="numero w-5 shrink-0 text-right text-meta">
              {n + 1}
            </span>
            <span className="sr-only">Unidade {n + 1}: </span>
            <span className={cn("min-w-0 break-words", d ? "text-ink-2" : "text-meta")}>{d || "sem descrição"}</span>
          </li>
        ))}
      </ol>
      {recolhivel && (
        <Button variant="link" size="xs" className="mt-1" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Mostrar menos" : `Ver todas as ${itens.length}`}
        </Button>
      )}
    </div>
  );
}

const ROTULO_OPERACAO: Partial<Record<ItemOperacao, string>> = { ALTERAR_QUANTIDADE: "mudar quantidade", REMOVER: "remover da ata" };

export function ItemResposta({ item, semStatus = false }: { item: ItemParaResposta; semStatus?: boolean }) {
  const { foco, setFoco, edicao, setEdicao, enviar, pendente, compacto } = useResposta();
  const selecionado = foco === item.id;
  const editando = edicao?.id === item.id ? edicao : null;
  const emAnalise = item.status === "EM_ANALISE";
  const naAta = Boolean(item.aguardandoReuniao) && item.status === "ATENDIDO";
  const podeResponder = emAnalise && item.respondivel;
  const temContexto = Boolean(item.descricoes?.some((d) => d.trim()) || item.justificativa);
  const observacao = naAta ? "Aguarda conferência na reunião de OS." : item.observacaoLogistica;
  const rotuloOp = ROTULO_OPERACAO[item.operacao];

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`${item.descricao}, ${textoQuantidade(item)}${podeResponder ? ". Atalhos: A atende, P parcial, N não atende" : ""}`}
      aria-current={selecionado ? "true" : undefined}
      onClick={() => setFoco(item.id)}
      onFocus={(e) => {
        if (e.target === e.currentTarget) setFoco(item.id);
      }}
      className={cn(
        "relative border-b border-line-row py-4 transition-colors duration-150 last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        compacto ? "px-4" : "px-cartao",
        podeResponder && "cursor-pointer",
        selecionado ? "bg-selected before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : podeResponder && "hover:bg-subtle",
      )}
    >
      {/* Cabeçalho: o que foi pedido, quanto e o estado (um selo só). */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 break-words text-corpo font-medium text-ink">{item.descricao}</p>
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
            {!emAnalise && !naAta && item.operacao !== "REMOVER" && (
              <span>
                Atendido <Numero valor={item.quantidadeAtendida ?? 0} className={cn("font-semibold", item.status === "ATENDIDO" ? "text-success" : item.status === "PARCIAL" ? "text-warning" : "text-danger")} />
              </span>
            )}
            {item.destino && (
              <span className="inline-flex items-center gap-1">
                <Icone nome="local" className="size-3.5 text-ink-3" />
                {item.destino}
              </span>
            )}
          </p>
          {item.ajustes && (
            <p className="mb-0 mt-1 text-pequeno text-ink-2">
              <span className="text-muted">Peças ajustadas: </span>
              {item.ajustes}
            </p>
          )}
        </div>
        {!semStatus && <ItemStatusBadge status={item.status} naAta={naAta} className="shrink-0" />}
      </div>

      {/* O que o solicitante escreveu: descrições das unidades e observação. */}
      {temContexto && (
        <div className="mt-2.5 flex flex-col gap-2 rounded-controle border border-line-soft bg-subtle px-3 py-2.5">
          <DescricoesUnidades lista={item.descricoes} quantidade={item.quantidadeSolicitada} />
          {item.justificativa && (
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
