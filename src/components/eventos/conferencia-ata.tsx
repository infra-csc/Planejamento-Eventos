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
import { ajustarLinhaConferenciaAction, conferirLinhaAction, conferirTodasAction } from "@/app/(app)/eventos/actions";
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";
import { VincularCatalogo } from "./vincular-catalogo";
import { QuantidadeAta } from "@/components/eventos/quantidade-ata";
import type { LinhaConferencia } from "@/server/services/conferencia";

/** Resultado de "conferir as restantes": avisa quando chegaram linhas novas depois que a tela abriu. */
const avisarTodas = (r: Awaited<ReturnType<typeof conferirTodasAction>>, rotulo: string) => {
  if (!r.ok) return toastErro(r.erro);
  toastSucesso(r.dados && r.dados.novas > 0 ? `${rotulo}. ${r.dados.novas} ${r.dados.novas === 1 ? "linha chegou" : "linhas chegaram"} depois e ${r.dados.novas === 1 ? "continua pendente" : "continuam pendentes"}: confira na lista.` : rotulo);
};

type Filtro = "todas" | "pendentes" | "conferidas";

const TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "fora do catálogo" } as const;
const areaDe = (l: LinhaConferencia) => l.areaNome ?? "Logística";
/** Quem pediu a linha (ou quem incluiu na reunião). */
const pessoaDe = (l: LinhaConferencia) => l.origem?.solicitante ?? (l.padrao ? "Item padrão da ata" : (l.incluidaPor ?? "Logística"));
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

