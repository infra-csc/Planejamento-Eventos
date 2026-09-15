"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Arena } from "@/domain/arena/tipos";
import { CAMADAS, CATEGORIAS, COR_PERCURSO, type Camada } from "@/domain/arena/categorias";
import { buscarPontos, itensNaoPosicionados } from "@/domain/arena/geometria";
import { cn } from "@/lib/cn";
import type { MotorArena, Vista } from "./cena/motor";
import type { Qualidade } from "./cena/materiais";
import { PainelPonto, PainelSemPosicao } from "./painel-ponto";
import { Plano2D } from "./plano-2d";
import { IndicePontos } from "./indice-pontos";
import { Minimapa } from "./minimapa";
import { IconeBusca, IconeCamadas, IconeEnquadrar, IconeLista, IconeMais, IconeMenos, IconeNorte, IconePerspectiva, IconeSairTelaCheia, IconeSuperior, IconeTeclado, IconeTelaCheia } from "./icones";

const CAMADAS_PADRAO = Object.fromEntries(CAMADAS.map((c) => [c.id, c.padrao])) as Record<Camada, boolean>;
const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

const ATALHOS: Array<[string, string]> = [
  ["Arrastar", "Mover o mapa"],
  ["Botão direito + arrastar", "Girar a câmera"],
  ["Roda do mouse", "Aproximar e afastar no cursor"],
  ["← ↑ → ↓", "Mover"],
  ["+  −", "Aproximar e afastar"],
  ["0", "Visão geral da arena"],
  ["N", "Norte para cima"],
  ["T", "Alternar vista de cima e perspectiva"],
  ["P", "Índice de pontos"],
  ["/", "Buscar ponto"],
  ["F", "Tela cheia"],
  ["Esc", "Fechar painel"],
];

const cartao = "rounded-[10px] border border-line bg-surface/95 shadow-[0_2px_8px_rgba(42,20,24,.08)] backdrop-blur";

function BotaoMapa({ rotulo, atalho, onClick, children, ativo, className }: { rotulo: string; atalho?: string; onClick: () => void; children: React.ReactNode; ativo?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={atalho ? `${rotulo} (${atalho})` : rotulo}
      aria-pressed={ativo}
      aria-keyshortcuts={atalho}
      onClick={onClick}
      className={cn("grid size-9 cursor-pointer place-items-center border-0 bg-transparent text-ink-2 hover:bg-subtle hover:text-ink aria-pressed:bg-accent-bg aria-pressed:text-accent", className)}
    >
      {children}
    </button>
  );
}

