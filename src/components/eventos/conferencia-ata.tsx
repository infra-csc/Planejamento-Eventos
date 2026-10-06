"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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

/** Resultado de "conferir as restantes": avisa quando chegaram linhas novas depois que a tela abriu. */
const avisarTodas = (r: Awaited<ReturnType<typeof conferirTodasAction>>, rotulo: string) => {
  if (!r.ok) return toastErro(r.erro);
  toastSucesso(r.dados && r.dados.novas > 0 ? `${rotulo}. ${r.dados.novas} ${r.dados.novas === 1 ? "linha chegou" : "linhas chegaram"} depois e ${r.dados.novas === 1 ? "continua pendente" : "continuam pendentes"}: confira na lista.` : rotulo);
};

type Filtro = "todas" | "pendentes" | "conferidas";

const TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "fora do catálogo" } as const;
const areaDe = (l: LinhaConferencia) => l.areaNome ?? "Logística";
/** Quem pediu a linha (ou quem incluiu na reunião). */
/** Estrutura e Tendas ficam juntas (todas as áreas numa seção só); o resto, por área. */
const secaoDe = (l: LinhaConferencia) => (l.grupo === "ESTRUTURA" || l.grupo === "TENDAS" ? GRUPO_LABEL[l.grupo] : areaDe(l));
const ordemSecao = (s: string) => (s === GRUPO_LABEL.ESTRUTURA ? 0 : s === GRUPO_LABEL.TENDAS ? 1 : 2);
const pessoaDe = (l: LinhaConferencia) => l.origem?.solicitante ?? (l.regra ? "Regra da logística" : l.padrao ? "Item padrão da ata" : (l.incluidaPor ?? "Logística"));
const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/** Check da linha (40 px, alvo de toque em qualquer tela): um clique confere, outro desfaz. Otimista, volta se o servidor recusar. */
function Check({ l, eventoId, onMudou }: { l: LinhaConferencia; eventoId: string; onMudou: (id: string, v: boolean) => void }) {
  const [pendente, iniciar] = useTransition();
  const marcada = Boolean(l.conferidoEm);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`${l.nome}: ${marcada ? "conferido, clique para desfazer" : "marcar como conferido"}`}
      title={marcada ? `Conferido${l.conferidoPor ? ` por ${l.conferidoPor}` : ""} — clique para desfazer` : "Marcar como conferido"}
      disabled={pendente}
      onClick={() => {
        const v = !marcada;
        onMudou(l.id, v);
        iniciar(async () => {
          const r = await conferirLinhaAction(eventoId, l.id, v);
          if (!r.ok) {
            onMudou(l.id, !v);
            toastErro(r.erro);
          } else if (r.dados && r.dados.conferidas === r.dados.total) {
            toastSucesso("Todas as linhas conferidas. Registre os presentes e feche a ata.");
          }
        });
      }}
      className={cn(
        "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-progress disabled:opacity-60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        marcada ? "border-success bg-success text-white hover:brightness-95" : "border-line-control bg-surface text-transparent hover:border-success hover:text-success",
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
  const efeito =
    qtd === l.quantidade
      ? null
      : qtd === 0
        ? "sai da ata"
        : pedido != null && qtd < pedido
          ? `a área vê "parcial: ${qtd} de ${pedido}"${motivo.trim() ? " com o motivo" : ""}`
          : pedido != null && qtd === pedido
            ? "a área vê atendido integralmente"
            : `a ata passa a ter ${qtd}`;

  const salvar = () => {
    if (qtd === l.quantidade) return setErro("Altere a quantidade para salvar um ajuste.");
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
      <DialogContent title={`Ajustar ${l.nome}`} description="O ajuste fica registrado com seu nome e a data." width={480}>
        <div className="flex flex-col gap-4">
          <dl className="m-0 grid grid-cols-2 gap-3 rounded-controle border border-line-soft bg-subtle px-3.5 py-2.5">
            <div>
              <dt className="text-pequeno text-muted">Na ata agora</dt>
              <dd className="m-0 text-destaque font-semibold text-ink"><QuantidadeAta valor={l.quantidade} /></dd>
            </div>
            <div>
              <dt className="text-pequeno text-muted">{l.origem ? <>Pedido em <Codigo>{l.origem.codigo}</Codigo></> : "Origem"}</dt>
              <dd className={cn("m-0", pedido != null ? "numero text-destaque font-semibold text-ink" : "text-pequeno text-ink-2")}>{pedido ?? "incluída na reunião"}</dd>
            </div>
          </dl>

          <Field label="Nova quantidade" htmlFor="qtd-ajuste" hint={efeito ?? "0 retira a linha da ata."}>
            <Stepper id="qtd-ajuste" valor={qtd} onChange={setQtd} min={0} tamanho="md" autoFocus />
          </Field>

          <Field label="Motivo (opcional)" htmlFor="motivo-ajuste" hint="Se escrever, vai para o histórico e para quem pediu.">
            <Textarea id="motivo-ajuste" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: só 3 disponíveis na data; o 4º vem de locação" className="min-h-[84px]" />
          </Field>

          <FormError message={erro} />
        </div>
        <DialogFooter>
          <Button variant="primary" size="lg" onClick={salvar} loading={pendente}>
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
      <DialogContent title={`Descrição de ${l.nome}`} description={`${l.origem ? `Pedido ${l.origem.codigo} · ${l.origem.solicitante}. ` : ""}A alteração fica no histórico com seu nome, e quem pediu passa a ver a descrição nova.`} width={560}>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[112px_minmax(0,1fr)_36px] gap-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Unidades</span>
            <span>Descrição</span>
            <span />
          </div>
          {grupos.map((g, n) => (
            <div key={n} className="grid grid-cols-[112px_minmax(0,1fr)_36px] items-center gap-2">
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
            {grupos.length === 1 ? (total === 1 ? "" : `Uma descrição só vale para todas as ${total} unidades.`) : `${soma} de ${total} unidades descritas.`} Deixe em branco para tirar a descrição.
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
 * md+: check · item (com quem pediu) · destino · qtd · ações, numa linha só.
 */
// Destino, quantidade e ações com largura fixa: alinham em todas as linhas (também nas recuadas dos blocos por item).
const GRADE = "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[40px_minmax(0,1fr)_140px_64px_96px]";

/** Descrição das unidades como quem pediu escreveu: uma linha por texto, com quantas unidades levam ele. */
function Descricoes({ grupos }: { grupos: ReadonlyArray<{ texto: string; unidades: number }> }) {
  const total = grupos.reduce((a, g) => a + g.unidades, 0);
  if (grupos.length === 1)
    return (
      <p className="m-0 mt-1 whitespace-pre-line break-words text-pequeno text-ink-2">
        <span className="text-muted">Descrição{total > 1 ? ` (todas as ${total})` : ""}: </span>
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
function PedidoPor({ l }: { l: LinhaConferencia }) {
  return l.origem ? (
    <>
      {l.origem.solicitante} ·{" "}
      <Link href={`/solicitacoes/${l.origem.solicitacaoId}`} className="text-ink-3 no-underline hover:text-accent hover:underline">
        <Codigo>{l.origem.codigo}</Codigo>
      </Link>
    </>
  ) : l.regra ? (
    <>regra da logística: {l.regra}</>
  ) : l.padrao ? (
    <>item padrão de toda ata</>
  ) : (
    <>incluída na reunião{l.incluidaPor ? ` · ${l.incluidaPor}` : ""}</>
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
  onEditarDescricao,
}: {
  /** Administrador: corrigir a descrição das unidades (só linha que veio de pedido). */
  onEditarDescricao?: (l: LinhaConferencia) => void;
  /** Dentro do bloco do item: o nome já está no cabeçalho, a linha mostra quem pediu. */
  emGrupo?: boolean;
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
  const dicas = [l.origem?.ajustes ? `Peças ajustadas: ${l.origem.ajustes}` : null, l.ultimoAjuste ? `Ajustado por ${l.ultimoAjuste.por}: ${l.ultimoAjuste.descricao}` : null].filter(Boolean).join(" · ");
  const temAcoes = editavel || l.tipo === "PROJETO";
  const opcional = conferenciaOpcional(l);
  return (
    <li className={cn(GRADE, "border-b border-line-row px-cartao py-3 transition-colors duration-150 last:border-b-0 md:py-2", conferida || opcional ? "hover:bg-subtle" : "bg-warning-bg-suave hover:bg-warning-bg/60")}>
      {editavel ? (
        <Check l={l} eventoId={eventoId} onMudou={onMudou} />
      ) : (
        <span role="img" aria-label={conferida ? "Conferido" : "Não conferido"} className={cn("grid size-10 place-items-center rounded-full border-2", conferida ? "border-success bg-success text-white" : "border-line-strong text-transparent")}>
          <Icone nome="check" tamanho={20} />
        </span>
      )}

      <div className="min-w-0">
        {emGrupo ? (
          <p className="m-0 text-corpo font-medium text-ink">
            <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="text-ink no-underline hover:text-accent hover:underline" title={`Detalhes desta linha de ${l.nome}`}>
              {areaDe(l)} · {l.origem?.solicitante ?? (l.regra ? "Regra da logística" : l.padrao ? "Item padrão da ata" : "Incluída na reunião")}
            </Link>
          </p>
        ) : (
          <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="line-clamp-2 min-w-0 text-corpo font-medium text-ink no-underline hover:text-accent hover:underline" title={`Detalhes, peças e histórico de ${l.nome}`}>
              {l.nome}
            </Link>
            <Tag tom={l.tipo === "AVULSO" ? "warning" : "muted"}>{TIPO[l.tipo]}</Tag>
            <span className="text-rotulo text-muted">{GRUPO_LABEL[l.grupo]}</span>
            {l.codigo && <Codigo className="hidden text-rotulo text-muted xl:inline">{l.codigo}</Codigo>}
            {opcional && !conferida && (
              <span className="text-rotulo text-muted" title="Não precisa estar conferida para fechar a ata.">
                · {l.quantidade === 0 ? "a definir, " : ""}opcional
              </span>
            )}
          </p>
        )}
        <p className="m-0 mt-0.5 truncate text-pequeno text-ink-3">
          <span className="md:hidden">{l.destino ? `${l.destino} · ` : ""}</span>
          {!emGrupo ? (
            <PedidoPor l={l} />
          ) : l.origem ? (
            <Link href={`/solicitacoes/${l.origem.solicitacaoId}`} className="text-ink-3 no-underline hover:text-accent hover:underline">
              <Codigo>{l.origem.codigo}</Codigo>
            </Link>
          ) : !l.padrao && l.incluidaPor ? (
            l.incluidaPor
          ) : null}
        </p>
        {/* O que quem pediu escreveu: descrição das unidades e observação, inteiras (a reunião confere por elas). */}
        {l.origem && l.origem.descricoes.length > 0 && <Descricoes grupos={l.origem.descricoes} />}
        {onEditarDescricao && l.origem && (
          <button type="button" onClick={() => onEditarDescricao(l)} className="mt-1 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-rotulo text-accent hover:underline">
            <Icone nome="lapis" className="size-3" />
            {l.origem.descricoes.length ? "Editar descrição" : "Adicionar descrição"}
          </button>
        )}
        {l.origem?.observacao && (
          <p className="m-0 mt-0.5 whitespace-pre-line break-words text-pequeno text-ink-2">
            <span className="text-muted">Obs.: </span>
            {l.origem.observacao}
          </p>
        )}
        {dicas && (
          <p title={dicas} className={cn("m-0 mt-0.5 line-clamp-2 text-rotulo", l.ultimoAjuste ? "text-warning" : "text-muted")}>
            {l.ultimoAjuste && <Icone nome="lapis" className="mr-1 inline size-3 align-[-2px]" />}
            {dicas}
          </p>
        )}
      </div>

      <span className="hidden break-words text-pequeno text-ink-2 md:line-clamp-2" title={l.destino ?? undefined}>
        {l.destino ?? <span className="text-meta">—</span>}
      </span>

      <span className="text-right">
        <span className="block text-secao font-semibold text-ink"><QuantidadeAta valor={l.quantidade} /></span>
        {pedidoDiferente && <span className="numero block text-rotulo text-muted">pedido {l.origem!.quantidadeSolicitada}</span>}
      </span>

      {temAcoes ? (
        <span className="col-span-full flex flex-wrap items-center justify-start gap-1.5 pl-[52px] md:col-span-1 md:pl-0">
          {editavel && l.tipo === "AVULSO" && <VincularCatalogo compacto linha={{ linhaId: l.id, descricao: l.nome, quantidade: l.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />}
          {editavel && (
            <Button variant="ghost" size="xs" onClick={() => onAjustar(l)} aria-label={`Ajustar quantidade de ${l.nome}`} title="Ajustar quantidade">
              <Icone nome="lapis" />
              <span className="md:hidden">Ajustar</span>
            </Button>
          )}
          {l.tipo === "PROJETO" && (
            <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="inline-flex items-center whitespace-nowrap px-1 text-pequeno text-accent no-underline hover:underline max-md:min-h-10" title={`Abrir ${l.nome}: peças do projeto, ajuste peça a peça e histórico`}>
              Peças
            </Link>
          )}
        </span>
      ) : (
        <span className="hidden md:block" />
      )}
    </li>
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
  pendente,
}: {
  ls: readonly LinhaConferencia[];
  eventoId: string;
  editavel: boolean;
  onConferir: (ls: readonly LinhaConferencia[], v: boolean) => void;
  onAjustar: (l: LinhaConferencia) => void;
  onEditarDescricao?: (l: LinhaConferencia) => void;
  pendente: boolean;
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
    <li className={cn(GRADE, "border-b border-line-row px-cartao py-3 transition-colors duration-150 last:border-b-0 md:py-2", conferida ? "hover:bg-subtle" : "bg-warning-bg-suave hover:bg-warning-bg/60")}>
      {editavel ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={conferida ? true : ok > 0 ? "mixed" : false}
          aria-label={`${l0.nome}, ${ls.length} linhas: ${conferida ? "conferidas, clique para desfazer" : "marcar todas como conferidas"}`}
          title={conferida ? "Conferidas — clique para desfazer" : `Marcar as ${ls.length} linhas como conferidas`}
          disabled={pendente}
          onClick={() => onConferir(ls, !conferida)}
          className={cn(
            "relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-progress disabled:opacity-60",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            conferida ? "border-success bg-success text-white hover:brightness-95" : ok > 0 ? "border-success bg-success-bg text-success" : "border-line-control bg-surface text-transparent hover:border-success hover:text-success",
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
        <p className="m-0 text-corpo font-medium text-ink">
          {areaDe(l0)} · {pessoaDe(l0)}
          <span className="numero ml-2 rounded-chip bg-control px-1.5 py-px text-rotulo font-normal text-ink-3">{ls.length} linhas</span>
        </p>
        <p className="m-0 mt-0.5 truncate text-pequeno text-ink-3">
          <span className="md:hidden">{l0.destino ? `${l0.destino} · ` : ""}</span>
          {l0.origem && (
            <Link href={`/solicitacoes/${l0.origem.solicitacaoId}`} className="text-ink-3 no-underline hover:text-accent hover:underline">
              <Codigo>{l0.origem.codigo}</Codigo>
            </Link>
          )}
        </p>
        {descricoes.size > 0 && <Descricoes grupos={[...descricoes.entries()].map(([texto, unidades]) => ({ texto, unidades }))} />}
        {observacoes.map((o) => (
          <p key={o} className="m-0 mt-0.5 whitespace-pre-line break-words text-pequeno text-ink-2">
            <span className="text-muted">Obs.: </span>
            {o}
          </p>
        ))}
        {comuns.length > 0 && <p className="m-0 mt-0.5 text-rotulo text-muted">Peças ajustadas{diferentes ? " em todas" : ""}: {comuns.join(" · ")}</p>}
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
        <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-rotulo">
          {ls.map((l, i) => (
            <li key={l.id} className="inline-flex items-center gap-1.5 text-muted">
              <span className="numero">
                Linha {i + 1} · {l.quantidade} un.{l.conferidoEm ? " ✓" : ""}
              </span>
              {editavel && (
                <button type="button" onClick={() => onAjustar(l)} className="cursor-pointer border-0 bg-transparent p-0 text-accent hover:underline" title={`Ajustar a quantidade da linha ${i + 1}`}>
                  ajustar
                </button>
              )}
              {l.tipo === "PROJETO" && (
                <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="text-accent no-underline hover:underline" title={`Peças da linha ${i + 1}`}>
                  peças
                </Link>
              )}
              {onEditarDescricao && l.origem && (
                <button type="button" onClick={() => onEditarDescricao(l)} className="cursor-pointer border-0 bg-transparent p-0 text-accent hover:underline">
                  descrição
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <span className="hidden break-words text-pequeno text-ink-2 md:line-clamp-2" title={l0.destino ?? undefined}>
        {l0.destino ?? <span className="text-meta">—</span>}
      </span>

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
 * progresso sempre à vista (barra fixa no topo ao rolar), filtro por situação e por área, busca.
 * A canetinha ajusta a quantidade com motivo e log. A ata só fecha com tudo conferido.
 */
export function ConferenciaAta({
  eventoId,
  linhas: iniciais,
  editavel,
  opcoes,
  areas,
  podeCadastrar = false,
  podeEditarDescricao = false,
}: {
  eventoId: string;
  /** Administrador corrige a descrição das unidades na conferência. */
  podeEditarDescricao?: boolean;
  linhas: LinhaConferencia[];
  editavel: boolean;
  opcoes: OpcoesReferencia;
  areas: Array<{ id: string; nome: string }>;
  podeCadastrar?: boolean;
}) {
  // Estado local só para a resposta imediata do check; a revalidação do servidor substitui a lista.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [base, setBase] = useState(iniciais);
  if (base !== iniciais) {
    setBase(iniciais);
    setOverride({});
  }
  const linhas = useMemo(() => iniciais.map((l) => (l.id in override ? { ...l, conferidoEm: override[l.id] ? (l.conferidoEm ?? new Date().toISOString()) : null, conferidoPor: override[l.id] ? l.conferidoPor : null } : l)), [iniciais, override]);
  const mudou = (id: string, v: boolean) => setOverride((o) => ({ ...o, [id]: v }));

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
  const [conferindo, iniciarTodas] = useTransition();
  const [confirmarTodas, setConfirmarTodas] = useState(false);

  // Progresso sobre as linhas obrigatórias: "a definir" e estaiamento não travam o fechamento.
  const obrigatorias = linhas.filter((l) => !conferenciaOpcional(l));
  const conferidas = obrigatorias.filter((l) => l.conferidoEm).length;
  const pendentes = obrigatorias.length - conferidas;
  const pct = obrigatorias.length ? Math.round((conferidas / obrigatorias.length) * 100) : 0;
  const completo = obrigatorias.length > 0 && pendentes === 0;
  const opcionaisPendentes = linhas.filter((l) => conferenciaOpcional(l) && !l.conferidoEm).length;
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

  // Seção por área; dentro, um bloco por item (mesmo projeto/peça) em ordem alfabética; no bloco, por destino e pessoa.
  // A ordem só depende de área, nome, destino e pessoa: conferir uma linha não a tira do lugar.
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
  // Contagem por área sobre a ata inteira (não só o recorte), para o cabeçalho da seção.
  const totalArea = (a: string) => {
    const ls = linhas.filter((l) => secaoDe(l) === a);
    return { ok: ls.filter((l) => l.conferidoEm).length, n: ls.length };
  };
  const filtrando = filtro !== "todas" || Boolean(areaAtiva) || Boolean(pessoaAtiva) || Boolean(grupoAtivo) || Boolean(busca.trim());
  const conferirGrupo = (ls: readonly LinhaConferencia[]) => {
    const ids = ls.filter((l) => !l.conferidoEm).map((l) => l.id);
    if (!ids.length) return;
    setOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, true])) }));
    iniciarTodas(async () => {
      const r = await conferirTodasAction(eventoId, ids);
      if (!r.ok) setOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, false])) }));
      avisarTodas(r, `${ls[0].nome}: ${ids.length} ${ids.length === 1 ? "linha conferida" : "linhas conferidas"}`);
    });
  };

  // Várias linhas de uma vez (linha junta): marca as que faltam ou desmarca todas.
  const conferirVarias = (ls: readonly LinhaConferencia[], v: boolean) => {
    if (v) return conferirGrupo(ls);
    const ids = ls.filter((l) => l.conferidoEm).map((l) => l.id);
    setOverride((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, false])) }));
    iniciarTodas(async () => {
      for (const id of ids) {
        const r = await conferirLinhaAction(eventoId, id, false);
        if (!r.ok) {
          setOverride((o) => ({ ...o, [id]: true }));
          toastErro(r.erro);
        }
      }
    });
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

  return (
    <section className="min-w-0 rounded-cartao border border-line bg-surface" aria-label="Conferência da ata">
      {/* Progresso fixo: continua à vista enquanto a lista rola (a reunião acompanha por ele). */}
      <div className="sticky top-14 z-10 rounded-t-cartao border-b border-line-soft bg-surface/95 px-cartao py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="m-0 flex items-baseline gap-1.5" aria-live="polite">
            <span className={cn("numero text-titulo font-semibold", completo ? "text-success" : "text-ink")}>{conferidas}</span>
            <span className="text-corpo text-ink-2">
              de <span className="numero">{obrigatorias.length}</span> conferidas
            </span>
            <span className="numero text-pequeno text-muted">· {pct}%</span>
            {opcionaisPendentes > 0 && (
              <span className="text-pequeno text-muted" title="Linhas a definir (quantidade 0) e estaiamento: podem ser conferidas, mas não travam o fechamento da ata.">
                · {opcionaisPendentes} {opcionaisPendentes === 1 ? "opcional" : "opcionais"}
              </span>
            )}
          </p>
          {editavel && (
            <span className="ml-auto flex items-center gap-1.5">
              {pendentes > 1 && (
                <Button variant="ghost" size="sm" loading={conferindo} onClick={() => setConfirmarTodas(true)}>
                  Conferir as <span className="numero">{pendentes}</span> restantes
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setIncluir(true)}>
                <Icone nome="mais" />
                Incluir linha
              </Button>
            </span>
          )}
        </div>
        <div role="progressbar" aria-label="Linhas conferidas" aria-valuemin={0} aria-valuemax={obrigatorias.length} aria-valuenow={conferidas} className="mt-2">
          <BarraProgresso pct={pct} tom={completo ? "success" : "neutro"} altura={6} />
        </div>
      </div>

      {gruposNaAta.length > 1 && (
        <div className="-mx-1 overflow-x-auto border-b border-line-soft px-cartao pt-2.5">
          <Pills
            rotulo="Separar por material"
            className="!flex-nowrap"
            itens={[
              { label: "Todos os materiais", n: linhas.length, ativo: !grupoAtivo, onSelect: () => setGrupo("") },
              ...gruposNaAta.map((g) => ({ label: GRUPO_LABEL[g], n: linhas.filter((l) => l.grupo === g).length, ativo: grupoAtivo === g, onSelect: () => setGrupo(g) })),
            ]}
          />
        </div>
      )}
      <div className="flex flex-col gap-2 border-b border-line-soft px-cartao py-2.5 md:flex-row md:flex-wrap md:items-center">
        <div className="-mx-1 overflow-x-auto px-1">
          <Pills
            rotulo="Filtrar por situação"
            className="!flex-nowrap"
            itens={[
              { label: "Todas", n: linhas.length, ativo: filtro === "todas", onSelect: () => setFiltro("todas") },
              { label: "A conferir", n: pendentes, ativo: filtro === "pendentes", onSelect: () => setFiltro("pendentes") },
              { label: "Conferidas", n: conferidas, ativo: filtro === "conferidas", onSelect: () => setFiltro("conferidas") },
            ]}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {areasNaAta.length > 1 && (
            <div className="min-w-0 flex-1 basis-36 sm:max-w-44">
              <Select tamanho="sm" aria-label="Filtrar por área" value={areaAtiva} onValueChange={setArea} placeholder="Todas as áreas" ordenarAlfabetico={false} opcoes={[{ value: "", label: "Todas as áreas" }, ...areasNaAta.map((a) => ({ value: a, label: a }))]} />
            </div>
          )}
          {pessoasNaAta.length > 1 && (
            <div className="min-w-0 flex-1 basis-36 sm:max-w-48">
              <Select tamanho="sm" aria-label="Filtrar por quem pediu" value={pessoaAtiva} onValueChange={setPessoa} placeholder="Todas as pessoas" ordenarAlfabetico={false} opcoes={[{ value: "", label: "Todas as pessoas" }, ...pessoasNaAta.map((a) => ({ value: a, label: a }))]} />
            </div>
          )}
          <div className="relative min-w-0 flex-[2] basis-48">
            <Icone nome="busca" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input type="search" aria-label="Buscar na ata" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Item, pessoa ou SOL-…" className="!h-[30px] !pl-8 max-md:!h-10" />
          </div>
        </div>
      </div>

      {linhas.length === 0 ? (
        <EmptyState compact title="A ata está vazia" description="As necessidades das áreas entram aqui sozinhas. Inclua também as linhas decididas na reunião." />
      ) : visiveis.length === 0 ? (
        <EmptyState
          compact
          title={filtro === "pendentes" && !areaAtiva && !busca.trim() ? "Nada a conferir" : "Nenhuma linha com esse filtro"}
          description={filtro === "pendentes" && !areaAtiva && !busca.trim() ? "Tudo conferido. Registre os presentes e feche a ata." : undefined}
          action={
            filtrando ? (
              <Button
                variant="link"
                onClick={() => {
                  setFiltro("todas");
                  setArea("");
                  setPessoa("");
                  setGrupo("");
                  setBusca("");
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={cn(GRADE, "hidden border-b border-line-soft bg-subtle px-cartao py-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted md:grid")} aria-hidden>
            <span className="text-center">Ok</span>
            <span>Item · pedido por</span>
            <span>Destino</span>
            <span className="text-right">Qtd.</span>
            <span />
          </div>
          {secoes.map(({ area: nomeArea, itens }) => {
            const t = totalArea(nomeArea);
            return (
              <section key={nomeArea} aria-label={`${nomeArea}: ${t.ok} de ${t.n} conferidas`}>
                <h3 className="m-0 flex items-center justify-between gap-3 border-b border-line-soft bg-subtle px-cartao py-1.5">
                  <span className="text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">{nomeArea}</span>
                  <span className={cn("numero inline-flex items-center gap-1 text-pequeno font-normal", t.ok === t.n ? "text-success" : "text-ink-3")}>
                    {t.ok === t.n && <Icone nome="check" className="size-3.5" />}
                    {t.ok}/{t.n}
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
                return (
                  <section key={chave} aria-label={`${p0.nome}: ${ok} de ${ls.length} linhas conferidas`} className="border-b border-line-row last:border-b-0">
                    <h4 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-subtle/60 px-cartao pb-1.5 pt-3 font-normal">
                      <span className="text-corpo font-medium text-ink">{p0.nome}</span>
                      <Tag tom={p0.tipo === "AVULSO" ? "warning" : "muted"}>{TIPO[p0.tipo]}</Tag>
                      <span className="text-rotulo text-muted">{GRUPO_LABEL[p0.grupo]}</span>
                      {p0.codigo && <Codigo className="hidden text-rotulo text-muted xl:inline">{p0.codigo}</Codigo>}
                      <span className="text-pequeno text-muted">
                        <span className="numero font-medium text-ink">{total}</span> no total · {ls.length} linhas
                      </span>
                      <span className={cn("numero ml-auto inline-flex items-center gap-1 text-pequeno", ok === ls.length ? "text-success" : "text-ink-3")}>
                        {ok === ls.length && <Icone nome="check" className="size-3.5" />}
                        {ok}/{ls.length}
                      </span>
                      {editavel && ok < ls.length && (
                        <Button variant="link" size="xs" disabled={conferindo} onClick={() => conferirGrupo(ls)}>
                          Conferir as {ls.length - ok}
                        </Button>
                      )}
                    </h4>
                    <ul className="m-0 ml-cartao list-none border-l-2 border-line-soft p-0 [&>li:last-child]:border-b-0">
                      {juntar(ls).map((js) =>
                        js.length > 1 ? (
                          <LinhaJunta key={js[0].id} ls={js} eventoId={eventoId} editavel={editavel} onConferir={conferirVarias} onAjustar={setAjustando} onEditarDescricao={editarDescricao} pendente={conferindo} />
                        ) : (
                          <Linha key={js[0].id} l={js[0]} eventoId={eventoId} editavel={editavel} onMudou={mudou} onAjustar={setAjustando} opcoes={opcoes} podeCadastrar={podeCadastrar} onEditarDescricao={editarDescricao} emGrupo />
                        ),
                      )}
                    </ul>
                  </section>
                );
              })}
              </section>
            );
          })}
        </>
      )}

      <RodapeTabela className="rounded-b-cartao">
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
      </RodapeTabela>

      {/* Conferir em lote marca tudo em nome de quem clicou e destrava o fechamento da ata: confirma antes. */}
      <Dialog open={confirmarTodas} onOpenChange={setConfirmarTodas}>
        {confirmarTodas && (
          <DialogContent title={`Conferir as ${pendentes} linhas restantes`} description="Elas ficam marcadas como conferidas em seu nome, com data e hora. Depois disso a ata pode ser fechada." width={460}>
            <DialogFooter className="!mt-0">
              <Button
                variant="primary"
                size="lg"
                loading={conferindo}
                onClick={() =>
                  iniciarTodas(async () => {
                    // Só as linhas que estão na tela: o que chegar depois continua pendente.
                    const r = await conferirTodasAction(eventoId, obrigatorias.filter((l) => !l.conferidoEm).map((l) => l.id));
                    avisarTodas(r, `${r.ok ? (r.dados?.marcadas ?? pendentes) : pendentes} linhas marcadas como conferidas`);
                    setConfirmarTodas(false);
                  })
                }
              >
                Marcar {pendentes} como conferidas
              </Button>
              <DialogClose asChild>
                <Button variant="secondary" size="lg" disabled={conferindo}>
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
