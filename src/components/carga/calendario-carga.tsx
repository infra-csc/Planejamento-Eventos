"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Pills } from "@/components/ui/pills";
import {
  construirOperacoes,
  dataHoraCurta,
  FILTROS_PADRAO,
  normalizarTexto,
  OPERACAO,
  operacaoVisivel,
  operacoesDaPlanilha,
  origemDaDescarga,
  segundaDe,
  semanaIso,
  somarDias,
  TAG_CARGA_DICA,
  TAG_CARGA_LABEL,
  TAGS_CARGA,
  TIPO_VEICULO_LABEL,
  type DiaPlanilha,
  type EventoCarga,
  type FiltrosCarga,
  type Operacao,
  type TipoOperacao,
} from "@/domain/carga-descarga";
import type { VeiculoCargaView } from "@/server/services/carga-descarga";
import { COR_TAG, ContagemVeiculos, IconeVeiculo, TagCargaChip } from "./base";
import { DetalheVeiculo, TrechosVeiculo } from "./detalhe-veiculo";
import { FormVeiculo } from "./form-veiculo";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dt = (d: string) => new Date(`${d}T12:00:00Z`);
const diaMesTexto = (d: string) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;
const diaSemana = (d: string) => DIAS[dt(d).getUTCDay()];
/** Materiais da planilha que pedem atenção (último, saldo, a confirmar…). */
const QUENTE = /ULTIMO|COMECA|SALDO|COMPLEMENTO|A CONFIRMAR|FRACIONAD/;

type Modal =
  | { tipo: "veiculo"; id: string }
  | { tipo: "grupo"; ids: string[]; titulo: string; eventoId: string; operacao: TipoOperacao; data: string }
  | { tipo: "evento"; eventoId: string }
  | { tipo: "planilha"; op: Operacao }
  | { tipo: "novo"; eventoId?: string }
  | { tipo: "editar"; id: string };

/** Zonas do dia: ↑ carga (azul), evento (verde) e ↓ descarga (laranja, fundo próprio e borda tracejada). */
const ZONAS = [
  { chave: "carga", titulo: "↑ Carga", tipos: ["cargaGalpao", "cargaDestino"] as TipoOperacao[], cls: "border-l-info", tituloCls: "text-info", fundo: "" },
  { chave: "evento", titulo: "Evento", tipos: ["evento"] as TipoOperacao[], cls: "border-l-success", tituloCls: "text-success", fundo: "" },
  { chave: "descarga", titulo: "↓ Descarga", tipos: ["descDestino", "descGalpao"] as TipoOperacao[], cls: "border-l-warning", tituloCls: "text-warning", fundo: "rounded-controle border border-dashed border-warning-border bg-warning-bg-suave" },
] as const;

/**
 * Calendário de carga e descarga do galpão (substitui a planilha "Resumo semanal"): a semana de segunda a
 * domingo com o que sai (↑), o dia do evento e o que volta (↓), filtros salvos por pessoa, volume por
 * semana no ano e busca por evento. Clicar num card abre a ida e a volta completas.
 */