export function ArenaExperiencia({ arena }: { arena: Arena }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const pegadaRef = useRef<SVGPolygonElement>(null);
  const motorRef = useRef<MotorArena | null>(null);
  const camadasRef = useRef(CAMADAS_PADRAO);

  const [modo, setModo] = useState<"3d" | "2d">("3d");
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [qualidade, setQualidade] = useState<Qualidade | null>(null);
  const [lento, setLento] = useState(false);
  const [camadas, setCamadas] = useState(CAMADAS_PADRAO);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [vista, setVistaAtual] = useState<Vista>("perspectiva");
  const [telaCheia, setTelaCheia] = useState(false);
  const [estreito, setEstreito] = useState(false);
  const [largo, setLargo] = useState(true);
  const [painelCamadas, setPainelCamadas] = useState(false);
  const [semPosicao, setSemPosicao] = useState(false);
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(true);
  const [termo, setTermo] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [indiceBusca, setIndiceBusca] = useState(0);

  const ponto = arena.pontos.find((p) => p.id === selecionado) ?? null;
  const resultados = useMemo(() => buscarPontos(arena.pontos, termo).slice(0, 8), [arena.pontos, termo]);
  const foraDoMapa = itensNaoPosicionados(arena).length + arena.semPosicaoNaPlanta.length;
  const categoriasPresentes = [...new Set(arena.pontos.map((p) => p.categoria))];
  const usar3D = modo === "3d" && estado !== "erro";
  const mostrarPlano = modo === "2d" || estado === "erro";

  // Monta a cena 3D sob demanda: o three.js só é baixado quando esta tela abre.
  useEffect(() => {
    if (modo !== "3d" || !hostRef.current || !overlayRef.current) return;
    let cancelado = false;
    let motor: MotorArena | null = null;
    const host = hostRef.current;
    const overlay = overlayRef.current;
    import("./cena/motor")
      .then(({ MotorArena, suportaWebGL, qualidadeSugerida }) => {
        if (cancelado) return;
        if (!suportaWebGL()) {
          setErro("Este dispositivo não oferece WebGL, necessário para o 3D.");
          setEstado("erro");
          return;
        }
        motor = new MotorArena({
          container: host,
          overlay,
          arena,
          qualidade: qualidade ?? qualidadeSugerida(),
          camadas: camadasRef.current,
          reduzirMovimento: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          eventos: {
            aoPassar: setHover,
            aoSelecionar: (id) => {
              setSelecionado(id);
              setSemPosicao(false);
              motorRef.current?.definirSelecao(id);
            },
            aoPronto: () => setEstado("pronto"),
            aoErro: (mensagem) => {
              setErro(mensagem);
              setEstado("erro");
            },
            aoDesempenhoBaixo: () => setLento(true),
            aoMoverCamera: (pegada) => pegadaRef.current?.setAttribute("points", pegada.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(" ")),
          },
        });
        try {
          motor.iniciar();
          motorRef.current = motor;
        } catch (e) {
          motor.dispose();
          motor = null;
          setErro(e instanceof Error ? e.message : "Não foi possível iniciar o 3D.");
          setEstado("erro");
        }
      })
      .catch(() => {
        if (cancelado) return;
        setErro("Não foi possível carregar o módulo 3D. Verifique a conexão.");
        setEstado("erro");
      });
    return () => {
      cancelado = true;
      motorRef.current = null;
      motor?.dispose();
    };
  }, [modo, qualidade, tentativa, arena]);

  useEffect(() => {
    camadasRef.current = camadas;
    motorRef.current?.definirCamadas(camadas);
    motorRef.current?.invalidar();
  }, [camadas, estado]);

  useEffect(() => {
    motorRef.current?.definirSelecao(selecionado);
    motorRef.current?.invalidar();
  }, [selecionado, estado]);

  // Tela cheia sem depender dos ancestrais: enquanto expandido, o mapa vive no <body>.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!telaCheia || !el) return;
    const pai = el.parentNode;
    const proximo = el.nextSibling;
    const overflowAnterior = document.body.style.overflow;
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";
    motorRef.current?.redimensionar();
    return () => {
      document.body.style.overflow = overflowAnterior;
      if (pai) pai.insertBefore(el, proximo);
      requestAnimationFrame(() => motorRef.current?.redimensionar());
    };
  }, [telaCheia]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setEstreito(e.contentRect.width < 720);
      setLargo(e.contentRect.width >= 1100);
    });
    ro.observe(el);
    const aoSairTelaCheia = () => {
      if (!document.fullscreenElement) setTelaCheia(false);
    };
    document.addEventListener("fullscreenchange", aoSairTelaCheia);
    return () => {
      ro.disconnect();
      document.removeEventListener("fullscreenchange", aoSairTelaCheia);
    };
  }, []);

  const selecionar = (id: string | null, aproximar = false) => {
    setSelecionado(id);
    setSemPosicao(false);
    if (id && aproximar) motorRef.current?.focar(id);
  };

  const trocarModo = (m: "3d" | "2d") => {
    if (m === modo) return;
    if (m === "3d") {
      setEstado("carregando");
      setErro(null);
    }
    setModo(m);
  };

  const trocarQualidade = (q: Qualidade) => {
    setLento(false);
    setEstado("carregando");
    setQualidade(q);
  };

  const alternarTelaCheia = async () => {
    const el = wrapperRef.current;
    if (!telaCheia) {
      setTelaCheia(true);
      try {
        await el?.requestFullscreen?.();
      } catch {
        /* Sem API de tela cheia: o modo expandido por CSS continua valendo. */
      }
    } else {
      setTelaCheia(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    }
    requestAnimationFrame(() => motorRef.current?.redimensionar());
  };

  const alternarVista = () => {
    const v: Vista = vista === "perspectiva" ? "superior" : "perspectiva";
    setVistaAtual(v);
    motorRef.current?.vista(v);
  };

  const escolherResultado = (id: string) => {
    setBuscaAberta(false);
    setTermo("");
    selecionar(id, modo === "3d");
  };

  // Atalhos de teclado (desktop). Ignorados enquanto se digita.
  const atalhosRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    atalhosRef.current = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (e.key === "Escape") {
        if (buscaAberta) setBuscaAberta(false);
        else if (ajudaAberta) setAjudaAberta(false);
        else if (painelCamadas) setPainelCamadas(false);
        else if (selecionado || semPosicao) {
          setSelecionado(null);
          setSemPosicao(false);
        } else if (indiceAberto) setIndiceAberto(false);
        return;
      }
      if (digitando || e.metaKey || e.ctrlKey || e.altKey) return;
      const motor = motorRef.current;
      const acoes: Record<string, () => void> = {
        "+": () => motor?.aproximar(0.65),
        "=": () => motor?.aproximar(0.65),
        "-": () => motor?.aproximar(1.5),
        "0": () => motor?.resetar(),
        n: () => motor?.orientarNorte(),
        t: alternarVista,
        p: () => setIndiceAberto((v) => !v),
        f: () => void alternarTelaCheia(),
        "?": () => setAjudaAberta((v) => !v),
        "/": () => buscaRef.current?.focus(),
        ArrowUp: () => motor?.mover(1, 0),
        ArrowDown: () => motor?.mover(-1, 0),
        ArrowLeft: () => motor?.mover(0, -1),
        ArrowRight: () => motor?.mover(0, 1),
      };
      const acao = acoes[e.key] ?? acoes[e.key.toLowerCase()];
      if (!acao) return;
      if (!wrapperRef.current?.isConnected) return;
      e.preventDefault();
      acao();
    };
  });
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => atalhosRef.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);

  const painelDireitoAberto = Boolean(ponto || semPosicao);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[12px] text-muted">
            Arena 3D · {arena.evento.sku} · {DATA.format(new Date(`${arena.evento.data}T12:00:00Z`))}
          </p>
          <h1 className="m-0 mt-0.5 text-[22px] font-semibold tracking-[-0.025em] text-balance">{arena.evento.nome}</h1>
          <p className="m-0 mt-1 max-w-[640px] text-[13.5px] text-ink-2">{arena.evento.local}. Clique em qualquer estrutura para ver o que a planta e a ata dizem dela.</p>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px]">
          <div>
            <dt className="text-muted">Largadas</dt>
            <dd className="m-0 font-mono text-ink">{arena.evento.largadas.map((l) => `${l.distancia} ${l.hora}`).join(" · ")}</dd>
          </div>
          {arena.evento.publicoEsperado && (
            <div>
              <dt className="text-muted">Público esperado</dt>
              <dd className="m-0 font-mono tabular-nums text-ink">{arena.evento.publicoEsperado.toLocaleString("pt-BR")}</dd>
            </div>
          )}
          {arena.evento.diretorProva && (
            <div>
              <dt className="text-muted">Diretor de prova</dt>
              <dd className="m-0 text-ink">{arena.evento.diretorProva}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Pontos</dt>
            <dd className="m-0 font-mono tabular-nums text-ink">{arena.pontos.length}</dd>
          </div>
        </dl>
      </header>

      <div
        ref={wrapperRef}
        className={cn(
          "overflow-hidden border border-line bg-[#e6e2dc]",
          telaCheia ? "fixed inset-0 z-[70] h-[100dvh] w-screen rounded-none border-0" : "relative h-[calc(100dvh-190px)] min-h-[600px] rounded-[12px]",
        )}
      >
        {/* Cena 3D */}
        <div ref={hostRef} className={cn("absolute inset-0", !usar3D && "hidden")} />
        <div ref={overlayRef} data-zoom="longe" className={cn("group/mapa pointer-events-none absolute inset-0 overflow-hidden", !usar3D && "hidden")}>
          {usar3D &&
            estado === "pronto" &&
            arena.pontos
              .filter((p) => camadas[CATEGORIAS[p.categoria].camada])
              .map((p) => {
                const ativo = p.id === selecionado;
                const emFoco = ativo || p.id === hover;
                const rotulo = camadas.rotulos || emFoco;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-ponto-id={p.id}
                    aria-label={`${p.nome}, ${p.tipo}`}
                    aria-pressed={ativo}
                    onClick={() => selecionar(p.id)}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover(null)}
                    data-prioridade={ativo ? 3 : emFoco ? 2 : p.principal ? 1 : 0}
                    className="group/pin pointer-events-auto absolute left-0 top-0 cursor-pointer border-0 bg-transparent p-0 will-change-transform"
                    style={{ visibility: "hidden", zIndex: emFoco ? 3 : p.principal ? 2 : 1 }}
                  >
                    <span className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
                      <span
                        data-rotulo
                        className={cn(
                          "mb-1 whitespace-nowrap rounded-[6px] border px-1.5 py-[3px] text-[11.5px] font-medium leading-none shadow-[0_1px_2px_rgba(42,20,24,.12)] transition-[opacity,transform] duration-150 group-data-[oculto=1]/pin:opacity-0",
                          ativo ? "border-accent bg-accent text-white" : "border-line bg-surface/95 text-ink",
                          !rotulo && "hidden",
                          !emFoco && !p.principal && "group-data-[zoom=longe]/mapa:hidden",
                        )}
                      >
                        {p.legenda && !emFoco && <span className="mr-1 font-mono text-[10.5px] opacity-60">{p.legenda.split(" ")[0]}</span>}
                        {p.nome}
                        {emFoco && !ativo && <span className="ml-1.5 font-normal text-muted">· {p.tipo}</span>}
                      </span>
                      <span className={cn("block rounded-full border-2 border-white shadow-[0_1px_3px_rgba(42,20,24,.35)] transition-transform duration-150", ativo ? "size-3.5 scale-110" : emFoco ? "size-3 scale-110" : "size-2.5")} style={{ background: CATEGORIAS[p.categoria].cor }} />
                      <span aria-hidden className="block h-2 w-px bg-ink/40" />
                    </span>
                  </button>
                );
              })}
        </div>

        {mostrarPlano && <Plano2D arena={arena} camadas={camadas} selecionado={selecionado} onSelecionar={(id) => selecionar(id)} />}

        {usar3D && estado === "carregando" && (
          <div className="absolute inset-0 grid place-items-center bg-[#ebe7e1]" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 text-center">
              <svg width="132" height="64" viewBox="0 0 120 64" aria-hidden className="text-accent">
                <path d="M6 50 C 30 44, 40 18, 62 20 S 100 42, 114 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 6" className="animate-esqueleto" />
                <circle cx="6" cy="50" r="4" fill="#2a1418" />
                <circle cx="114" cy="14" r="4" fill="#2a1418" />
              </svg>
              <p className="m-0 text-[14px] font-medium text-ink">Montando a arena</p>
              <p className="m-0 text-[12.5px] text-muted">
                {arena.pontos.length} pontos · {arena.currais.length} currais · {arena.percurso.trechos.length} corredores isolados
              </p>
            </div>
          </div>
        )}

        {/* Barra superior */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start gap-2">
          <div className="pointer-events-auto relative w-full max-w-[320px]">
            <label htmlFor="arena-busca" className="sr-only">
              Encontrar ponto na arena
            </label>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconeBusca />
            </span>
            <input
              ref={buscaRef}
              id="arena-busca"
              type="search"
              value={termo}
              autoComplete="off"
              placeholder="Encontrar: largada, GV, Livelo, nº 12…"
              aria-keyshortcuts="/"
              onChange={(e) => {
                setTermo(e.target.value);
                setBuscaAberta(true);
                setIndiceBusca(0);
              }}
              onFocus={() => setBuscaAberta(true)}
              onBlur={() => setTimeout(() => setBuscaAberta(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndiceBusca((i) => Math.min(i + 1, resultados.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndiceBusca((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && resultados[indiceBusca]) {
                  e.preventDefault();
                  escolherResultado(resultados[indiceBusca].id);
                  buscaRef.current?.blur();
                }
              }}
              role="combobox"
              aria-expanded={buscaAberta}
              aria-controls="arena-busca-lista"
              className="h-10 w-full rounded-[9px] border border-line bg-surface/95 pl-9 pr-10 text-[13.5px] text-ink shadow-[0_2px_8px_rgba(42,20,24,.08)] backdrop-blur placeholder:text-meta focus:border-accent focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[4px] border border-line bg-subtle px-1.5 font-mono text-[10.5px] text-muted">/</kbd>
            {buscaAberta && (
              <ul id="arena-busca-lista" role="listbox" className="absolute left-0 right-0 top-11 m-0 max-h-[320px] list-none overflow-y-auto rounded-[9px] border border-line bg-surface p-1 shadow-[0_12px_28px_rgba(42,20,24,.14)]">
                {resultados.length === 0 ? (
                  <li className="px-3 py-2.5 text-[12.5px] text-muted">Nada encontrado para “{termo}”.</li>
                ) : (
                  resultados.map((p, i) => (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={i === indiceBusca}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => escolherResultado(p.id)}
                      onMouseEnter={() => setIndiceBusca(i)}
                      className={cn("flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 py-2", i === indiceBusca && "bg-accent-bg")}
                    >
                      <span aria-hidden className="block size-2.5 shrink-0 rounded-full" style={{ background: CATEGORIAS[p.categoria].cor }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{p.nome}</span>
                        <span className="block text-[11.5px] text-muted">{p.tipo}</span>
                      </span>
                      {p.legenda && <span className="font-mono text-[11px] text-meta">{p.legenda.split(" ")[0]}</span>}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <div className={cn("pointer-events-auto overflow-hidden", cartao)}>
            <BotaoMapa rotulo="Índice de pontos" atalho="P" ativo={indiceAberto} onClick={() => setIndiceAberto((v) => !v)} className="size-10">
              <IconeLista />
            </BotaoMapa>
          </div>
          <div className="flex-1" />
          <div className={cn("pointer-events-auto flex overflow-hidden", cartao)} role="group" aria-label="Tipo de visualização">
            {(["3d", "2d"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => trocarModo(m)}
                className="h-10 cursor-pointer border-0 bg-transparent px-3 text-[12.5px] font-medium text-ink-3 hover:text-ink aria-pressed:bg-dark aria-pressed:text-white"
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto relative">
            <div className={cn("overflow-hidden", cartao)}>
              <BotaoMapa rotulo="Camadas" ativo={painelCamadas} onClick={() => setPainelCamadas((v) => !v)} className="size-10">
                <IconeCamadas />
              </BotaoMapa>
            </div>
            {painelCamadas && (
              <div className="absolute right-0 top-12 z-40 w-[280px] rounded-[10px] border border-line bg-surface p-2 shadow-[0_12px_28px_rgba(42,20,24,.14)]">
                <p className="m-0 px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Camadas</p>
                {CAMADAS.filter((c) => modo === "3d" || (c.id !== "publico" && c.id !== "fluxo")).map((c) => (
                  <label key={c.id} htmlFor={`camada-${c.id}`} className="flex cursor-pointer items-start gap-2.5 rounded-[7px] px-2 py-1.5 hover:bg-subtle">
                    <input
                      id={`camada-${c.id}`}
                      type="checkbox"
                      checked={camadas[c.id]}
                      onChange={(e) => setCamadas((v) => ({ ...v, [c.id]: e.target.checked }))}
                      className="mt-0.5 size-4 accent-[#8e2740]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink">{c.rotulo}</span>
                      <span className="block text-[11.5px] text-muted">{c.descricao}</span>
                    </span>
                  </label>
                ))}
                {modo === "3d" && (
                  <div className="mt-1 border-t border-line-soft px-2 pb-1 pt-2.5">
                    <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Qualidade</p>
                    <div className="flex gap-1 rounded-[8px] bg-control p-[3px]" role="group" aria-label="Qualidade do 3D">
                      {(["alta", "leve"] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          aria-pressed={qualidade === q}
                          onClick={() => trocarQualidade(q)}
                          className="h-7 flex-1 cursor-pointer rounded-[6px] border-0 bg-transparent text-[12px] text-ink-3 aria-pressed:bg-surface aria-pressed:font-medium aria-pressed:text-ink"
                        >
                          {q === "alta" ? "Alta" : "Leve"}
                        </button>
                      ))}
                    </div>
                    <p className="m-0 mt-1.5 text-[11px] text-meta">{qualidade ? "Escolhida por você." : "Automática pelo aparelho."} Leve desliga sombras e reduz árvores e público.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={cn("pointer-events-auto overflow-hidden", cartao)}>
            <BotaoMapa rotulo={telaCheia ? "Sair da tela cheia" : "Tela cheia"} atalho="F" onClick={alternarTelaCheia} className="size-10">
              {telaCheia ? <IconeSairTelaCheia /> : <IconeTelaCheia />}
            </BotaoMapa>
          </div>
        </div>

        {/* Controles de câmera e ajuda */}
        {usar3D && estado === "pronto" && (
          <div className={cn("pointer-events-auto absolute bottom-3 z-10 flex flex-col items-end gap-2", painelDireitoAberto && !estreito ? "right-[384px]" : "right-3", estreito && painelDireitoAberto && "bottom-[calc(62%+12px)]")}>
            {ajudaAberta && (
              <div role="dialog" aria-label="Atalhos do mapa" className="w-[290px] rounded-[10px] border border-line bg-surface p-3 shadow-[0_12px_28px_rgba(42,20,24,.14)] animate-fade-up-rapido">
                <p className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Como navegar</p>
                <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-[12.5px]">
                  {ATALHOS.map(([tecla, acao]) => (
                    <div key={tecla} className="contents">
                      <dt>
                        <kbd className="whitespace-nowrap rounded-[4px] border border-line bg-subtle px-1.5 py-px font-mono text-[11px] text-ink-2">{tecla}</kbd>
                      </dt>
                      <dd className="m-0 text-ink-2">{acao}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className={cn("flex flex-col overflow-hidden", cartao)}>
              <BotaoMapa rotulo="Aproximar" atalho="+" onClick={() => motorRef.current?.aproximar(0.65)}>
                <IconeMais />
              </BotaoMapa>
              <BotaoMapa rotulo="Afastar" atalho="-" onClick={() => motorRef.current?.aproximar(1.5)} className="border-t border-line-soft">
                <IconeMenos />
              </BotaoMapa>
              <BotaoMapa rotulo="Visão geral da arena" atalho="0" onClick={() => motorRef.current?.resetar()} className="border-t border-line-soft">
                <IconeEnquadrar />
              </BotaoMapa>
              <BotaoMapa rotulo="Norte para cima" atalho="N" onClick={() => motorRef.current?.orientarNorte()} className="border-t border-line-soft">
                <IconeNorte />
              </BotaoMapa>
              <BotaoMapa rotulo={vista === "perspectiva" ? "Ver de cima" : "Ver em perspectiva"} atalho="T" onClick={alternarVista} className="border-t border-line-soft">
                {vista === "perspectiva" ? <IconeSuperior /> : <IconePerspectiva />}
              </BotaoMapa>
              <BotaoMapa rotulo="Atalhos do teclado" atalho="?" ativo={ajudaAberta} onClick={() => setAjudaAberta((v) => !v)} className="border-t border-line-soft">
                <IconeTeclado />
              </BotaoMapa>
            </div>
          </div>
        )}

        {/* Minimapa e legenda */}
        <div className={cn("pointer-events-none absolute bottom-3 left-3 z-10 flex items-end gap-2", (indiceAberto || (estreito && painelDireitoAberto)) && "hidden")}>
          {usar3D && estado === "pronto" && !estreito && (
            <Minimapa arena={arena} camadas={camadas} selecionado={selecionado} pegadaRef={pegadaRef} onIr={(x, z) => motorRef.current?.irPara(x, z)} />
          )}
          <div className={cn("pointer-events-auto max-w-[250px]", cartao)}>
            <button type="button" aria-expanded={legendaAberta && largo} onClick={() => setLegendaAberta((v) => !v)} className="flex h-9 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3 text-[12px] font-medium text-ink-2">
              Legenda
              <span aria-hidden className={cn("text-[10px] text-muted transition-transform", legendaAberta && largo && "rotate-180")}>
                ▲
              </span>
            </button>
            {legendaAberta && largo && (
              <div className="border-t border-line-soft px-3 pb-2.5 pt-2 text-[12px] text-ink-2">
                <p className="m-0 mb-1 flex items-center gap-2">
                  <span aria-hidden className="block h-[3px] w-5 rounded-full" style={{ background: COR_PERCURSO }} />
                  Corredor isolado do percurso
                </p>
                <p className="m-0 mb-1.5 flex items-center gap-2">
                  <span aria-hidden className="flex h-2.5 w-5 overflow-hidden rounded-[2px]">
                    {arena.currais.map((c) => (
                      <span key={c.id} className="block h-full flex-1" style={{ background: c.cor }} />
                    ))}
                  </span>
                  Currais por pelotão
                </p>
                <div className="grid grid-cols-1 gap-y-1">
                  {categoriasPresentes.map((c) => (
                    <p key={c} className="m-0 flex items-center gap-2">
                      <span aria-hidden className="block size-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(42,20,24,.2)]" style={{ background: CATEGORIAS[c].cor }} />
                      {CATEGORIAS[c].rotulo}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {estado === "erro" && modo === "3d" && (
          <div role="alert" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-[10px] border border-danger-border bg-surface px-3.5 py-2.5 shadow-[0_8px_24px_rgba(42,20,24,.12)]">
            <span className="text-[12.5px] text-ink-2">
              <span className="font-medium text-danger">3D indisponível.</span> {erro} Mostrando a planta 2D.
            </span>
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setEstado("carregando");
                setTentativa((t) => t + 1);
              }}
              className="h-8 shrink-0 cursor-pointer rounded-[7px] border border-line-strong bg-surface px-2.5 text-[12px] text-ink hover:bg-subtle"
            >
              Tentar de novo
            </button>
          </div>
        )}
        {lento && usar3D && (
          <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-[10px] border border-warning-border bg-surface px-3.5 py-2.5 shadow-[0_8px_24px_rgba(42,20,24,.12)]">
            <span className="text-[12.5px] text-ink-2">O 3D está pesado neste computador.</span>
            <button type="button" onClick={() => trocarQualidade("leve")} className="h-8 cursor-pointer rounded-[7px] border-0 bg-accent px-2.5 text-[12px] font-medium text-white">
              Usar modo leve
            </button>
            <button type="button" onClick={() => setLento(false)} className="h-8 cursor-pointer rounded-[7px] border-0 bg-transparent px-2 text-[12px] text-ink-3">
              Manter
            </button>
          </div>
        )}
        {arena.pontos.length === 0 && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="rounded-[10px] border border-line bg-surface px-5 py-4 text-center">
              <p className="m-0 text-[14px] font-medium">Arena sem pontos cadastrados</p>
              <p className="m-0 mt-1 text-[12.5px] text-muted">Importe a planta ou a ata do evento para posicionar estruturas.</p>
            </div>
          </div>
        )}

        {indiceAberto && (
          <IndicePontos
            arena={arena}
            camadas={camadas}
            selecionado={selecionado}
            onEscolher={(id) => {
              const cat = CATEGORIAS[arena.pontos.find((p) => p.id === id)!.categoria];
              if (!camadas[cat.camada]) setCamadas((v) => ({ ...v, [cat.camada]: true }));
              selecionar(id, modo === "3d");
            }}
            onFechar={() => setIndiceAberto(false)}
          />
        )}
        {ponto && <PainelPonto arena={arena} ponto={ponto} estreito={estreito} onFechar={() => setSelecionado(null)} onAproximar={() => motorRef.current?.focar(ponto.id)} />}
        {!ponto && semPosicao && <PainelSemPosicao arena={arena} estreito={estreito} onFechar={() => setSemPosicao(false)} />}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-muted">
        <p className="m-0 max-w-[860px]">
          <span className="text-ink-2">Fontes:</span> {arena.fonte.documentos.map((d) => `${d.nome} (${d.detalhe})`).join(" · ")}. {arena.fonte.nota}
        </p>
        <button
          type="button"
          onClick={() => {
            setSelecionado(null);
            setSemPosicao(true);
          }}
          className="h-8 cursor-pointer rounded-[7px] border border-line-strong bg-surface px-3 text-[12.5px] text-ink-2 hover:bg-subtle"
        >
          Sem posição no mapa ({foraDoMapa})
        </button>
      </footer>
    </div>
  );
}