/** Modal da canetinha: nova quantidade + motivo obrigatório; mostra o que a área vai ver. */
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
          ? `a área vê "parcial: ${qtd} de ${pedido}" com o motivo`
          : pedido != null && qtd === pedido
            ? "a área vê atendido integralmente"
            : `a ata passa a ter ${qtd}`;

  const salvar = () => {
    if (qtd === l.quantidade) return setErro("Altere a quantidade para salvar um ajuste.");
    if (!motivo.trim()) return setErro("Informe o motivo. Ele fica no histórico e vai para quem pediu.");
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
      <DialogContent title={`Ajustar ${l.nome}`} description="O ajuste fica registrado com seu nome, data e motivo." width={480}>
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

          <Field label="Motivo" htmlFor="motivo-ajuste" obrigatorio hint="Vai para o histórico e para quem pediu.">
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
}: {
  /** Dentro do bloco do item: o nome já está no cabeçalho, a linha mostra a área. */
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
  return (
    <li className={cn(GRADE, "border-b border-line-row px-cartao py-3 transition-colors duration-150 last:border-b-0 md:py-2", conferida ? "hover:bg-subtle" : "bg-warning-bg-suave hover:bg-warning-bg/60")}>
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
              {areaDe(l)}
            </Link>
          </p>
        ) : (
          <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={`/eventos/${eventoId}/itens/${l.id}`} className="line-clamp-2 min-w-0 text-corpo font-medium text-ink no-underline hover:text-accent hover:underline" title={`Detalhes, peças e histórico de ${l.nome}`}>
              {l.nome}
            </Link>
            <Tag tom={l.tipo === "AVULSO" ? "warning" : "muted"}>{TIPO[l.tipo]}</Tag>
            {l.codigo && <Codigo className="hidden text-rotulo text-muted xl:inline">{l.codigo}</Codigo>}
          </p>
        )}
        <p className="m-0 mt-0.5 truncate text-pequeno text-ink-3">
          <span className="md:hidden">{l.destino ? `${l.destino} · ` : ""}</span>
          {!emGrupo && <span className="text-ink-2">{areaDe(l)} · </span>}
          <PedidoPor l={l} />
        </p>
        {/* O que quem pediu escreveu: descrição das unidades e observação, inteiras (a reunião confere por elas). */}
        {l.origem && l.origem.descricoes.length > 0 && <Descricoes grupos={l.origem.descricoes} />}
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
}: {
  eventoId: string;
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
  const [busca, setBusca] = useState("");
  const [ajustando, setAjustando] = useState<LinhaConferencia | null>(null);
  const [incluir, setIncluir] = useState(false);
  const [conferindo, iniciarTodas] = useTransition();
  const [confirmarTodas, setConfirmarTodas] = useState(false);

  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const pendentes = linhas.length - conferidas;
  const pct = linhas.length ? Math.round((conferidas / linhas.length) * 100) : 0;
  const completo = linhas.length > 0 && pendentes === 0;
  const areasNaAta = useMemo(() => [...new Set(linhas.map(areaDe))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const areaAtiva = area && areasNaAta.includes(area) ? area : "";
  const pessoasNaAta = useMemo(() => [...new Set(linhas.map(pessoaDe))].sort(porNome), [linhas]);
  const pessoaAtiva = pessoa && pessoasNaAta.includes(pessoa) ? pessoa : "";

  const visiveis = useMemo(
    () =>
      linhas.filter(
        (l) =>
          (filtro === "pendentes" ? !l.conferidoEm : filtro === "conferidas" ? Boolean(l.conferidoEm) : true) &&
          (!areaAtiva || areaDe(l) === areaAtiva) &&
          (!pessoaAtiva || pessoaDe(l) === pessoaAtiva) &&
          (!busca.trim() || combinaBusca(`${l.nome} ${l.codigo ?? ""} ${l.destino ?? ""} ${l.areaNome ?? ""} ${l.origem?.codigo ?? ""} ${l.origem?.solicitante ?? ""} ${l.origem?.descricao ?? ""}`, busca)),
      ),
    [linhas, filtro, areaAtiva, pessoaAtiva, busca],
  );

  // Um bloco por item (mesmo projeto/peça/descrição), em ordem alfabética; dentro, por área, destino e id.
  // A ordem só depende do nome, da área e do destino: conferir uma linha não a tira do lugar.
  const grupos = useMemo(() => {
    const mapa = new Map<string, LinhaConferencia[]>();
    for (const l of visiveis) {
      const k = `${l.tipo}|${l.codigo ?? l.nome}`;
      mapa.set(k, [...(mapa.get(k) ?? []), l]);
    }
    return [...mapa.entries()]
      .map(([k, ls]) => [k, [...ls].sort((a, b) => porNome(areaDe(a), areaDe(b)) || porNome(a.destino ?? "", b.destino ?? "") || a.id.localeCompare(b.id))] as const)
      .sort(([, a], [, b]) => porNome(a[0].nome, b[0].nome));
  }, [visiveis]);
  const filtrando = filtro !== "todas" || Boolean(areaAtiva) || Boolean(pessoaAtiva) || Boolean(busca.trim());
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

  return (
    <section className="min-w-0 rounded-cartao border border-line bg-surface" aria-label="Conferência da ata">
      {/* Progresso fixo: continua à vista enquanto a lista rola (a reunião acompanha por ele). */}
      <div className="sticky top-14 z-10 rounded-t-cartao border-b border-line-soft bg-surface/95 px-cartao py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="m-0 flex items-baseline gap-1.5" aria-live="polite">
            <span className={cn("numero text-titulo font-semibold", completo ? "text-success" : "text-ink")}>{conferidas}</span>
            <span className="text-corpo text-ink-2">
              de <span className="numero">{linhas.length}</span> conferidas
            </span>
            <span className="numero text-pequeno text-muted">· {pct}%</span>
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
        <div role="progressbar" aria-label="Linhas conferidas" aria-valuemin={0} aria-valuemax={linhas.length} aria-valuenow={conferidas} className="mt-2">
          <BarraProgresso pct={pct} tom={completo ? "success" : "neutro"} altura={6} />
        </div>
      </div>

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
          {grupos.map(([chave, ls]) => {
            if (ls.length === 1) {
              const l = ls[0];
              return (
                <ul key={chave} className="m-0 list-none border-b border-line-row p-0 last:border-b-0">
                  <Linha l={l} eventoId={eventoId} editavel={editavel} onMudou={mudou} onAjustar={setAjustando} opcoes={opcoes} podeCadastrar={podeCadastrar} />
                </ul>
              );
            }
            const ok = ls.filter((l) => l.conferidoEm).length;
            const total = ls.reduce((a, l) => a + l.quantidade, 0);
            const p0 = ls[0];
            return (
              <section key={chave} aria-label={`${p0.nome}: ${ok} de ${ls.length} linhas conferidas`} className="border-b border-line-row last:border-b-0">
                <h3 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-subtle/60 px-cartao pb-1.5 pt-3 font-normal">
                  <span className="text-corpo font-medium text-ink">{p0.nome}</span>
                  <Tag tom={p0.tipo === "AVULSO" ? "warning" : "muted"}>{TIPO[p0.tipo]}</Tag>
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
                </h3>
                <ul className="m-0 ml-cartao list-none border-l-2 border-line-soft p-0 [&>li:last-child]:border-b-0">
                  {ls.map((l) => (
                    <Linha key={l.id} l={l} eventoId={eventoId} editavel={editavel} onMudou={mudou} onAjustar={setAjustando} opcoes={opcoes} podeCadastrar={podeCadastrar} emGrupo />
                  ))}
                </ul>
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
                    const r = await conferirTodasAction(eventoId, linhas.filter((l) => !l.conferidoEm).map((l) => l.id));
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