export function CalendarioCarga({
  eventos,
  veiculos,
  planilha,
  podeEditar,
  hoje,
  usuarioId,
}: {
  eventos: ReadonlyArray<EventoCarga & { ativo: boolean }>;
  veiculos: readonly VeiculoCargaView[];
  planilha: readonly DiaPlanilha[];
  podeEditar: boolean;
  hoje: string;
  usuarioId: string;
}) {
  const router = useRouter();
  const chavePrefs = `norte:carga:filtros:${usuarioId}`;
  const [filtros, setFiltros] = useState<FiltrosCarga>(FILTROS_PADRAO);
  const [semana, setSemana] = useState(segundaDe(hoje));
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);

  // Filtros salvos por pessoa (neste navegador). Lidos depois da hidratação: o servidor não tem o armazenamento.
  useEffect(() => {
    try {
      const salvo = JSON.parse(window.localStorage.getItem(chavePrefs) ?? "null") as Partial<FiltrosCarga> | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferências do navegador só existem no cliente
      if (salvo) setFiltros({ ...FILTROS_PADRAO, ...salvo });
    } catch {
      // Sem armazenamento (aba privada): fica o padrão.
    }
  }, [chavePrefs]);
  const mudarFiltros = (p: Partial<FiltrosCarga>) =>
    setFiltros((f) => {
      const novo = { ...f, ...p };
      try {
        window.localStorage.setItem(chavePrefs, JSON.stringify(novo));
      } catch {
        // idem
      }
      return novo;
    });

  // Várias pessoas cadastram ao mesmo tempo: ao voltar para a aba e a cada minuto (com a aba à vista), recarrega.
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", atualizar);
    const t = window.setInterval(atualizar, 60_000);
    return () => {
      window.removeEventListener("focus", atualizar);
      window.clearInterval(t);
    };
  }, [router]);

  // No celular as barras do ano não cabem: mantém a semana escolhida no meio da faixa.
  const barrasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const faixa = barrasRef.current;
    const barra = faixa?.querySelector<HTMLElement>('[aria-current="true"]');
    if (faixa && barra && faixa.scrollWidth > faixa.clientWidth) faixa.scrollLeft = barra.offsetLeft - faixa.clientWidth / 2;
  }, [semana]);

  const porId = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const veiculoPorId = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  const opsPlanilha = useMemo(() => operacoesDaPlanilha(planilha), [planilha]);
  const diaPlanilha = useMemo(() => new Map(planilha.map((d) => [d.date, d])), [planilha]);
  const ops = useMemo(() => construirOperacoes(eventos, veiculos, filtros.planilha ? opsPlanilha : null), [eventos, veiculos, filtros.planilha, opsPlanilha]);
  const visiveis = useMemo(() => ops.filter((o) => operacaoVisivel(o, filtros)), [ops, filtros]);
  const porDia = useMemo(() => {
    const m = new Map<string, Operacao[]>();
    for (const o of visiveis) m.set(o.data, [...(m.get(o.data) ?? []), o]);
    return m;
  }, [visiveis]);

  // Semanas do gráfico: da primeira à última com alguma coisa (planilha ou cadastro), e a de hoje.
  const semanas = useMemo(() => {
    const datas = [...ops.map((o) => o.data), ...planilha.map((d) => d.date), hoje].sort();
    const ini = segundaDe(datas[0]);
    const fim = segundaDe(datas[datas.length - 1]);
    const out: string[] = [];
    for (let w = ini; w <= fim; w = somarDias(w, 7)) out.push(w);
    return out;
  }, [ops, planilha, hoje]);
  const contar = (seg: string) => {
    const c = { carga: 0, descarga: 0, evento: 0, veiculos: new Set<string>() };
    for (let i = 0; i < 7; i++)
      for (const o of porDia.get(somarDias(seg, i)) ?? []) {
        c[OPERACAO[o.tipo].direcao]++;
        if (o.veiculo) c.veiculos.add(o.veiculo.id);
      }
    return c;
  };
  const totais = semanas.map(contar);
  const maxSemana = Math.max(1, ...totais.map((t) => t.carga + t.descarga + t.evento));
  const daSemana = contar(semana);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(semana, i));

  // Busca: troca a semana pela linha do tempo do evento em todas as datas.
  const termo = normalizarTexto(busca.trim());
  const palavras = termo.split(/\s+/).filter(Boolean);
  const ORDEM: Record<TipoOperacao, number> = { cargaGalpao: 0, descDestino: 1, evento: 2, cargaDestino: 3, descGalpao: 4 };
  const achados =
    termo.length >= 2
      ? visiveis
          .filter((o) => {
            const ev = o.eventoId ? porId.get(o.eventoId) : undefined;
            const n = normalizarTexto(`${o.bruto ?? o.nome} ${ev?.codigo ?? ""}`);
            return palavras.every((w) => n.includes(w));
          })
          .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : ORDEM[a.tipo] - ORDEM[b.tipo]))
      : null;

  const abrir = (o: Operacao, grupo?: Operacao[]) => {
    if (o.origem === "planilha") return setModal({ tipo: "planilha", op: o });
    if (o.tipo === "evento") return setModal({ tipo: "evento", eventoId: o.eventoId! });
    if (grupo && grupo.length > 1) return setModal({ tipo: "grupo", ids: grupo.map((x) => x.veiculo!.id), titulo: o.nome, eventoId: o.eventoId!, operacao: o.tipo, data: o.data });
    setModal({ tipo: "veiculo", id: o.veiculo!.id });
  };

  /** Faixa de horários do grupo ("fim carga 12:30–15:00"). */
  const faixa = (g: readonly Operacao[]) => {
    const hs = g.map((o) => o.hora).filter(Boolean).sort();
    if (!hs.length) return null;
    return `${g[0].rotuloHora} ${hs[0]}${hs.length > 1 && hs[hs.length - 1] !== hs[0] ? `–${hs[hs.length - 1]}` : ""}`;
  };

  const cardCls = "block w-full cursor-pointer rounded-controle border bg-surface px-2.5 py-2 text-left transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

  const cards = (lista: readonly Operacao[]) => {
    const out: React.ReactNode[] = [];
    if (filtros.ver === "veiculo") {
      for (const o of lista.filter((x) => x.origem === "cadastro" && x.tipo !== "evento").sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99"))) {
        const v = o.veiculo!;
        out.push(
          <li key={o.chave}>
            <button type="button" onClick={() => abrir(o)} className={cn(cardCls, "border-line")}>
              <span className="flex items-center gap-1.5 text-rotulo text-ink-2">
                <IconeVeiculo tipo={v.tipo} className="text-ink-3" />
                <b className="font-semibold">{TIPO_VEICULO_LABEL[v.tipo]}</b>
              </span>
              {v.ident && <span className="block break-words text-rotulo text-muted">{v.ident}</span>}
              <span className="mt-0.5 block text-pequeno font-medium leading-snug text-ink">{o.nome}</span>
              <CardRodape tags={o.tags} hora={o.hora ? `${o.rotuloHora} ${o.hora}` : null} extra={o.extra} />
            </button>
          </li>,
        );
      }
      for (const o of lista.filter((x) => x.tipo === "evento")) out.push(cardEvento(o));
      return out;
    }
    // Por evento: veículos do mesmo evento, operação e dia num card só.
    const grupos = new Map<string, Operacao[]>();
    for (const o of lista) {
      const k = o.tipo === "evento" ? `e:${o.eventoId ?? o.chave}` : o.origem === "cadastro" ? `c:${o.eventoId}` : `p:${o.chave}`;
      grupos.set(k, [...(grupos.get(k) ?? []), o]);
    }
    for (const [k, g] of grupos) {
      const o = g[0];
      if (o.tipo === "evento") {
        out.push(cardEvento(o));
        continue;
      }
      if (o.origem === "cadastro") {
        out.push(
          <li key={k}>
            <button type="button" onClick={() => abrir(o, g)} className={cn(cardCls, "border-line")}>
              <span className="block text-pequeno font-medium leading-snug text-ink">{o.nome}</span>
              <ContagemVeiculos tipos={g.map((x) => x.veiculo!.tipo)} className="mt-1" />
              <CardRodape tags={[...new Set(g.flatMap((x) => x.tags))]} hora={faixa(g)} extra={o.tipo === "descGalpao" ? (g.map((x) => x.extra).find(Boolean) ?? "") : ""} />
            </button>
          </li>,
        );
      } else out.push(cardPlanilha(o));
    }
    return out;
  };

  const cardEvento = (o: Operacao) => {
    const tipos = o.origem === "cadastro" ? veiculos.filter((v) => v.eventoId === o.eventoId).map((v) => v.tipo) : [];
    return (
      <li key={o.chave}>
        <button type="button" onClick={() => abrir(o)} title={o.origem === "planilha" ? "Da planilha 2026" : undefined} className={cn(cardCls, o.origem === "planilha" ? "border-dotted border-line-strong" : "border-success-border bg-success-bg/40")}>
          <span className="block text-pequeno font-medium leading-snug text-ink">{o.nome}</span>
          {tipos.length > 0 && <ContagemVeiculos tipos={tipos} className="mt-1" />}
          {/* "PLANILHA" em caixa-alta em quase todo cartão: a borda pontilhada já diz a origem (e o filtro "Planilha"). */}
          {o.origem === "planilha" && <span className="sr-only"> · da planilha</span>}
        </button>
      </li>
    );
  };

  const cardPlanilha = (o: Operacao) => {
    const origem = o.tipo === "descGalpao" ? origemDaDescarga(o.bruto ?? o.nome, o.data, planilha) : null;
    return (
      <li key={o.chave}>
        <button type="button" onClick={() => abrir(o)} title="Da planilha 2026" className={cn(cardCls, "border-dotted border-line-strong bg-subtle/40")}>
          <span className="block text-pequeno font-medium leading-snug text-ink">{o.nome}</span>
          {(o.materiais?.length || o.coluna === "kit") && (
            <span className="mt-1 flex flex-wrap gap-1">
              {o.coluna === "kit" && <em className="rounded-chip bg-control px-1 text-rotulo not-italic text-ink-2">KIT</em>}
              {o.materiais!.map((m) => (
                <em key={m} className={cn("rounded-chip px-1 text-rotulo not-italic", QUENTE.test(normalizarTexto(m)) ? "bg-danger-bg font-medium text-danger" : "bg-control text-ink-2")}>
                  {m}
                </em>
              ))}
            </span>
          )}
          {origem && <span className="mt-1 block text-rotulo text-ink-3">← evento de {diaSemana(origem).toLowerCase()} {diaMesTexto(origem)}</span>}
          <span className="sr-only"> · da planilha</span>
        </button>
      </li>
    );
  };

  const modalVeiculo = modal?.tipo === "veiculo" || modal?.tipo === "editar" ? veiculoPorId.get(modal.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Semana, navegação e cadastro. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="min-w-0">
          <h2 className="m-0 text-titulo font-semibold tracking-[-0.01em] text-ink">Semana {semanaIso(semana)}</h2>
          <p className="m-0 text-pequeno text-muted">
            <span className="numero">
              {diaMesTexto(semana)} – {diaMesTexto(somarDias(semana, 6))} · {semana.slice(0, 4)}
            </span>
          </p>
        </div>
        <nav aria-label="Semana" className="flex items-center gap-1">
          <Button variant="secondary" size="md" onClick={() => setSemana((s) => somarDias(s, -7))} aria-label="Semana anterior">
            <Icone nome="chevron-esquerda" />
          </Button>
          <Button variant="secondary" size="md" disabled={semana === segundaDe(hoje)} onClick={() => setSemana(segundaDe(hoje))}>
            Hoje
          </Button>
          <Button variant="secondary" size="md" onClick={() => setSemana((s) => somarDias(s, 7))} aria-label="Próxima semana">
            <Icone nome="chevron-direita" />
          </Button>
        </nav>
        <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1" aria-label="Indicadores da semana">
          {filtros.direcao !== "descarga" && <Kpi n={daSemana.carga} rotulo="↑ cargas" cls="text-info" />}
          {filtros.direcao !== "carga" && <Kpi n={daSemana.descarga} rotulo="↓ descargas" cls="text-warning" />}
          <Kpi n={daSemana.veiculos.size} rotulo={daSemana.veiculos.size === 1 ? "veículo" : "veículos"} />
          {filtros.eventos && <Kpi n={daSemana.evento} rotulo="eventos" cls="text-success" />}
        </dl>
        {podeEditar && (
          <Button variant="primary" size="md" className="ml-auto" onClick={() => setModal({ tipo: "novo" })}>
            <Icone nome="mais" />
            Novo veículo
          </Button>
        )}
      </div>

      {/* Filtros (salvos por pessoa). */}
      <div className="flex flex-col gap-2.5 rounded-cartao border border-line bg-surface px-cartao py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="-mx-1 overflow-x-auto px-1">
            <Pills
              rotulo="Direção"
              className="!flex-nowrap"
              itens={[
                { label: "Tudo", ativo: filtros.direcao === "tudo", onSelect: () => mudarFiltros({ direcao: "tudo" }) },
                { label: "↑ Cargas", ativo: filtros.direcao === "carga", onSelect: () => mudarFiltros({ direcao: "carga" }) },
                { label: "↓ Descargas", ativo: filtros.direcao === "descarga", onSelect: () => mudarFiltros({ direcao: "descarga" }) },
              ]}
            />
          </div>
          <Pills
            rotulo="Ver"
            className="!flex-nowrap"
            itens={[
              { label: "Por evento", ativo: filtros.ver === "evento", onSelect: () => mudarFiltros({ ver: "evento" }), title: "Junta os veículos do mesmo evento, operação e dia num card" },
              { label: "Por veículo", ativo: filtros.ver === "veiculo", onSelect: () => mudarFiltros({ ver: "veiculo" }), title: "Um card por veículo" },
            ]}
          />
          <div className="relative min-w-[200px] flex-1">
            <Icone nome="busca" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input
              type="search"
              aria-label="Buscar evento"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setBusca("")}
              placeholder="Buscar evento"
              className="!pl-8"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Tipo de carga" className="flex flex-wrap gap-1.5">
            {TAGS_CARGA.map((t) => {
              const ligada = filtros.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={ligada}
                  title={TAG_CARGA_DICA[t]}
                  onClick={() => mudarFiltros({ tags: ligada ? filtros.tags.filter((x) => x !== t) : [...filtros.tags, t] })}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-chip border px-2 text-pequeno transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent max-md:h-9",
                    ligada ? "border-ink-3 bg-selected font-medium text-ink" : "border-line-control bg-surface text-ink-2 hover:border-line-strong",
                  )}
                >
                  <span aria-hidden className="size-2 rounded-full" style={{ background: COR_TAG[t] }} />
                  {TAG_CARGA_LABEL[t]}
                </button>
              );
            })}
          </div>
          <span aria-hidden className="hidden h-5 w-px bg-line md:block" />
          {(
            [
              ["eventos", "Eventos", "Mostra o dia de cada evento"],
              ["soGalpao", "Só galpão", "Só carga no galpão (ida) e descarga no galpão (volta)"],
              ["planilha", "Planilha 2026", "Itens da planilha antiga (somem quando o evento é cadastrado)"],
            ] as const
          ).map(([k, rotulo, dica]) => (
            <label key={k} title={dica} className="inline-flex cursor-pointer items-center gap-1.5 text-pequeno text-ink-2 max-md:min-h-9">
              <input type="checkbox" checked={filtros[k]} onChange={(e) => mudarFiltros({ [k]: e.target.checked })} className="size-4 accent-[var(--color-accent)]" />
              {rotulo}
            </label>
          ))}
          {(filtros.tags.length > 0 || filtros.direcao !== "tudo" || filtros.soGalpao || !filtros.eventos) && (
            <Button variant="link" size="sm" onClick={() => mudarFiltros({ ...FILTROS_PADRAO, ver: filtros.ver, planilha: filtros.planilha })}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Volume por semana no ano: barras empilhadas (carga, descarga, evento); clicar leva à semana. */}
      <section aria-label="Volume por semana" className="rounded-cartao border border-line bg-surface px-cartao pb-2 pt-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-pequeno font-semibold text-ink">Volume por semana</h3>
          <span className="flex gap-3 text-rotulo text-muted">
            <Legenda cor="bg-info" rotulo="carga" />
            <Legenda cor="bg-warning" rotulo="descarga" />
            <Legenda cor="bg-success" rotulo="evento" />
          </span>
        </div>
        <div ref={barrasRef} className="relative overflow-x-auto pb-1">
          <div className="flex h-[76px] w-full items-end gap-[3px]" style={{ minWidth: semanas.length * 17 }}>
            {semanas.map((w, i) => {
              const t = totais[i];
              const total = t.carga + t.descarga + t.evento;
              const sel = w === semana;
              const agora = w === segundaDe(hoje);
              const primeiraDoMes = Number(w.slice(8, 10)) <= 7 || i === 0;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setSemana(w);
                  }}
                  title={`${diaMesTexto(w)} – ${diaMesTexto(somarDias(w, 6))}: ${t.carga} cargas, ${t.descarga} descargas, ${t.evento} eventos`}
                  aria-label={`Semana de ${diaMesTexto(w)}: ${t.carga} cargas, ${t.descarga} descargas, ${t.evento} eventos`}
                  aria-current={sel ? "true" : undefined}
                  className={cn("group flex h-full min-w-[14px] flex-1 cursor-pointer flex-col items-center justify-end gap-0.5 rounded-[3px] border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-accent", sel && "bg-selected")}
                >
                  <span className={cn("flex w-[calc(100%-4px)] max-w-6 flex-col-reverse overflow-hidden rounded-[2px]", total === 0 && "h-px bg-line")} style={{ height: total ? `${(total / maxSemana) * 54}px` : undefined }}>
                    <span className="block bg-info" style={{ flexGrow: t.carga }} />
                    <span className="block bg-warning" style={{ flexGrow: t.descarga }} />
                    <span className="block bg-success" style={{ flexGrow: t.evento }} />
                  </span>
                  <span className={cn("h-3 text-[9px] leading-3", agora ? "font-semibold text-accent" : "text-meta")}>{agora ? "hoje" : primeiraDoMes ? MESES[Number(w.slice(5, 7)) - 1] : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {achados ? (
        <section aria-label={`Linha do tempo: ${busca.trim()}`} className="overflow-hidden rounded-cartao border border-line bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft px-cartao py-3">
            <h3 className="m-0 text-secao font-semibold">Linha do tempo · “{busca.trim()}”</h3>
            <span className="text-pequeno text-muted">{achados.length ? `${achados.length} ${achados.length === 1 ? "registro" : "registros"} com os filtros atuais` : "Nada encontrado com os filtros atuais."}</span>
          </header>
          <ol className="m-0 list-none p-0">
            {achados.map((o) => {
              const d = OPERACAO[o.tipo];
              return (
                <li key={o.chave}>
                  <button
                    type="button"
                    onClick={() => {
                      setSemana(segundaDe(o.data));
                      setBusca("");
                    }}
                    title="Ir para a semana"
                    className={cn("grid w-full cursor-pointer grid-cols-[88px_150px_minmax(0,1fr)] items-center gap-3 border-0 border-b border-line-row bg-transparent px-cartao py-2 text-left transition-colors hover:bg-subtle max-md:grid-cols-[72px_minmax(0,1fr)]", o.data < hoje && "opacity-60")}
                  >
                    <span className="numero text-pequeno text-ink-2">
                      {diaSemana(o.data)} {diaMesTexto(o.data)}
                    </span>
                    <span className={cn("text-pequeno font-medium max-md:hidden", d.direcao === "carga" ? "text-info" : d.direcao === "descarga" ? "text-warning" : "text-success")}>
                      {d.direcao === "carga" ? "↑ " : d.direcao === "descarga" ? "↓ " : ""}
                      {d.rotulo}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-pequeno text-ink">
                      {o.bruto ?? o.nome}
                      {o.tags.map((t) => (
                        <TagCargaChip key={t} tag={t} />
                      ))}
                      {o.veiculo && <IconeVeiculo tipo={o.veiculo.tipo} className="text-ink-3" />}
                      {o.hora && (
                        <span className="numero text-rotulo text-muted">
                          {o.rotuloHora} {o.hora}
                        </span>
                      )}
                      {o.origem === "planilha" && <span className="text-micro uppercase tracking-[0.06em] text-meta">planilha</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        // A semana: um dia por coluna no desktop; no celular, um dia embaixo do outro.
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-7">
          {dias.map((d, i) => {
            const lista = porDia.get(d) ?? [];
            const plan = diaPlanilha.get(d);
            const ehHoje = d === hoje;
            const zonas = ZONAS.map((z) => ({ ...z, partes: z.tipos.map((t) => [t, lista.filter((o) => o.tipo === t)] as const).filter(([, l]) => l.length > 0) })).filter((z) => z.partes.length > 0);
            return (
              <article key={d} aria-label={`${diaSemana(d)} ${diaMesTexto(d)}${ehHoje ? ", hoje" : ""}`} className={cn("flex min-w-0 flex-col rounded-cartao border bg-surface", ehHoje ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-line", i >= 5 && !ehHoje && "bg-subtle/60")}>
                <header className="flex items-start justify-between gap-2 border-b border-line-soft px-2.5 py-2">
                  <div>
                    <p className={cn("m-0 text-micro font-semibold uppercase tracking-[0.08em]", ehHoje ? "text-accent" : "text-muted")}>
                      {diaSemana(d)}
                      {ehHoje && " · hoje"}
                    </p>
                    <p className="numero m-0 text-corpo font-semibold text-ink">{diaMesTexto(d)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {plan?.holiday && <span className="rounded-chip bg-danger-bg px-1.5 text-rotulo font-medium text-danger">{plan.holiday}</span>}
                    {plan?.turnos && <span className="rounded-chip bg-control px-1.5 text-rotulo text-ink-3">{plan.turnos}</span>}
                  </div>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {zonas.length === 0 ? (
                    <p className="m-0 py-3 text-center text-rotulo text-meta">Nada com estes filtros</p>
                  ) : (
                    zonas.map((z) => {
                      const rotular = z.partes.length > 1 || z.partes.some(([t]) => t === "cargaDestino" || t === "descDestino");
                      return (
                        <div key={z.chave} className={cn("border-l-2 pl-2", z.cls, z.fundo, z.fundo && "border-l-0 p-1.5")}>
                          <p className={cn("m-0 mb-1 text-micro font-semibold uppercase tracking-[0.06em]", z.tituloCls)}>{z.titulo}</p>
                          {z.partes.map(([t, l]) => (
                            <div key={t}>
                              {rotular && OPERACAO[t].sub && <p className="m-0 mb-0.5 mt-1 text-rotulo text-muted">{OPERACAO[t].sub}</p>}
                              <ul className="m-0 flex list-none flex-col gap-1 p-0">{cards(l)}</ul>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        {modal?.tipo === "novo" && <FormVeiculo eventos={eventos} eventoFixo={modal.eventoId} onFechar={() => setModal(null)} />}
        {modal?.tipo === "editar" && modalVeiculo && <FormVeiculo eventos={eventos} inicial={modalVeiculo} onFechar={() => setModal(null)} />}
        {modal?.tipo === "veiculo" && modalVeiculo && <DetalheVeiculo v={modalVeiculo} evento={porId.get(modalVeiculo.eventoId)} podeEditar={podeEditar} onEditar={() => setModal({ tipo: "editar", id: modalVeiculo.id })} onFechar={() => setModal(null)} />}
        {modal?.tipo === "grupo" && (
          <DialogContent title={modal.titulo} description={`${OPERACAO[modal.operacao].rotulo} · ${diaSemana(modal.data)} ${diaMesTexto(modal.data)} · ${modal.ids.length} veículos`} width={760}>
            <ul className="-mx-5 m-0 list-none divide-y divide-line-row border-y border-line-row p-0">
              {modal.ids
                .map((id) => veiculoPorId.get(id))
                .filter((v): v is VeiculoCargaView => Boolean(v))
                .map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setModal({ tipo: "veiculo", id: v.id })} className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-5 py-2.5 text-left transition-colors hover:bg-subtle">
                      <IconeVeiculo tipo={v.tipo} className="text-ink-3" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-corpo font-medium text-ink">
                          {TIPO_VEICULO_LABEL[v.tipo]}
                          {v.ident && <span className="font-normal text-ink-3"> · {v.ident}</span>}
                        </span>
                        <span className="numero block text-pequeno text-muted">
                          {v.ida.ativo ? `ida: fim carga ${dataHoraCurta(v.ida.fimCarga)}` : "sem ida"} · {v.volta.ativo ? `volta: descarga ${dataHoraCurta(v.volta.descargaGalpao)}` : "sem volta"}
                        </span>
                      </span>
                      <Icone nome="chevron-direita" className="text-ink-3" />
                    </button>
                  </li>
                ))}
            </ul>
          </DialogContent>
        )}
        {modal?.tipo === "evento" &&
          (() => {
            const ev = porId.get(modal.eventoId);
            const vs = veiculos.filter((v) => v.eventoId === modal.eventoId);
            if (!ev) return null;
            return (
              <DialogContent title={ev.nome} description={`${ev.codigo} · evento ${diaSemana(ev.data).toLowerCase()} ${diaMesTexto(ev.data)}${ev.local ? ` · ${ev.local}` : ""}`} width={760}>
                <div className="flex flex-col gap-3">
                  {vs.map((v) => (
                    <div key={v.id} className="rounded-controle border border-line-soft">
                      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2">
                        <IconeVeiculo tipo={v.tipo} className="text-ink-3" />
                        <span className="text-corpo font-medium text-ink">{TIPO_VEICULO_LABEL[v.tipo]}</span>
                        {v.ident && <span className="text-pequeno text-ink-3">· {v.ident}</span>}
                        {podeEditar && (
                          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setModal({ tipo: "editar", id: v.id })}>
                            <Icone nome="lapis" />
                            Editar
                          </Button>
                        )}
                      </div>
                      <div className="p-3">
                        <TrechosVeiculo v={v} />
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/eventos/${ev.id}/carga`} className="link text-pequeno">
                      <Codigo>{ev.codigo}</Codigo> · abrir a carga do evento
                    </Link>
                    {podeEditar && (
                      <Button variant="secondary" size="md" onClick={() => setModal({ tipo: "novo", eventoId: ev.id })}>
                        <Icone nome="mais" />
                        Veículo neste evento
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            );
          })()}
        {modal?.tipo === "planilha" && (
          <DialogContent title={modal.op.nome} description={`${OPERACAO[modal.op.tipo].rotulo} · ${diaSemana(modal.op.data)} ${diaMesTexto(modal.op.data)} · planilha 2026`} width={520}>
            <div className="flex flex-col gap-2 text-pequeno text-ink-2">
              <p className="m-0">
                <span className="text-muted">Na planilha: </span>
                {modal.op.bruto}
              </p>
              {modal.op.tags.length > 0 && (
                <p className="m-0 flex flex-wrap gap-1.5">
                  {modal.op.tags.map((t) => (
                    <TagCargaChip key={t} tag={t} />
                  ))}
                </p>
              )}
              <p className="m-0 rounded-controle bg-subtle px-3 py-2 text-muted">
                Item da planilha antiga, só para consulta: sem veículos nem horários. Quando o evento ganhar veículos aqui, ele deixa de aparecer.
                {podeEditar && " Para cadastrar, use “Novo veículo” e escolha o evento."}
              </p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Kpi({ n, rotulo, cls }: { n: number; rotulo: string; cls?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className={cn("numero m-0 text-secao font-semibold text-ink", cls)}>{n}</dd>
      <dt className="text-pequeno text-muted">{rotulo}</dt>
    </div>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className={cn("size-2 rounded-[2px]", cor)} />
      {rotulo}
    </span>
  );
}

function CardRodape({ tags, hora, extra }: { tags: readonly (typeof TAGS_CARGA)[number][]; hora: string | null; extra?: string }) {
  if (!tags.length && !hora && !extra) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <TagCargaChip key={t} tag={t} className="!px-1" />
      ))}
      {hora && <span className="numero text-rotulo font-medium text-ink-2">{hora}</span>}
      {extra && <span className="numero basis-full text-rotulo text-muted">{extra}</span>}
    </span>
  );
}

