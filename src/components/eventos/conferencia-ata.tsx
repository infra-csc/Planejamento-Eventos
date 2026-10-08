"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { combinaBusca } from "@/lib/busca";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/badge";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { BarraProgresso, EmptyState, RodapeTabela } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { ajustarLinhaConferenciaAction, conferirLinhaAction, conferirTodasAction, editarDescricoesLinhaAction } from "@/app/(app)/eventos/actions";
import { IconButton } from "@/components/ui/icon-button";
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";
import { VincularCatalogo } from "./vincular-catalogo";
import { QuantidadeAta } from "@/components/eventos/quantidade-ata";
import { GRUPO_LABEL, GRUPOS_MATERIAL, type GrupoMaterial } from "@/domain/grupos-material";
import type { LinhaConferencia } from "@/server/services/conferencia";
import { conferenciaOpcional } from "@/domain/itens-padrao";
import { ACOMPANHANTES } from "@/domain/regras-kit";
import { MARCA_ACOMPANHANTE } from "@/components/solicitacoes/nova/utilidades";

/** Evento da página: leva ao campo "Pessoas presentes" do painel da reunião (que escuta e foca o campo). */
export const EVENTO_REGISTRAR_PRESENTES = "conferencia:registrar-presentes";
export const pedirRegistroDePresentes = () => window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR_PRESENTES));

/** Resultado de "conferir as restantes": avisa quando chegaram linhas novas depois que a tela abriu. */
const avisarTodas = (r: Awaited<ReturnType<typeof conferirTodasAction>>, rotulo: string) => {
  if (!r.ok) return toastErro(r.erro);
  toastSucesso(r.dados && r.dados.novas > 0 ? `${rotulo}. ${r.dados.novas} ${r.dados.novas === 1 ? "linha chegou" : "linhas chegaram"} depois e ${r.dados.novas === 1 ? "continua pendente" : "continuam pendentes"}: confira na lista.` : rotulo);
};

type Filtro = "todas" | "pendentes" | "conferidas";

const TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "fora do catálogo" } as const;
const areaDe = (l: LinhaConferencia) => l.areaNome ?? "Logística";
/** Estrutura e Tendas ficam juntas (todas as áreas numa seção só); o resto, por área. */
const secaoDe = (l: LinhaConferencia) => (l.grupo === "ESTRUTURA" || l.grupo === "TENDAS" ? GRUPO_LABEL[l.grupo] : areaDe(l));
const ordemSecao = (s: string) => (s === GRUPO_LABEL.ESTRUTURA ? 0 : s === GRUPO_LABEL.TENDAS ? 1 : 2);
/** Quem pediu a linha (ou quem incluiu na reunião). */
const pessoaDe = (l: LinhaConferencia) => l.origem?.solicitante ?? (l.regra ? "Regra da logística" : l.padrao ? "Item padrão da ata" : (l.incluidaPor ?? "Logística"));
const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
/** Origem em uma linha: "Produção · Ana Lima". */
const quemDe = (l: LinhaConferencia) => `${areaDe(l)} · ${l.origem?.solicitante ?? (l.regra ? "Regra da logística" : l.padrao ? "Item padrão da ata" : "Incluída na reunião")}`;

/** Nome da linha para leitor de tela e dicas: o item mais o local (ou o pedido, sem local) — duas linhas iguais não soam iguais. */
const rotuloLinha = (l: LinhaConferencia) => `${l.nome}${l.destino ? `, ${l.destino}` : l.origem ? `, ${l.origem.codigo}` : ""}`;

/** Realce rápido da linha que a pessoa acabou de pular para ("próxima a conferir"). */
function realcar(el: Element | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate([{ boxShadow: "inset 3px 0 0 var(--color-accent)", backgroundColor: "var(--color-accent-bg)" }, { boxShadow: "inset 3px 0 0 transparent", backgroundColor: "transparent" }], { duration: 1500, easing: "ease-out" });
}

/** Check da linha (40 px, alvo de toque em qualquer tela): um clique confere, outro desfaz. Otimista, volta se o servidor recusar. */
function Check({ l, onAlternar }: { l: LinhaConferencia; onAlternar: (id: string, v: boolean) => void }) {
  // Só anima depois de um clique (no carregamento, as já conferidas não "pulam").
  const [animar, setAnimar] = useState(false);
  const marcada = Boolean(l.conferidoEm);
  return (
    <button
      type="button"
      role="checkbox"
      data-check=""
      data-obrigatoria={conferenciaOpcional(l) ? undefined : ""}
      aria-checked={marcada}
      aria-label={`${rotuloLinha(l)}: ${marcada ? "conferido, clique para desfazer" : "marcar como conferido"}`}
      title={marcada ? `Conferido${l.conferidoPor ? ` por ${l.conferidoPor}` : ""} — clique para desfazer` : "Marcar como conferido (espaço)"}
      onClick={() => {
        const v = !marcada;
        setAnimar(v);
        onAlternar(l.id, v);
      }}
      className={cn(
        "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        marcada ? "border-success bg-success text-white hover:brightness-95" : "border-line-control bg-surface text-transparent hover:border-success hover:text-success/60",
        marcada && animar && "motion-safe:animate-marcar",
      )}
    >
      <Icone nome="check" tamanho={20} />
    </button>
  );
}

/** Modal da canetinha: nova quantidade + motivo (opcional); mostra o que a área vai ver. */
function AjusteModal({ l, eventoId, onFechar }: { l: LinhaConferencia; eventoId: string; onFechar: () => void }) {
  const [qtd, setQtd] = useState(l.quantidade);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const pedido = l.origem?.quantidadeSolicitada ?? null;
  const delta = qtd - l.quantidade;
  const efeito =
    delta === 0
      ? "Use − e + ou digite. 0 retira a linha da ata."
      : qtd === 0
        ? "A linha sai da ata."
        : pedido != null && qtd < pedido
          ? `A área vê "parcial: ${qtd} de ${pedido}"${motivo.trim() ? ", com o motivo" : ""}.`
          : pedido != null && qtd === pedido
            ? "A área vê o pedido atendido integralmente."
            : `A ata passa a ter ${qtd}.`;

  const salvar = () => {
    if (delta === 0) return;
    setErro(null);
    iniciar(async () => {
      // Vai junto a quantidade que a tela mostrava: se outra pessoa mudou a linha, o servidor recusa.
      const r = await ajustarLinhaConferenciaAction(eventoId, l.id, qtd, motivo, l.quantidade);
      if (!r.ok) return setErro(r.erro);
      toastSucesso(qtd === 0 ? `${l.nome} retirado da ata` : `${l.nome}: ${l.quantidade} → ${qtd}`);
      onFechar();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={`Ajustar ${l.nome}`} description={[l.destino, quemDe(l)].filter(Boolean).join(" · ")} width={480}>
        <div className="flex flex-col gap-4">
          <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-controle border border-line-soft">
            <div className="bg-subtle px-3.5 py-2.5">
              <dt className="text-pequeno text-muted">Na ata agora</dt>
              <dd className="m-0 text-destaque font-semibold text-ink">
                <QuantidadeAta valor={l.quantidade} />
              </dd>
            </div>
            <div className="border-l border-line-soft bg-subtle px-3.5 py-2.5">
              <dt className="text-pequeno text-muted">{l.origem ? <>Pedido em <Codigo>{l.origem.codigo}</Codigo></> : "Origem"}</dt>
              <dd className={cn("m-0", pedido != null ? "numero text-destaque font-semibold text-ink" : "pt-1 text-pequeno text-ink-2")}>{pedido ?? "incluída na reunião"}</dd>
            </div>
          </dl>

          <Field label="Nova quantidade" htmlFor="qtd-ajuste" hint={efeito}>
            <span className="flex items-center gap-3">
              <Stepper id="qtd-ajuste" valor={qtd} onChange={setQtd} min={0} tamanho="md" autoFocus />
              {delta !== 0 && (
                <span className={cn("numero rounded-chip px-2 py-0.5 text-pequeno font-semibold motion-safe:animate-fade-up-rapido", delta < 0 ? "bg-warning-bg text-warning" : "bg-success-bg text-success")} aria-live="polite">
                  {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                </span>
              )}
            </span>
          </Field>

          <Field label="Motivo" htmlFor="motivo-ajuste" optional hint="Se escrever, vai para o histórico e para quem pediu.">
            <Textarea id="motivo-ajuste" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: só 3 disponíveis na data; o 4º vem de locação" className="min-h-[76px]" />
          </Field>

          <FormError message={erro} />
        </div>
        <DialogFooter>
          <Button variant="primary" size="lg" onClick={salvar} loading={pendente} disabled={delta === 0} motivoDesabilitado="Altere a quantidade para salvar">
            Salvar ajuste
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" size="lg" disabled={pendente}>
              Cancelar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Administrador corrige a descrição das unidades que veio do pedido: cada texto com quantas unidades levam ele. */
function DescricaoModal({ l, eventoId, onFechar }: { l: LinhaConferencia; eventoId: string; onFechar: () => void }) {
  const total = l.quantidade > 0 ? l.quantidade : (l.origem?.quantidadeSolicitada ?? 1);
  const [grupos, setGrupos] = useState(() => (l.origem?.descricoes.length ? l.origem.descricoes.map((g) => ({ ...g })) : [{ texto: "", unidades: total }]));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const soma = grupos.reduce((a, g) => a + (g.texto.trim() ? g.unidades : 0), 0);
  const mudar = (n: number, patch: Partial<{ texto: string; unidades: number }>) => setGrupos((gs) => gs.map((g, i) => (i === n ? { ...g, ...patch } : g)));

  const salvar = () => {
    setErro(null);
    iniciar(async () => {
      const r = await editarDescricoesLinhaAction(eventoId, l.id, grupos);
      if (!r.ok) return setErro(r.erro);
      toastSucesso(r.dados?.mudou === false ? "A descrição já estava assim." : `Descrição de ${l.nome} atualizada`);
      onFechar();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={`Descrição de ${l.nome}`} description={`${l.origem ? `Pedido ${l.origem.codigo} · ${l.origem.solicitante}. ` : ""}Fica no histórico com seu nome, e quem pediu passa a ver a descrição nova.`} width={560}>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[112px_minmax(0,1fr)_36px] gap-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Unidades</span>
            <span>Descrição</span>
            <span />
          </div>
          {grupos.map((g, n) => (
            <div key={n} className="grid grid-cols-[112px_minmax(0,1fr)_36px] items-center gap-2 motion-safe:animate-fade-up-rapido">
              <Stepper tamanho="sm" valor={g.unidades} min={1} onChange={(v) => mudar(n, { unidades: v })} label={`Unidades da descrição ${n + 1}`} />
              <Input value={g.texto} maxLength={300} onChange={(e) => mudar(n, { texto: e.target.value })} placeholder="Ex.: PALCO, arte da marca, 2×1 m" aria-label={`Descrição ${n + 1}`} autoFocus={n === 0} />
              {grupos.length > 1 ? (
                <IconButton label={`Tirar a descrição ${n + 1}`} onClick={() => setGrupos((gs) => gs.filter((_, i) => i !== n))}>
                  <Icone nome="lixeira" />
                </IconButton>
              ) : (
                <span />
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setGrupos((gs) => [...gs, { texto: "", unidades: 1 }])}>
            <Icone nome="mais" />
            Outra descrição
          </Button>
          <p className={cn("m-0 text-pequeno", grupos.length > 1 && soma !== total ? "text-warning" : "text-muted")}>
            {grupos.length === 1 ? (total === 1 ? "" : `Uma descrição só vale para todas as ${total} unidades. `) : `${soma} de ${total} unidades descritas. `}Deixe em branco para tirar a descrição.
          </p>
          <FormError message={erro} />
        </div>
        <DialogFooter>
          <Button variant="primary" size="lg" onClick={salvar} loading={pendente}>
            Salvar descrição
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" size="lg" disabled={pendente}>
              Cancelar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Grade da linha. Celular (cartão): check · item · qtd, e as ações numa faixa abaixo, alinhadas ao texto.
 * md+: check · item · local · qtd · ações, numa linha só. Larguras fixas: alinham em todas as linhas
 * (também nas recuadas dos blocos por item).
 */
const GRADE = "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[40px_minmax(0,1fr)_150px_56px_116px]";
/** Linha conferida ganha um fundo verde quase imperceptível; pendente fica neutra (a maioria é pendente). */
const fundoLinha = (conferida: boolean) => cn("border-b border-line-row px-cartao py-3 transition-colors duration-200 last:border-b-0 md:py-2.5", conferida ? "bg-success-bg/40 hover:bg-success-bg/70" : "hover:bg-subtle");

/** Descrição das unidades como quem pediu escreveu: uma linha por texto, com quantas unidades levam ele. */
function Descricoes({ grupos }: { grupos: ReadonlyArray<{ texto: string; unidades: number }> }) {
  const total = grupos.reduce((a, g) => a + g.unidades, 0);
  if (grupos.length === 1)
    return (
      <p className="m-0 mt-1 whitespace-pre-line break-words text-pequeno text-ink-2">
        <span className="text-muted">{total > 1 ? `Descrição (as ${total}): ` : "Descrição: "}</span>
        {grupos[0].texto || <span className="text-meta">sem descrição</span>}
      </p>
    );
  return (
    <div className="mt-1.5 text-pequeno">
      <span className="text-muted">Descrição por unidade</span>
      <ul className="m-0 mt-0.5 grid list-none gap-px p-0">
        {grupos.map((g, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className="numero w-7 shrink-0 text-right text-muted">{g.unidades}×</span>
            <span className="min-w-0 whitespace-pre-line break-words text-ink-2">{g.texto || <span className="text-meta">sem descrição</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Quem pediu (ou quem incluiu na reunião), com o link para a solicitação de origem. */
function PedidoPor({ l, semPessoa = false }: { l: LinhaConferencia; semPessoa?: boolean }) {
  if (l.origem)
    return (
      <>
        {!semPessoa && <>{quemDe(l)} · </>}
        <Link href={`/solicitacoes/${l.origem.solicitacaoId}`} className="text-ink-3 no-underline hover:text-accent hover:underline">
          <Codigo>{l.origem.codigo}</Codigo>
        </Link>
      </>
    );
  if (semPessoa) return null;
  if (l.regra) return <>Regra da logística · {l.regra}</>;
  if (l.padrao) return <>Item padrão de toda ata</>;
  return <>Incluída na reunião{l.incluidaPor ? ` · ${l.incluidaPor}` : ""}</>;
}

/** Ações de uma linha, sempre na mesma ordem e com o mesmo peso: ajustar a quantidade e abrir as peças. */
function AcoesLinha({ l, eventoId, editavel, onAjustar }: { l: LinhaConferencia; eventoId: string; editavel: boolean; onAjustar: (l: LinhaConferencia) => void }) {
  return (
    <>
      {editavel && (
        <Button variant="ghost" size="xs" onClick={() => onAjustar(l)} aria-label={`Ajustar a quantidade de ${rotuloLinha(l)}`} title="Ajustar a quantidade">
          <Icone nome="lapis" />
          <span className="md:sr-only">Ajustar</span>
        </Button>
      )}
      {l.tipo === "PROJETO" && (
        <Link
          href={`/eventos/${eventoId}/itens/${l.id}`}
          className="inline-flex h-[27px] items-center gap-1.5 rounded-controle px-2 text-pequeno font-medium text-ink-2 no-underline transition-colors hover:bg-black/[0.04] hover:text-ink max-md:min-h-10"
          title={`Peças de ${l.nome} nesta linha: ajuste peça a peça e histórico`}
        >
          <Icone nome="camadas" />
          Peças
        </Link>
      )}
    </>
  );
}

function Linha({
  l,
  eventoId,
  editavel,
  onMudou,
  onAjustar,
  opcoes,
  podeCadastrar,
  emGrupo = false,
  origemComum = false,
  solComum = false,
  ajustesNoBloco = false,
  onEditarDescricao,
}: {
  /** No bloco, todas as linhas vêm do mesmo pedido: o código fica só no cabeçalho. */
  solComum?: boolean;
  /** As peças ajustadas são iguais em todas as linhas do bloco: o resumo fica só no cabeçalho. */
  ajustesNoBloco?: boolean;
  /** Administrador: corrigir a descrição das unidades (só linha que veio de pedido). */
  onEditarDescricao?: (l: LinhaConferencia) => void;
  /** Dentro do bloco do item: o nome já está no cabeçalho; o rótulo da linha é o local (o que muda entre elas). */
  emGrupo?: boolean;
  /** No bloco, todas as linhas vêm da mesma pessoa e pedido: a origem fica só no cabeçalho. */
  origemComum?: boolean;
  l: LinhaConferencia;
  eventoId: string;
  editavel: boolean;
  onMudou: (id: string, v: boolean) => void;
  onAjustar: (l: LinhaConferencia) => void;
  opcoes: OpcoesReferencia;
  podeCadastrar: boolean;
}) {
  const conferida = Boolean(l.conferidoEm);
  const pedidoDiferente = l.origem && l.origem.quantidadeSolicitada !== l.quantidade;
  const dicas = [l.origem?.ajustes && !ajustesNoBloco ? `Peças ajustadas: ${l.origem.ajustes}` : null, l.ultimoAjuste ? `Ajustado por ${l.ultimoAjuste.por}: ${l.ultimoAjuste.descricao}` : null].filter(Boolean).join(" · ");
  const opcional = conferenciaOpcional(l);
  const marcaOpcional = opcional && !conferida && (
    <span className="text-rotulo text-muted" title="Não precisa estar conferida para fechar a ata.">
      {l.quantidade === 0 ? "a definir · opcional" : "opcional"}
    </span>
  );
  return (
    <li data-linha={l.id} className={cn(GRADE, fundoLinha(conferida))}>
      {editavel ? (
        <Check l={l} onAlternar={onMudou} />
      ) : (
        <span role="img" aria-label={conferida ? "Conferido" : "Não conferido"} className={cn("grid size-10 place-items-center rounded-full border-2", conferida ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
          <Icone nome="check" tamanho={20} />
        </span>
      )}

      <div className="min-w-0">
        {emGrupo ? (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-corpo font-medium text-ink">
            <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="text-ink no-underline hover:text-accent hover:underline" title={`Detalhes desta linha de ${l.nome}`}>
              {l.destino ?? "Sem local informado"}
            </Link>
            {marcaOpcional}
          </p>
        ) : (
          <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="line-clamp-2 min-w-0 text-corpo font-medium text-ink no-underline hover:text-accent hover:underline" title={`Detalhes, peças e histórico de ${l.nome}`}>
              {l.nome}
            </Link>
            {l.tipo === "AVULSO" && <Tag tom="warning">{TIPO[l.tipo]}</Tag>}
            {l.codigo && <Codigo className="hidden text-rotulo text-muted xl:inline">{l.codigo}</Codigo>}
            {marcaOpcional}
          </p>
        )}
        {!(emGrupo && origemComum && (!l.origem || solComum)) && (
          <p className="m-0 mt-0.5 break-words text-pequeno text-ink-3">
            {!emGrupo && <span className="md:hidden">{l.destino ? `${l.destino} · ` : ""}</span>}
            <PedidoPor l={l} semPessoa={emGrupo && origemComum} />
          </p>
        )}
        {/* O que quem pediu escreveu: descrição das unidades e observação, inteiras (a reunião confere por elas). */}
        {l.origem && l.origem.descricoes.length > 0 && <Descricoes grupos={l.origem.descricoes} />}
        {l.origem?.observacao && <ObservacaoLinha texto={l.origem.observacao} codigo={l.codigo} />}
        {dicas && (
          <p title={dicas} className={cn("m-0 mt-1 line-clamp-2 text-rotulo", l.ultimoAjuste ? "text-warning" : "text-muted")}>
            {l.ultimoAjuste && <Icone nome="lapis" className="mr-1 inline size-3 align-[-2px]" />}
            {dicas}
          </p>
        )}
        {onEditarDescricao && l.origem && (
          <button type="button" onClick={() => onEditarDescricao(l)} className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-chip border-0 bg-transparent p-0 text-rotulo text-ink-3 transition-colors hover:text-accent">
            <Icone nome="lapis" className="size-3" />
            {l.origem.descricoes.length ? "Editar descrição" : "Adicionar descrição"}
          </button>
        )}
      </div>

      <span className="hidden break-words text-pequeno text-ink-2 md:line-clamp-2" title={l.destino ?? undefined}>
        {emGrupo ? null : (l.destino ?? <span className="text-meta">—</span>)}
      </span>

      <span className="text-right">
        <span className="block text-secao font-semibold text-ink">
          <QuantidadeAta valor={l.quantidade} />
        </span>
        {pedidoDiferente && <span className="numero block text-rotulo text-muted">pedido {l.origem!.quantidadeSolicitada}</span>}
      </span>

      <span className="col-span-full flex flex-wrap items-center justify-start gap-1 pl-[52px] empty:hidden md:col-span-1 md:flex-nowrap md:justify-end md:pl-0">
        {editavel && l.tipo === "AVULSO" && <VincularCatalogo compacto linha={{ linhaId: l.id, descricao: l.nome, quantidade: l.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />}
        <AcoesLinha l={l} eventoId={eventoId} editavel={editavel} onAjustar={onAjustar} />
      </span>
    </li>
  );
}

/**
 * Observação de linha que veio sozinha com outra (cocho → cavaletes): mostra a regra como regra, não como
 * se fosse um texto digitado ("Vem junto (2 por cocho)" nas linhas antigas).
 */
function ObservacaoLinha({ texto, codigo }: { texto: string; codigo: string | null }) {
  if (!texto.startsWith(MARCA_ACOMPANHANTE))
    return (
      <p className="m-0 mt-0.5 whitespace-pre-line break-words text-pequeno text-ink-2">
        <span className="text-muted">Obs.: </span>
        {texto}
      </p>
    );
  const regra = ACOMPANHANTES.find((a) => a.acompanhante === codigo)?.texto ?? texto.replace(/^Vem junto\s*\(?|\)$/g, "");
  return (
    <p className="m-0 mt-0.5 flex items-center gap-1.5 text-pequeno text-ink-3">
      <Icone nome="camadas" className="size-3.5 shrink-0 text-ink-3" />
      <span>
        <span className="font-medium text-ink-2">Automático</span> · {regra}
      </span>
    </p>
  );
}

/** Partes de "+4 Fechamento lateral · −1 Calha de lona" (o resumo dos ajustes de peças). */
const partesAjuste = (l: LinhaConferencia) => (l.origem?.ajustes ? l.origem.ajustes.split(" · ") : []);

/**
 * Linhas do mesmo pedido, mesma pessoa e mesmo local numa linha só (ex.: 2 tendas 5×5 da SOL-0045 no
 * Depósito). Quando as unidades não têm as mesmas peças (uma sem calha), um alerta mostra a diferença;
 * cada linha continua com o próprio ajuste, peças e descrição.
 */
function LinhaJunta({
  ls,
  eventoId,
  editavel,
  onConferir,
  onAjustar,
  onEditarDescricao,
  origemComum,
}: {
  ls: readonly LinhaConferencia[];
  eventoId: string;
  editavel: boolean;
  onConferir: (ls: readonly LinhaConferencia[], v: boolean) => void;
  onAjustar: (l: LinhaConferencia) => void;
  onEditarDescricao?: (l: LinhaConferencia) => void;
  origemComum: boolean;
}) {
  const l0 = ls[0];
  const ok = ls.filter((l) => l.conferidoEm).length;
  const conferida = ok === ls.length;
  const total = ls.reduce((a, l) => a + l.quantidade, 0);
  const pedido = ls.reduce((a, l) => a + (l.origem?.quantidadeSolicitada ?? l.quantidade), 0);
  // Descrições somadas por texto (as mesmas 2 tendas "azul" de duas linhas viram "2× azul").
  const descricoes = new Map<string, number>();
  for (const l of ls) for (const d of l.origem?.descricoes ?? []) descricoes.set(d.texto, (descricoes.get(d.texto) ?? 0) + d.unidades);
  const observacoes = [...new Set(ls.map((l) => l.origem?.observacao).filter((o): o is string => Boolean(o)))];
  // Variações de peças: o que é comum a todas fica numa linha; o que muda vira alerta.
  const variantes = new Map<string, LinhaConferencia[]>();
  for (const l of ls) variantes.set(l.origem?.ajustes ?? "", [...(variantes.get(l.origem?.ajustes ?? "") ?? []), l]);
  const comuns = partesAjuste(l0).filter((p) => ls.every((l) => partesAjuste(l).includes(p)));
  const diferentes = variantes.size > 1;
  const ajustadas = ls.filter((l) => l.ultimoAjuste);
  return (
    <li data-linha={l0.id} className={cn(GRADE, fundoLinha(conferida))}>
      {editavel ? (
        <button
          type="button"
          role="checkbox"
          data-check=""
          data-obrigatoria=""
          aria-checked={conferida ? true : ok > 0 ? "mixed" : false}
          aria-label={`${rotuloLinha(l0)}, ${ls.length} linhas: ${conferida ? "conferidas, clique para desfazer" : "marcar todas como conferidas"}`}
          title={conferida ? "Conferidas — clique para desfazer" : `Marcar as ${ls.length} linhas como conferidas`}
          onClick={() => onConferir(ls, !conferida)}
          className={cn(
            "relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-95 disabled:cursor-progress",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            conferida ? "border-success bg-success text-white hover:brightness-95" : ok > 0 ? "border-success bg-success-bg text-success" : "border-line-control bg-surface text-transparent hover:border-success hover:text-success/60",
          )}
        >
          {ok > 0 && !conferida ? <span className="numero text-rotulo font-semibold">{ok}/{ls.length}</span> : <Icone nome="check" tamanho={20} />}
        </button>
      ) : (
        <span role="img" aria-label={conferida ? "Conferido" : `${ok} de ${ls.length} conferidas`} className={cn("grid size-10 place-items-center rounded-full border-2", conferida ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
          <Icone nome="check" tamanho={20} />
        </span>
      )}

      <div className="min-w-0">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-corpo font-medium text-ink">
          {l0.destino ?? "Sem local informado"}
          <span className="numero rounded-chip bg-control px-1.5 py-px text-rotulo font-normal text-ink-3">{ls.length} linhas</span>
        </p>
        <p className="m-0 mt-0.5 truncate text-pequeno text-ink-3">
          <PedidoPor l={l0} semPessoa={origemComum} />
        </p>
        {descricoes.size > 0 && <Descricoes grupos={[...descricoes.entries()].map(([texto, unidades]) => ({ texto, unidades }))} />}
        {observacoes.map((o) => (
          <ObservacaoLinha key={o} texto={o} codigo={l0.codigo} />
        ))}
        {comuns.length > 0 && <p className="m-0 mt-1 text-rotulo text-muted">Peças ajustadas{diferentes ? " em todas" : ""}: {comuns.join(" · ")}</p>}
        {diferentes && (
          <div role="note" className="mt-1.5 rounded-controle border border-warning-border bg-warning-bg px-2.5 py-1.5 text-pequeno text-warning">
            <p className="m-0 flex items-center gap-1.5 font-medium">
              <Icone nome="alerta" className="size-3.5 shrink-0" />
              As unidades não são iguais
            </p>
            <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0 text-ink-2">
              {[...variantes.values()].map((vs) => {
                const extras = partesAjuste(vs[0]).filter((p) => !comuns.includes(p));
                const q = vs.reduce((a, l) => a + l.quantidade, 0);
                const quais = [...new Set(vs.flatMap((l) => (l.origem?.descricoes ?? []).map((d) => d.texto)).filter(Boolean))].join(", ");
                return (
                  <li key={vs[0].id} className="flex gap-1.5">
                    <span className="numero shrink-0 font-medium text-ink">{q} un.</span>
                    <span className="min-w-0">
                      {quais && <span className="text-ink">{quais}: </span>}
                      {extras.length ? extras.join(" · ") : variantes.size === 2 ? "sem esse ajuste" : "sem ajuste a mais"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {ajustadas.map((l) => (
          <p key={l.id} className="m-0 mt-0.5 line-clamp-2 text-rotulo text-warning">
            <Icone nome="lapis" className="mr-1 inline size-3 align-[-2px]" />
            Ajustado por {l.ultimoAjuste!.por}: {l.ultimoAjuste!.descricao}
          </p>
        ))}
        {/* Cada linha segue com o próprio ajuste de quantidade, peças e descrição. */}
        <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-pequeno">
          {ls.map((l, i) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-ink-3">
              <span className="numero mr-1 inline-flex items-center gap-1">
                {l.conferidoEm ? <Icone nome="check" className="size-3.5 text-success" /> : <span aria-hidden className="inline-block size-3.5 rounded-full border border-line-control" />}
                Linha {i + 1} · {l.quantidade} un.
              </span>
              <AcoesLinha l={l} eventoId={eventoId} editavel={editavel} onAjustar={onAjustar} />
              {onEditarDescricao && l.origem && (
                <Button variant="ghost" size="xs" onClick={() => onEditarDescricao(l)}>
                  Descrição
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <span className="hidden md:block" />

      <span className="text-right">
        <span className="block text-secao font-semibold text-ink">
          <QuantidadeAta valor={total} />
        </span>
        {pedido !== total && <span className="numero block text-rotulo text-muted">pedido {pedido}</span>}
      </span>
      <span className="hidden md:block" />
    </li>
  );
}

/**
 * Conferência da ata na reunião de OS — usada ao vivo, então vale velocidade: check grande por linha,
 * progresso e a próxima ação sempre à vista (barra fixa no topo ao rolar), "próxima a conferir",
 * ↑/↓ entre as linhas, filtros numa faixa só. A canetinha ajusta a quantidade com log. A ata só fecha
 * com as linhas obrigatórias conferidas.
 */
export function ConferenciaAta({
  eventoId,
  linhas: iniciais,
  editavel,
  opcoes,
  areas,
  podeCadastrar = false,
  podeEditarDescricao = false,
  presentesOk = true,
}: {
  eventoId: string;
  /** Administrador corrige a descrição das unidades na conferência. */
  podeEditarDescricao?: boolean;
  linhas: LinhaConferencia[];
  editavel: boolean;
  opcoes: OpcoesReferencia;
  areas: Array<{ id: string; nome: string }>;
  podeCadastrar?: boolean;
  /** "Pessoas presentes" preenchido: com tudo conferido, a barra leva ao campo se faltar. */
  presentesOk?: boolean;
}) {
  // Estado local só para a resposta imediata do check; a revalidação do servidor substitui a lista.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [base, setBase] = useState(iniciais);
  if (base !== iniciais) {
    setBase(iniciais);
    // Só sai da marcação local o que o servidor já confirmou: uma resposta de um clique anterior não pode
    // desfazer, na tela, os cliques seguintes que ainda estão a caminho (as linhas "piscavam" de volta).
    const doServidor = new Map(iniciais.map((l) => [l.id, Boolean(l.conferidoEm)]));
    setOverride((o) => Object.fromEntries(Object.entries(o).filter(([id, v]) => doServidor.has(id) && doServidor.get(id) !== v)));
  }
  const linhas = useMemo(() => iniciais.map((l) => (l.id in override ? { ...l, conferidoEm: override[l.id] ? (l.conferidoEm ?? new Date().toISOString()) : null, conferidoPor: override[l.id] ? l.conferidoPor : null } : l)), [iniciais, override]);
  const listaRef = useRef<HTMLDivElement>(null);

  /*
   * Fila das gravações da conferência: uma por vez, na ordem dos cliques. Cliques rápidos em várias linhas
   * disparavam várias ações do servidor ao mesmo tempo e só a primeira chegava (as outras se perdiam sem
   * aviso). A tela muda na hora (marcação local); a fila grava atrás e desfaz só o que o servidor recusar.
   */
  type Tarefa = { tipo: "um"; id: string; v: boolean } | { tipo: "lote"; ids: string[]; rotulo: string };
  const fila = useRef<Tarefa[]>([]);
  const rodando = useRef(false);
  const processarFila = async () => {
    if (rodando.current) return;
    rodando.current = true;
    try {
      while (fila.current.length) {
        const t = fila.current.shift()!;
        if (t.tipo === "um") {
          // A mesma linha clicada de novo mais adiante na fila: vale o último clique.
          if (fila.current.some((x) => x.tipo === "um" && x.id === t.id)) continue;
          const r = await conferirLinhaAction(eventoId, t.id, t.v).catch(() => ({ ok: false as const, erro: "Sem conexão: a marcação não foi gravada. Marque de novo." }));
          if (!r.ok) {
            setOverride((o) => ({ ...o, [t.id]: !t.v }));
            toastErro(r.erro);
          } else if (t.v && !fila.current.length && r.dados && r.dados.conferidas === r.dados.total) {
            toastSucesso("Tudo conferido. Registre os presentes e feche a ata.");
          }
        } else {
          const r = await conferirTodasAction(eventoId, t.ids).catch(() => ({ ok: false as const, erro: "Sem conexão: as linhas não foram marcadas. Tente de novo." }));
          if (!r.ok) setOverride((o) => ({ ...o, ...Object.fromEntries(t.ids.map((id) => [id, false])) }));
          avisarTodas(r, t.rotulo);
        }
      }
    } finally {
      rodando.current = false;
    }
  };
  // Marcações ainda a caminho: fechar ou recarregar a página pede confirmação (senão se perdiam).
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (rodando.current || fila.current.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);
  const enfileirar = (t: Tarefa) => {
    fila.current.push(t);
    void processarFila();
  };
  const mudou = (id: string, v: boolean) => {
    setOverride((o) => ({ ...o, [id]: v }));
    enfileirar({ tipo: "um", id, v });
  };

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [area, setArea] = useState("");
  const [pessoa, setPessoa] = useState("");
  // Separação dos materiais como na lista da ata (Estrutura, Tendas, Ativação, Percurso, Arena).
  const [grupo, setGrupo] = useState<GrupoMaterial | "">("");
  const [busca, setBusca] = useState("");
  const [ajustando, setAjustando] = useState<LinhaConferencia | null>(null);
  const [descrevendo, setDescrevendo] = useState<LinhaConferencia | null>(null);
  const editarDescricao = podeEditarDescricao ? setDescrevendo : undefined;
  const [incluir, setIncluir] = useState(false);
  const [confirmarTodas, setConfirmarTodas] = useState(false);

  // Progresso sobre as linhas obrigatórias: "a definir" e estaiamento não travam o fechamento.
  const obrigatorias = linhas.filter((l) => !conferenciaOpcional(l));
  const conferidas = obrigatorias.filter((l) => l.conferidoEm).length;
  const pendentes = obrigatorias.length - conferidas;
  const pct = obrigatorias.length ? Math.round((conferidas / obrigatorias.length) * 100) : 0;
  const completo = obrigatorias.length > 0 && pendentes === 0;
  const opcionais = linhas.length - obrigatorias.length;
  // Contagens dos filtros sobre a lista toda (com as opcionais): o número da pílula é o que a lista mostra.
  const nPendentesLista = linhas.filter((l) => !l.conferidoEm).length;
  const nConferidasLista = linhas.length - nPendentesLista;
  const areasNaAta = useMemo(() => [...new Set(linhas.map(areaDe))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const areaAtiva = area && areasNaAta.includes(area) ? area : "";
  const pessoasNaAta = useMemo(() => [...new Set(linhas.map(pessoaDe))].sort(porNome), [linhas]);
  const pessoaAtiva = pessoa && pessoasNaAta.includes(pessoa) ? pessoa : "";
  const gruposNaAta = useMemo(() => GRUPOS_MATERIAL.filter((g) => linhas.some((l) => l.grupo === g)), [linhas]);
  const grupoAtivo = grupo && gruposNaAta.includes(grupo) ? grupo : "";

  const visiveis = useMemo(
    () =>
      linhas.filter(
        (l) =>
          (filtro === "pendentes" ? !l.conferidoEm : filtro === "conferidas" ? Boolean(l.conferidoEm) : true) &&
          (!areaAtiva || areaDe(l) === areaAtiva) &&
          (!pessoaAtiva || pessoaDe(l) === pessoaAtiva) &&
          (!grupoAtivo || l.grupo === grupoAtivo) &&
          (!busca.trim() || combinaBusca(`${l.nome} ${l.codigo ?? ""} ${l.destino ?? ""} ${l.areaNome ?? ""} ${l.origem?.codigo ?? ""} ${l.origem?.solicitante ?? ""} ${l.origem?.descricao ?? ""}`, busca)),
      ),
    [linhas, filtro, areaAtiva, pessoaAtiva, grupoAtivo, busca],
  );

  // Seção por área; dentro, um bloco por item (mesmo projeto/peça) em ordem alfabética; no bloco, por local e pessoa.
  // A ordem só depende de área, nome, local e pessoa: conferir uma linha não a tira do lugar.
  const secoes = useMemo(() => {
    const porArea = new Map<string, LinhaConferencia[]>();
    for (const l of visiveis) porArea.set(secaoDe(l), [...(porArea.get(secaoDe(l)) ?? []), l]);
    return [...porArea.entries()]
      .sort(([a], [b]) => ordemSecao(a) - ordemSecao(b) || porNome(a, b))
      .map(([area, doArea]) => {
        const porItem = new Map<string, LinhaConferencia[]>();
        for (const l of doArea) {
          const k = `${l.tipo}|${l.codigo ?? l.nome}`;
          porItem.set(k, [...(porItem.get(k) ?? []), l]);
        }
        const itens = [...porItem.entries()]
          .map(([k, ls]) => [k, [...ls].sort((a, b) => porNome(a.destino ?? "", b.destino ?? "") || porNome(pessoaDe(a), pessoaDe(b)) || a.id.localeCompare(b.id))] as const)
          .sort(([, a], [, b]) => porNome(a[0].nome, b[0].nome));
        return { area, itens };
      });
  }, [visiveis]);
  // Contagem por seção sobre a ata inteira (não só o recorte) e só das obrigatórias, como o progresso.
  const totalArea = (a: string) => {
    const ls = linhas.filter((l) => secaoDe(l) === a && !conferenciaOpcional(l));
    return { ok: ls.filter((l) => l.conferidoEm).length, n: ls.length };
  };
  const filtrando = filtro !== "todas" || Boolean(areaAtiva) || Boolean(pessoaAtiva) || Boolean(grupoAtivo) || Boolean(busca.trim());
  const limparFiltros = () => {
    setFiltro("todas");
    setArea("");
    setPessoa("");
    setGrupo("");
    setBusca("");
  };
  const conferirGrupo = (ls: readonly LinhaConferencia[]) => {
    const ids = ls.filter((l) => !l.conferidoEm).map((l) => l.id);
    if (!ids.length) return;
    setOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, true])) }));
    enfileirar({ tipo: "lote", ids, rotulo: `${ls[0].nome}: ${ids.length} ${ids.length === 1 ? "linha conferida" : "linhas conferidas"}` });
  };

  // Várias linhas de uma vez (linha junta): marca as que faltam ou desmarca todas.
  const conferirVarias = (ls: readonly LinhaConferencia[], v: boolean) => {
    if (v) return conferirGrupo(ls);
    for (const l of ls) if (l.conferidoEm) mudou(l.id, false);
  };
  // Dentro do bloco do item: linhas do mesmo pedido, pessoa e local ficam juntas.
  const juntar = (ls: readonly LinhaConferencia[]) => {
    const m = new Map<string, LinhaConferencia[]>();
    for (const l of ls) {
      const k = l.origem ? `${l.origem.solicitacaoId}|${l.destino ?? ""}|${pessoaDe(l)}` : l.id;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.values()];
  };

  /** Leva à próxima linha obrigatória sem conferir (na ordem da lista) e põe o foco no check dela. */
  const irParaProxima = () => {
    const alvo = listaRef.current?.querySelector<HTMLButtonElement>('[data-check][data-obrigatoria][aria-checked="false"], [data-check][data-obrigatoria][aria-checked="mixed"]');
    if (!alvo) {
      // Pode estar escondida pelo filtro: volta a mostrar tudo e tenta de novo depois de renderizar.
      if (filtrando) {
        limparFiltros();
        requestAnimationFrame(() => requestAnimationFrame(irParaProxima));
      }
      return;
    }
    alvo.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    alvo.focus({ preventScroll: true });
    realcar(alvo.closest("li"));
  };

  /** ↑/↓ (ou J/K) andam entre os checks da lista; espaço marca. Para a reunião conferir sem o mouse. */
  const navegarComTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const atual = e.target as HTMLElement;
    if (!atual.matches("[data-check]")) return;
    const dir = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
    if (!dir) return;
    const todos = [...(listaRef.current?.querySelectorAll<HTMLButtonElement>("[data-check]") ?? [])];
    const prox = todos[todos.indexOf(atual as HTMLButtonElement) + dir];
    if (!prox) return;
    e.preventDefault();
    prox.focus({ preventScroll: true });
    prox.scrollIntoView({ block: "nearest" });
  };

  return (
    <section className="min-w-0 rounded-cartao border border-line bg-surface" aria-label="Conferência da ata">
      {/* Barra fixa: progresso e a próxima ação continuam à vista enquanto a lista rola (a reunião acompanha por ela). */}
      <div className="sticky top-14 z-10 rounded-t-cartao border-b border-line-soft bg-surface/95 px-cartao pb-3 pt-3.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="min-w-0" aria-live="polite">
            {completo ? (
              <p className="m-0 flex items-center gap-2 text-corpo font-semibold text-success">
                <span aria-hidden className="grid size-6 place-items-center rounded-full bg-success text-white motion-safe:animate-marcar">
                  <Icone nome="check" className="size-3.5" />
                </span>
                Tudo conferido
                <span className="numero font-normal text-ink-3">· {obrigatorias.length} linhas</span>
              </p>
            ) : (
              <p className="m-0 flex items-baseline gap-1.5">
                <span className="numero text-titulo font-semibold tracking-[-0.01em] text-ink">{conferidas}</span>
                <span className="text-corpo text-ink-2">
                  de <span className="numero">{obrigatorias.length}</span> conferidas
                </span>
                <span className="numero text-pequeno text-muted">· faltam {pendentes}</span>
              </p>
            )}
            {(opcionais > 0 || (completo && !presentesOk)) && (
              <p className="m-0 mt-0.5 text-rotulo text-muted">
                {completo && !presentesOk ? (
                  <button type="button" onClick={pedirRegistroDePresentes} className="cursor-pointer border-0 bg-transparent p-0 font-medium text-warning hover:underline">
                    Falta registrar os presentes para fechar a ata →
                  </button>
                ) : (
                  <span title="Linhas a definir (quantidade 0) e estaiamento: podem ser conferidas, mas não travam o fechamento da ata.">
                    + {opcionais} {opcionais === 1 ? "linha opcional" : "linhas opcionais"} (a definir e estaiamento), fora da contagem
                  </span>
                )}
              </p>
            )}
          </div>
          {editavel && (
            // Celular: "Próxima" e "Incluir" lado a lado; "Conferir as restantes" (ação de lote, menos usada) logo abaixo.
            <span className="ml-auto flex flex-wrap items-center gap-1.5 max-sm:grid max-sm:w-full max-sm:grid-cols-2">
              {pendentes > 0 && (
                <Button variant="ghost" size="sm" onClick={irParaProxima} title="Leva à próxima linha sem conferir (↑ ↓ andam entre as linhas)" className="max-sm:border-line-strong max-sm:bg-surface">
                  <Icone nome="seta-baixo" />
                  Próxima a conferir
                </Button>
              )}
              {pendentes > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmarTodas(true)} className="max-sm:order-last max-sm:col-span-2">
                  <Icone nome="check" />
                  Conferir as <span className="numero">{pendentes}</span> restantes
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setIncluir(true)} className={pendentes > 0 ? undefined : "max-sm:col-span-2"}>
                <Icone nome="mais" />
                Incluir linha
              </Button>
            </span>
          )}
        </div>
        <div role="progressbar" aria-label="Linhas conferidas" aria-valuemin={0} aria-valuemax={obrigatorias.length} aria-valuenow={conferidas} className="mt-3">
          <BarraProgresso pct={pct} tom={completo ? "success" : "neutro"} altura={6} />
        </div>
      </div>

      {/* Filtros numa faixa só: situação, busca e os recortes (material, área, pessoa) como listas compactas. */}
      <div className="grid grid-cols-1 gap-2 border-b border-line-soft px-cartao py-2.5 md:flex md:flex-wrap md:items-center">
        <div className="-mx-1 overflow-x-auto px-1">
          <Pills
            rotulo="Filtrar por situação"
            className="!flex-nowrap"
            itens={[
              { label: "Todas", n: linhas.length, ativo: filtro === "todas", onSelect: () => setFiltro("todas") },
              { label: "A conferir", n: nPendentesLista, ativo: filtro === "pendentes", onSelect: () => setFiltro("pendentes") },
              { label: "Conferidas", n: nConferidasLista, ativo: filtro === "conferidas", onSelect: () => setFiltro("conferidas") },
            ]}
          />
        </div>
        <div className="relative min-w-0 md:min-w-[200px] md:flex-1">
          <Icone nome="busca" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input type="search" aria-label="Buscar na ata" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item, local, pessoa ou SOL-…" className="!h-[30px] !pl-8 max-md:!h-10" />
        </div>
        {(gruposNaAta.length > 1 || areasNaAta.length > 1 || pessoasNaAta.length > 1) && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-none">
            {gruposNaAta.length > 1 && (
              // Três filtros no celular: o primeiro ocupa a linha toda (nenhum fica sozinho e estreito).
              <div className={cn("min-w-0 md:w-40", areasNaAta.length > 1 && pessoasNaAta.length > 1 && "max-sm:col-span-2")}>
                <Select
                  tamanho="sm"
                  aria-label="Filtrar por material"
                  value={grupoAtivo}
                  onValueChange={(v) => setGrupo(v as GrupoMaterial | "")}
                  ordenarAlfabetico={false}
                  opcoes={[{ value: "", label: "Todos os materiais" }, ...gruposNaAta.map((g) => ({ value: g, label: `${GRUPO_LABEL[g]} · ${linhas.filter((l) => l.grupo === g).length}` }))]}
                />
              </div>
            )}
            {areasNaAta.length > 1 && (
              <div className="min-w-0 md:w-36">
                <Select tamanho="sm" aria-label="Filtrar por área" value={areaAtiva} onValueChange={setArea} ordenarAlfabetico={false} opcoes={[{ value: "", label: "Todas as áreas" }, ...areasNaAta.map((a) => ({ value: a, label: a }))]} />
              </div>
            )}
            {pessoasNaAta.length > 1 && (
              <div className="min-w-0 md:w-40">
                <Select tamanho="sm" aria-label="Filtrar por quem pediu" value={pessoaAtiva} onValueChange={setPessoa} ordenarAlfabetico={false} opcoes={[{ value: "", label: "Todas as pessoas" }, ...pessoasNaAta.map((a) => ({ value: a, label: a }))]} />
              </div>
            )}
          </div>
        )}
        {filtrando && (
          <Button variant="link" size="sm" onClick={limparFiltros} className="justify-self-start">
            Limpar filtros
          </Button>
        )}
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          icone="lista"
          title="A ata está vazia"
          description="As necessidades das áreas entram aqui sozinhas. Inclua também as linhas decididas na reunião."
          action={
            editavel ? (
              <Button variant="secondary" size="md" onClick={() => setIncluir(true)}>
                <Icone nome="mais" />
                Incluir linha
              </Button>
            ) : undefined
          }
        />
      ) : visiveis.length === 0 ? (
        filtro === "pendentes" && !areaAtiva && !pessoaAtiva && !grupoAtivo && !busca.trim() ? (
          <EmptyState icone="check-circulo" title="Nada a conferir" description={presentesOk ? "Tudo conferido. Feche a ata no topo da página." : "Tudo conferido. Registre os presentes e feche a ata."} action={!presentesOk ? <Button variant="link" onClick={pedirRegistroDePresentes}>Registrar os presentes</Button> : undefined} />
        ) : (
          <EmptyState icone="busca" title={busca.trim() ? `Nada encontrado para “${busca.trim()}”` : "Nenhuma linha com esses filtros"} description="Tente outra palavra ou tire um dos filtros." action={<Button variant="link" onClick={limparFiltros}>Limpar filtros</Button>} />
        )
      ) : (
        <div ref={listaRef} onKeyDown={navegarComTeclado}>
          <div className={cn(GRADE, "hidden border-b border-line-soft bg-subtle px-cartao py-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted md:grid")} aria-hidden>
            <span />
            <span>Item</span>
            <span>Local</span>
            <span className="text-right">Qtd.</span>
            <span />
          </div>
          {secoes.map(({ area: nomeArea, itens }) => {
            const t = totalArea(nomeArea);
            const secaoOk = t.n > 0 && t.ok === t.n;
            return (
              <section key={nomeArea} aria-label={`${nomeArea}: ${t.ok} de ${t.n} conferidas`}>
                <h3 className="m-0 flex items-center justify-between gap-3 border-b border-line-soft bg-subtle px-cartao py-1.5">
                  <span className="text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">{nomeArea}</span>
                  <span className={cn("numero inline-flex items-center gap-1 text-pequeno font-normal", secaoOk ? "text-success" : "text-ink-3")}>
                    {secaoOk && <Icone nome="check" className="size-3.5" />}
                    {t.n > 0 ? `${t.ok}/${t.n}` : "opcional"}
                  </span>
                </h3>
                {itens.map(([chave, ls]) => {
                  if (ls.length === 1) {
                    const l = ls[0];
                    return (
                      <ul key={chave} className="m-0 list-none border-b border-line-row p-0 last:border-b-0">
                        <Linha l={l} eventoId={eventoId} editavel={editavel} onMudou={mudou} onAjustar={setAjustando} opcoes={opcoes} podeCadastrar={podeCadastrar} onEditarDescricao={editarDescricao} />
                      </ul>
                    );
                  }
                  const ok = ls.filter((l) => l.conferidoEm).length;
                  const total = ls.reduce((a, l) => a + l.quantidade, 0);
                  const p0 = ls[0];
                  // Todas as linhas do item vêm da mesma pessoa e área: a origem sobe para o cabeçalho do bloco.
                  const origemComum = ls.every((l) => quemDe(l) === quemDe(p0));
                  const solComum = origemComum && Boolean(p0.origem) && ls.every((l) => l.origem?.solicitacaoId === p0.origem?.solicitacaoId);
                  const ajustesComuns = p0.origem?.ajustes && ls.every((l) => l.origem?.ajustes === p0.origem?.ajustes) ? p0.origem.ajustes : null;
                  const blocoOk = ok === ls.length;
                  return (
                    <section key={chave} aria-label={`${p0.nome}: ${ok} de ${ls.length} linhas conferidas`} className="border-b border-line-row last:border-b-0">
                      <h4 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-cartao pb-2 pt-3 font-normal">
                        <span className="text-corpo font-semibold text-ink">{p0.nome}</span>
                        {p0.tipo === "AVULSO" && <Tag tom="warning">{TIPO[p0.tipo]}</Tag>}
                        {p0.codigo && <Codigo className="hidden text-rotulo text-muted xl:inline">{p0.codigo}</Codigo>}
                        <span className="text-pequeno text-muted">
                          <span className="numero font-medium text-ink">{total}</span> no total · {ls.length} locais
                          {origemComum && <> · {quemDe(p0)}</>}
                          {solComum && p0.origem && (
                            <>
                              {" · "}
                              <Link href={`/solicitacoes/${p0.origem.solicitacaoId}`} className="text-muted no-underline hover:text-accent hover:underline">
                                <Codigo>{p0.origem.codigo}</Codigo>
                              </Link>
                            </>
                          )}
                        </span>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-2">
                          <span className={cn("numero inline-flex items-center gap-1 text-pequeno", blocoOk ? "text-success" : "text-ink-3")}>
                            {blocoOk && <Icone nome="check" className="size-3.5" />}
                            {ok}/{ls.length}
                          </span>
                          {editavel && !blocoOk && (
                            <Button variant="ghost" size="xs" onClick={() => conferirGrupo(ls)} title={`Marcar as ${ls.length - ok} linhas de ${p0.nome} como conferidas`}>
                              <Icone nome="check" />
                              Conferir as {ls.length - ok}
                            </Button>
                          )}
                        </span>
                        {ajustesComuns && <span className="basis-full text-rotulo text-muted">Peças ajustadas em todas: {ajustesComuns}</span>}
                      </h4>
                      <ul className="m-0 ml-cartao list-none border-l-2 border-line-soft p-0 [&>li:last-child]:border-b-0">
                        {juntar(ls).map((js) =>
                          js.length > 1 ? (
                            <LinhaJunta key={js[0].id} ls={js} eventoId={eventoId} editavel={editavel} onConferir={conferirVarias} onAjustar={setAjustando} onEditarDescricao={editarDescricao} origemComum={origemComum} />
                          ) : (
                            <Linha key={js[0].id} l={js[0]} eventoId={eventoId} editavel={editavel} onMudou={mudou} onAjustar={setAjustando} opcoes={opcoes} podeCadastrar={podeCadastrar} onEditarDescricao={editarDescricao} emGrupo origemComum={origemComum} solComum={solComum} ajustesNoBloco={Boolean(ajustesComuns)} />
                          ),
                        )}
                      </ul>
                    </section>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <RodapeTabela
        className="rounded-b-cartao"
        direita={
          editavel && linhas.length > 0 ? (
            <span className="hidden text-rotulo text-meta lg:inline">
              <kbd className="rounded-chip border border-line bg-surface px-1 font-sans">↑</kbd> <kbd className="rounded-chip border border-line bg-surface px-1 font-sans">↓</kbd> andam entre as linhas · <kbd className="rounded-chip border border-line bg-surface px-1 font-sans">espaço</kbd> marca
            </span>
          ) : undefined
        }
      >
        <span>
          {filtrando ? (
            <>
              <span className="numero">{visiveis.length}</span> de <span className="numero">{linhas.length}</span> linhas
            </>
          ) : (
            <>
              <span className="numero">{linhas.length}</span> {linhas.length === 1 ? "linha" : "linhas"}
            </>
          )}{" "}
          · <span className="numero">{linhas.reduce((a, l) => a + l.quantidade, 0).toLocaleString("pt-BR")}</span> unidades
        </span>
      </RodapeTabela>

      {/* Conferir em lote marca tudo em nome de quem clicou e destrava o fechamento da ata: confirma antes. */}
      <Dialog open={confirmarTodas} onOpenChange={setConfirmarTodas}>
        {confirmarTodas && (
          <DialogContent
            title={`Conferir as ${pendentes} linhas restantes`}
            description={`Ficam marcadas como conferidas em seu nome, com data e hora.${opcionais > 0 ? ` As ${opcionais} opcionais (a definir e estaiamento) ficam como estão.` : ""} Depois disso a ata pode ser fechada.`}
            width={460}
          >
            <DialogFooter className="!-mt-4 border-t-0">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  // Só as linhas que estão na tela: o que chegar depois continua pendente.
                  const ids = obrigatorias.filter((l) => !l.conferidoEm).map((l) => l.id);
                  // Marca na hora (a janela fecha e a lista já aparece conferida); volta se o servidor recusar.
                  setOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, true])) }));
                  setConfirmarTodas(false);
                  enfileirar({ tipo: "lote", ids, rotulo: `${ids.length} linhas marcadas como conferidas` });
                }}
              >
                Marcar {pendentes} como conferidas
              </Button>
              <DialogClose asChild>
                <Button variant="secondary" size="lg">
                  Cancelar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {ajustando && <AjusteModal l={ajustando} eventoId={eventoId} onFechar={() => setAjustando(null)} />}
      {descrevendo && <DescricaoModal l={descrevendo} eventoId={eventoId} onFechar={() => setDescrevendo(null)} />}
      <Dialog open={incluir} onOpenChange={setIncluir}>
        {incluir && (
          <DialogContent title="Incluir linha na ata" description="Projeto padrão, peça do catálogo ou item fora do catálogo decidido na reunião. Já entra conferida." width={520}>
            <LinhaAtaForm eventoId={eventoId} opcoes={opcoes} areas={areas} exigeJustificativa={false} onDone={() => setIncluir(false)} />
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
