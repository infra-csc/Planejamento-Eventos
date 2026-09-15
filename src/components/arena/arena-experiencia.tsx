"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Arena } from "@/domain/arena/tipos";
import { CAMADAS, CATEGORIAS, COR_PERCURSO, GRUPOS_CAMADAS, camadasEssenciais, camadasPadrao, camadasTudo, type Camada } from "@/domain/arena/categorias";
import { divergenciasDaArena } from "@/domain/arena/conferencia";
import { buscarPontos, itensNaoPosicionados } from "@/domain/arena/geometria";
import { cn } from "@/lib/cn";
import type { MotorArena } from "./cena/motor";
import type { Qualidade } from "./cena/materiais";
import { PainelAta, PainelPonto, PainelSemPosicao } from "./painel-ponto";
import { PainelConferencia } from "./painel-conferencia";
import { Plano2D } from "./plano-2d";
import { IndicePontos } from "./indice-pontos";
import { Minimapa } from "./minimapa";
import { IconeBusca, IconeCamadas, IconeEnquadrar, IconeLista, IconeMais, IconeMenos, IconeNorte, IconeSairTelaCheia, IconeTelaCheia } from "./icones";

type VistaMapa = "perspectiva" | "superior" | "planta";
type PainelEsquerdo = "indice" | "conferencia" | null;
type PainelDireito = "ficha" | "sem-posicao" | "ata" | null;

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** Uma pergunta ("como quero ver isto?"), três respostas com o nome do que a pessoa vê. */
const VISTAS: Array<[VistaMapa, string, string]> = [
  ["perspectiva", "Perspectiva", "Volume das estruturas em 3D"],
  ["superior", "De cima", "3D visto de cima, com sombras e volumes"],
  ["planta", "Planta", "Desenho vetorial, sem 3D — mais leve e imprimível"],
];

const ATALHOS: Array<[string, string]> = [
  ["Arrastar", "Mover o mapa"],
  ["Botão direito", "Girar a câmera"],
  ["Roda", "Aproximar no cursor"],
  ["← ↑ → ↓", "Mover"],
  ["+  −", "Aproximar e afastar"],
  ["0", "Enquadrar a arena"],
  ["N", "Norte para cima"],
  ["T", "Alternar perspectiva e de cima"],
  ["P", "Índice de pontos"],
  ["/", "Buscar ponto"],
  ["F", "Tela cheia"],
  ["Esc", "Fechar painel"],
];

const cartao = "rounded-cartao border border-line bg-surface/95 shadow-[0_2px_8px_rgba(42,20,24,.08)] backdrop-blur";
const botaoTexto = "h-[30px] cursor-pointer whitespace-nowrap rounded-[8px] border px-2.5 text-[12px] shadow-[0_2px_8px_rgba(42,20,24,.08)]";
const ativoTexto = (ativo: boolean) => (ativo ? "border-accent bg-accent-bg text-accent" : "border-line bg-surface/95 text-ink-2 hover:text-ink");

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

function Chip({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-[6px] bg-control/70 px-2 py-[3px] text-[12px]">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="m-0 text-ink">{children}</dd>
    </div>
  );
}

export function ArenaExperiencia({ arena }: { arena: Arena }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const pegadaRef = useRef<SVGPolygonElement>(null);
  const motorRef = useRef<MotorArena | null>(null);
  const camadasRef = useRef<Record<Camada, boolean>>(camadasPadrao());
  /** Elemento que abriu o painel: recebe o foco de volta quando o painel fecha. */
  const origemFoco = useRef<HTMLElement | null>(null);
  const aoSelecionarNoMapa = useRef<(id: string | null) => void>(() => undefined);
  const vistaRef = useRef<VistaMapa>("perspectiva");

  const [vistaMapa, setVistaMapa] = useState<VistaMapa>("perspectiva");
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [qualidade, setQualidade] = useState<Qualidade | null>(null);
  const [lento, setLento] = useState(false);
  const [camadas, setCamadas] = useState<Record<Camada, boolean>>(camadasPadrao);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [estreito, setEstreito] = useState(false);
  const [largo, setLargo] = useState(true);
  const [painelCamadas, setPainelCamadas] = useState(false);
  const [painelEsquerdo, setPainelEsquerdo] = useState<PainelEsquerdo>(null);
  const [painelDireito, setPainelDireito] = useState<PainelDireito>(null);
  const [focoConferencia, setFocoConferencia] = useState<string | null>(null);
  const [fontesAbertas, setFontesAbertas] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(true);
  const [termo, setTermo] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [indiceBusca, setIndiceBusca] = useState(0);

  const modo = vistaMapa === "planta" ? "2d" : "3d";
  const ponto = arena.pontos.find((p) => p.id === selecionado) ?? null;
  const resultados = useMemo(() => buscarPontos(arena.pontos, termo).slice(0, 8), [arena.pontos, termo]);
  const foraDoMapa = itensNaoPosicionados(arena).length + arena.semPosicaoNaPlanta.length;
  const categoriasPresentes = [...new Set(arena.pontos.map((p) => p.categoria))];
  const divergencias = useMemo(() => divergenciasDaArena(arena), [arena]);
  const idsDivergentes = useMemo(() => new Set(divergencias.flatMap((d) => d.pontoIds)), [divergencias]);
  const conferenciaAtiva = painelEsquerdo === "conferencia";
  const idsFoco = useMemo(() => new Set(divergencias.find((d) => d.id === focoConferencia)?.pontoIds ?? []), [divergencias, focoConferencia]);
  // Ordem de tabulação dos marcadores: espacial (norte → sul), não a de autoria dos dados.
  const pontosOrdenados = useMemo(() => [...arena.pontos].sort((a, b) => a.posicao[1] - b.posicao[1] || a.posicao[0] - b.posicao[0]), [arena.pontos]);
  const pontosPorCamada = useMemo(() => {
    const contagem: Partial<Record<Camada, number>> = {};
    for (const p of arena.pontos) {
      const c = CATEGORIAS[p.categoria].camada;
      contagem[c] = (contagem[c] ?? 0) + 1;
    }
    return contagem;
  }, [arena.pontos]);
  const usar3D = modo === "3d" && estado !== "erro";
  const mostrarPlano = modo === "2d" || estado === "erro";
  const fichaAberta = painelDireito === "ficha" && Boolean(ponto);
  const direitaAberta = fichaAberta || painelDireito === "sem-posicao" || painelDireito === "ata";
  const opcaoAtiva = buscaAberta ? resultados[indiceBusca] : undefined;

  /* ------------------------------------------------------------------ */
  /* Painéis: um de cada lado, e conferência nunca junto da ficha         */
  /* ------------------------------------------------------------------ */

  const lembrarFoco = () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) origemFoco.current = el;
  };
  const devolverFoco = () => {
    const el = origemFoco.current;
    origemFoco.current = null;
    requestAnimationFrame(() => {
      if (el?.isConnected) el.focus();
    });
  };

  /** Ver um ponto: sai da conferência e abre a ficha. */
  const abrirPonto = (id: string, aproximar = false) => {
    lembrarFoco();
    setSelecionado(id);
    setPainelDireito("ficha");
    setPainelEsquerdo((p) => (p === "conferencia" ? null : p));
    if (aproximar) motorRef.current?.focar(id);
  };

  const fecharDireito = () => {
    setPainelDireito(null);
    setSelecionado(null);
    devolverFoco();
  };

  const alternarIndice = () => {
    lembrarFoco();
    setPainelEsquerdo((p) => (p === "indice" ? null : "indice"));
  };

  const abrirConferencia = (focoId: string | null = null) => {
    lembrarFoco();
    setPainelEsquerdo("conferencia");
    setFocoConferencia(focoId);
    setSelecionado(null);
    setPainelDireito(null);
    setFontesAbertas(false);
  };

  const alternarConferencia = () => {
    if (conferenciaAtiva) {
      setPainelEsquerdo(null);
      setFocoConferencia(null);
    } else abrirConferencia();
  };

  const focarDivergencia = (id: string) => {
    setFocoConferencia(id);
    const d = divergencias.find((x) => x.id === id);
    if (d?.pontoIds[0] && modo === "3d") motorRef.current?.focar(d.pontoIds[0]);
  };

  const abrirSemPosicao = () => {
    lembrarFoco();
    setSelecionado(null);
    setPainelDireito((p) => (p === "sem-posicao" ? null : "sem-posicao"));
    setPainelEsquerdo((p) => (p === "conferencia" ? null : p));
  };

  const escolherVista = (v: VistaMapa) => {
    if (v === vistaMapa) return;
    if (vistaMapa === "planta") {
      setEstado("carregando");
      setErro(null);
    }
    setVistaMapa(v);
    if (v !== "planta") motorRef.current?.vista(v);
  };

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
            aoSelecionar: (id) => aoSelecionarNoMapa.current(id),
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

  // Clique num ponto do mapa sempre significa "quero ver este ponto"; no vazio, fecha a ficha.
  useEffect(() => {
    vistaRef.current = vistaMapa;
    aoSelecionarNoMapa.current = (id) => {
      if (id) abrirPonto(id);
      else if (painelDireito === "ficha") fecharDireito();
    };
  });

  useEffect(() => {
    camadasRef.current = camadas;
    motorRef.current?.definirCamadas(camadas);
    motorRef.current?.invalidar();
  }, [camadas, estado]);

  useEffect(() => {
    motorRef.current?.definirSelecao(selecionado);
    motorRef.current?.invalidar();
  }, [selecionado, estado]);

  useEffect(() => {
    motorRef.current?.definirRealce(conferenciaAtiva ? idsDivergentes : null);
  }, [conferenciaAtiva, idsDivergentes, estado]);

  // A cena sempre nasce em perspectiva; se a vista escolhida era "de cima", aplica quando fica pronta.
  useEffect(() => {
    if (estado === "pronto" && vistaRef.current === "superior") motorRef.current?.vista("superior");
  }, [estado]);

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

  const escolherResultado = (id: string) => {
    setBuscaAberta(false);
    setTermo("");
    const cat = CATEGORIAS[arena.pontos.find((p) => p.id === id)?.categoria ?? "estrutura"];
    if (!camadas[cat.camada]) setCamadas((v) => ({ ...v, [cat.camada]: true }));
    abrirPonto(id, modo === "3d");
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
        else if (fontesAbertas) setFontesAbertas(false);
        else if (painelCamadas) setPainelCamadas(false);
        else if (painelDireito) fecharDireito();
        else if (painelEsquerdo) {
          setPainelEsquerdo(null);
          setFocoConferencia(null);
          devolverFoco();
        }
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
        t: () => {
          if (vistaMapa !== "planta") escolherVista(vistaMapa === "perspectiva" ? "superior" : "perspectiva");
        },
        p: alternarIndice,
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

  const totalDivergencias = divergencias.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho em uma linha: lido uma vez, não pode roubar altura do mapa para sempre. */}
      <header className="flex items-center gap-x-3">
        <h1 className="m-0 shrink-0 whitespace-nowrap text-[20px] font-semibold tracking-[-0.02em] text-ink">{arena.evento.nome}</h1>
        <span className="shrink-0 font-mono text-[12px] text-muted">{arena.evento.sku}</span>
        {/* Uma linha sempre: em telas mais estreitas os chips são cortados, não empurram o botão para baixo. */}
        <dl className="m-0 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden [&>div]:shrink-0">
          <Chip rotulo="Prova">
            <span className="font-mono">{DATA.format(new Date(`${arena.evento.data}T12:00:00Z`))}</span>
          </Chip>
          <Chip rotulo="Largadas">
            <span className="font-mono">{arena.evento.largadas.map((l) => `${l.distancia} ${l.hora}`).join(" · ")}</span>
          </Chip>
          {arena.evento.publicoEsperado && (
            <Chip rotulo="Público">
              <span className="font-mono tabular-nums">{arena.evento.publicoEsperado.toLocaleString("pt-BR")}</span>
            </Chip>
          )}
          {arena.evento.diretorProva && <Chip rotulo="Direção">{arena.evento.diretorProva}</Chip>}
        </dl>
        {totalDivergencias === 0 ? (
          <span className="flex h-[30px] shrink-0 items-center rounded-[8px] border border-success-border bg-success-bg px-3 text-[12.5px] font-medium text-success">Planta e ata conferidas</span>
        ) : (
          <button
            type="button"
            aria-pressed={conferenciaAtiva}
            onClick={alternarConferencia}
            className={cn(
              "flex h-[30px] shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[8px] border px-[11px] text-[12.5px] font-medium",
              conferenciaAtiva ? "border-warning bg-warning text-white" : "border-warning-border bg-warning-bg text-warning hover:brightness-[0.98]",
            )}
          >
            <span aria-hidden className={cn("block size-1.5 animate-pulse-dot rounded-full", conferenciaAtiva ? "bg-warning-bg" : "bg-danger")} />
            {totalDivergencias} {totalDivergencias === 1 ? "item a conferir" : "itens a conferir"}
          </button>
        )}
      </header>

      <div
        ref={wrapperRef}
        className={cn(
          "overflow-hidden border border-line bg-[#e6e2dc]",
          telaCheia ? "fixed inset-0 z-[var(--z-tela-cheia)] h-[100dvh] w-screen rounded-none border-0" : "relative h-[calc(100dvh-140px)] min-h-[520px] rounded-modal",
        )}
      >
        {/* Cena 3D */}
        <div ref={hostRef} className={cn("absolute inset-0", !usar3D && "hidden")} />
        <div ref={overlayRef} data-zoom="longe" className={cn("group/mapa pointer-events-none absolute inset-0 overflow-hidden", !usar3D && "hidden")}>
          {usar3D &&
            estado === "pronto" &&
            pontosOrdenados
              .filter((p) => camadas[CATEGORIAS[p.categoria].camada])
              .map((p) => {
                const ativo = p.id === selecionado;
                const emFoco = ativo || p.id === hover || idsFoco.has(p.id);
                const divergente = conferenciaAtiva && idsDivergentes.has(p.id);
                const apagado = conferenciaAtiva && !divergente;
                const rotulo = conferenciaAtiva ? divergente && (camadas.rotulos || emFoco) : camadas.rotulos || emFoco;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-ponto-id={p.id}
                    aria-label={`${p.nome}, ${p.tipo}${divergente ? ", com divergência entre planta e ata" : ""}`}
                    aria-pressed={ativo}
                    onClick={() => abrirPonto(p.id)}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover(null)}
                    data-prioridade={ativo ? 3 : emFoco ? 2 : divergente || p.principal ? 1 : 0}
                    className="group/pin pointer-events-auto absolute left-0 top-0 cursor-pointer border-0 bg-transparent p-0 will-change-transform"
                    style={{ visibility: "hidden", zIndex: emFoco ? 3 : divergente || p.principal ? 2 : 1 }}
                  >
                    <span className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
                      <span
                        data-rotulo
                        className={cn(
                          "mb-1 whitespace-nowrap rounded-[6px] border px-1.5 py-[3px] text-[11.5px] font-medium leading-none shadow-[0_1px_2px_rgba(42,20,24,.12)] transition-[opacity,transform] duration-150 group-data-[oculto=1]/pin:opacity-0",
                          ativo ? "border-accent bg-accent text-white" : divergente ? "border-danger-border bg-surface/95 text-danger" : "border-line bg-surface/95 text-ink",
                          !rotulo && "hidden",
                          !emFoco && !p.principal && !divergente && "group-data-[zoom=longe]/mapa:hidden",
                        )}
                      >
                        {p.legenda && !emFoco && <span className="mr-1 font-mono text-[10.5px] opacity-60">{p.legenda.split(" ")[0]}</span>}
                        {p.nome}
                        {emFoco && !ativo && <span className="ml-1.5 font-normal text-muted">· {p.tipo}</span>}
                      </span>
                      <span className="relative grid place-items-center">
                        {divergente && <span aria-hidden className={cn("absolute size-[22px] rounded-full border-[1.5px] border-dashed border-danger", !idsFoco.has(p.id) && "opacity-70")} />}
                        <span
                          className={cn("block rounded-full border-2 border-white shadow-[0_1px_3px_rgba(42,20,24,.35)] transition-transform duration-150", apagado ? "size-2" : divergente ? "size-3.5" : ativo ? "size-3.5 scale-110" : emFoco ? "size-3 scale-110" : "size-2.5")}
                          style={{ background: apagado ? "#c3bcbc" : divergente ? "#a8400f" : CATEGORIAS[p.categoria].cor }}
                        />
                      </span>
                      <span aria-hidden className="block h-2 w-px bg-ink/40" />
                    </span>
                  </button>
                );
              })}
        </div>

        {mostrarPlano && (
          <Plano2D
            arena={arena}
            camadas={camadas}
            selecionado={selecionado}
            realce={conferenciaAtiva ? { destaque: idsDivergentes, foco: idsFoco } : null}
            recuoDireita={direitaAberta && !estreito}
            onSelecionar={(id) => aoSelecionarNoMapa.current(id)}
          />
        )}

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

        {/* Barra superior: busca e índice à esquerda; vista, camadas e tela cheia à direita. A busca encolhe em vez de estourar. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="pointer-events-auto relative min-w-0 max-w-[320px] flex-[1_1_200px]">
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
                onBlur={() => setBuscaAberta(false)}
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
                aria-autocomplete="list"
                aria-activedescendant={opcaoAtiva ? `arena-opcao-${opcaoAtiva.id}` : undefined}
                className="h-10 w-full rounded-[9px] border border-line bg-surface/95 pl-9 pr-10 text-[13.5px] text-ink shadow-[0_2px_8px_rgba(42,20,24,.08)] backdrop-blur placeholder:text-meta focus:border-accent focus:outline-none"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[4px] border border-line bg-subtle px-1.5 font-mono text-[10.5px] text-muted">/</kbd>
              {buscaAberta && (
                <ul id="arena-busca-lista" role="listbox" aria-label="Pontos encontrados" className="absolute left-0 right-0 top-11 m-0 max-h-[320px] list-none overflow-y-auto rounded-[9px] border border-line bg-surface p-1 shadow-[0_12px_28px_rgba(42,20,24,.14)]">
                  {resultados.length === 0 ? (
                    <li className="px-3 py-2.5 text-[12.5px] text-muted">Nada encontrado para “{termo}”.</li>
                  ) : (
                    resultados.map((p, i) => (
                      <li
                        key={p.id}
                        id={`arena-opcao-${p.id}`}
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
            <div className={cn("pointer-events-auto shrink-0 overflow-hidden", cartao)}>
              <BotaoMapa rotulo="Índice de pontos" atalho="P" ativo={painelEsquerdo === "indice"} onClick={alternarIndice} className="size-10">
                <IconeLista />
              </BotaoMapa>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <div className={cn("pointer-events-auto flex overflow-hidden", cartao)} role="group" aria-label="Vista do mapa">
              {VISTAS.map(([v, rotulo, titulo]) => (
                <button
                  key={v}
                  type="button"
                  title={titulo}
                  aria-pressed={vistaMapa === v}
                  onClick={() => escolherVista(v)}
                  className="h-10 cursor-pointer whitespace-nowrap border-0 bg-transparent px-[13px] text-[12.5px] font-medium text-ink-3 hover:text-ink aria-pressed:bg-dark aria-pressed:text-white"
                >
                  {rotulo}
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
                <div className="absolute right-0 top-12 z-40 w-[292px] rounded-cartao border border-line bg-surface shadow-[0_12px_28px_rgba(42,20,24,.14)] animate-fade-up-rapido">
                  <div className="flex items-center gap-1.5 border-b border-line-soft px-2.5 py-[9px]">
                    <p className="m-0 flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">O que aparece no mapa</p>
                    <button type="button" onClick={() => setCamadas(camadasTudo())} className="h-6 cursor-pointer rounded-[6px] border border-line-strong bg-surface px-2 text-[11.5px] text-ink-2 hover:bg-subtle">
                      Tudo
                    </button>
                    <button type="button" onClick={() => setCamadas(camadasEssenciais())} title="Padrões sem o público: para conferir implantação" className="h-6 cursor-pointer rounded-[6px] border border-line-strong bg-surface px-2 text-[11.5px] text-ink-2 hover:bg-subtle">
                      Essencial
                    </button>
                  </div>
                  <div className="p-1">
                    {GRUPOS_CAMADAS.map((g, i) => (
                      <fieldset key={g.titulo} className={cn("m-0 border-0 p-0", i > 0 && "mt-0.5 border-t border-line-faint pt-0.5")}>
                        <legend className="px-2 pb-[3px] pt-1.5 text-[11.5px] font-medium text-ink-2">{g.titulo}</legend>
                        {g.camadas
                          .filter((id) => modo === "3d" || (id !== "publico" && id !== "fluxo"))
                          .map((id) => {
                            const c = CAMADAS.find((x) => x.id === id);
                            if (!c) return null;
                            const n = pontosPorCamada[id];
                            return (
                              <label key={id} htmlFor={`camada-${id}`} className="flex cursor-pointer items-start gap-2.5 rounded-[7px] px-2 py-[5px] hover:bg-subtle">
                                <input id={`camada-${id}`} type="checkbox" checked={camadas[id]} onChange={(e) => setCamadas((v) => ({ ...v, [id]: e.target.checked }))} className="mt-0.5 size-4 accent-accent" />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] text-ink">{c.rotulo}</span>
                                  <span className="block text-[11.5px] leading-[1.4] text-muted">{c.descricao}</span>
                                </span>
                                {n ? (
                                  <span className="shrink-0 font-mono text-[11px] text-meta" aria-label={`${n} pontos`}>
                                    {n}
                                  </span>
                                ) : null}
                              </label>
                            );
                          })}
                      </fieldset>
                    ))}
                  </div>
                  {modo === "3d" && (
                    <div className="border-t border-line-soft px-3 pb-2.5 pt-2.5">
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
        </div>

        {/* Canto inferior direito: procedência e itens sem posição a um clique, câmera (4) e atalhos. */}
        <div className={cn("pointer-events-none absolute z-10 flex flex-col items-end gap-2", direitaAberta && !estreito ? "right-[384px]" : "right-3", mostrarPlano ? "bottom-[132px]" : "bottom-3")}>
          {fontesAbertas && (
            <div role="dialog" aria-labelledby="fontes-titulo" className="pointer-events-auto max-w-[360px] rounded-cartao border border-line bg-surface px-[13px] py-[11px] shadow-[0_12px_28px_rgba(42,20,24,.14)] animate-fade-up-rapido">
              <p id="fontes-titulo" className="m-0 mb-[5px] text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
                Fontes deste mapa
              </p>
              <ul className="m-0 list-none p-0 text-[11.5px] leading-[1.5] text-ink-2">
                {arena.fonte.documentos.map((d) => (
                  <li key={d.nome} className="mb-1">
                    <span className="font-medium text-ink">{d.nome}</span> — {d.detalhe}
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-1 text-[11.5px] leading-[1.5] text-muted">{arena.fonte.nota}</p>
            </div>
          )}
          {ajudaAberta && usar3D && (
            <div role="dialog" aria-labelledby="atalhos-titulo" className="pointer-events-auto w-[290px] rounded-cartao border border-line bg-surface p-3 shadow-[0_12px_28px_rgba(42,20,24,.14)] animate-fade-up-rapido">
              <p id="atalhos-titulo" className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Como navegar
              </p>
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
          <div className="pointer-events-auto flex gap-1.5">
            <button type="button" aria-expanded={fontesAbertas} onClick={() => setFontesAbertas((v) => !v)} className={cn(botaoTexto, ativoTexto(fontesAbertas))}>
              Fontes
            </button>
            <button type="button" aria-pressed={painelDireito === "sem-posicao"} onClick={abrirSemPosicao} className={cn(botaoTexto, ativoTexto(painelDireito === "sem-posicao"))}>
              Sem posição ({foraDoMapa})
            </button>
          </div>
          {usar3D && estado === "pronto" && (
            <div className={cn("pointer-events-auto flex flex-col overflow-hidden", cartao)}>
              <BotaoMapa rotulo="Aproximar" atalho="+" onClick={() => motorRef.current?.aproximar(0.65)}>
                <IconeMais />
              </BotaoMapa>
              <BotaoMapa rotulo="Afastar" atalho="-" onClick={() => motorRef.current?.aproximar(1.5)} className="border-t border-line-soft">
                <IconeMenos />
              </BotaoMapa>
              <BotaoMapa rotulo="Enquadrar a arena" atalho="0" onClick={() => motorRef.current?.resetar()} className="border-t border-line-soft">
                <IconeEnquadrar />
              </BotaoMapa>
              <BotaoMapa rotulo="Norte para cima" atalho="N" onClick={() => motorRef.current?.orientarNorte()} className="border-t border-line-soft">
                <IconeNorte />
              </BotaoMapa>
              {/* Sem teclado em aparelho de toque: o cartão de atalhos seria ruído. */}
              <BotaoMapa rotulo="Atalhos do teclado" atalho="?" ativo={ajudaAberta} onClick={() => setAjudaAberta((v) => !v)} className="border-t border-line-soft font-mono text-[14px] [@media(pointer:coarse)]:hidden">
                ?
              </BotaoMapa>
            </div>
          )}
        </div>

        {/* Minimapa e legenda: recuam quando há painel à esquerda, em vez de sumir (a orientação continua). */}
        <div className={cn("pointer-events-none absolute bottom-3 z-10 flex items-end gap-2", painelEsquerdo && !estreito ? "left-[376px]" : "left-3", estreito && (direitaAberta || painelEsquerdo) && "hidden")}>
          {usar3D && estado === "pronto" && !estreito && <Minimapa arena={arena} camadas={camadas} selecionado={selecionado} pegadaRef={pegadaRef} onIr={(x, z) => motorRef.current?.irPara(x, z)} />}
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
                  {conferenciaAtiva ? (
                    <>
                      <p className="m-0 flex items-center gap-2">
                        <span aria-hidden className="block size-2.5 rounded-full border-2 border-white bg-danger shadow-[0_0_0_1px_rgba(42,20,24,.2)]" />
                        Planta e ata divergem
                      </p>
                      <p className="m-0 flex items-center gap-2">
                        <span aria-hidden className="block size-2.5 rounded-full border-2 border-white bg-[#c3bcbc] shadow-[0_0_0_1px_rgba(42,20,24,.2)]" />
                        Sem divergência
                      </p>
                    </>
                  ) : (
                    categoriasPresentes.map((c) => (
                      <p key={c} className="m-0 flex items-center gap-2">
                        <span aria-hidden className="block size-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(42,20,24,.2)]" style={{ background: CATEGORIAS[c].cor }} />
                        {CATEGORIAS[c].rotulo}
                      </p>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {estado === "erro" && modo === "3d" && (
          <div role="alert" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-cartao border border-danger-border bg-surface px-3.5 py-2.5 shadow-[0_8px_24px_rgba(42,20,24,.12)]">
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
              className="h-8 shrink-0 cursor-pointer rounded-[7px] border border-line-control bg-surface px-2.5 text-[12px] text-ink hover:bg-subtle"
            >
              Tentar de novo
            </button>
          </div>
        )}
        {lento && usar3D && (
          <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-cartao border border-warning-border bg-surface px-3.5 py-2.5 shadow-[0_8px_24px_rgba(42,20,24,.12)]">
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
            <div className="rounded-cartao border border-line bg-surface px-5 py-4 text-center">
              <p className="m-0 text-[14px] font-medium">Arena sem pontos cadastrados</p>
              <p className="m-0 mt-1 text-[12.5px] text-muted">Importe a planta ou a ata do evento para posicionar estruturas.</p>
            </div>
          </div>
        )}

        {painelEsquerdo === "indice" && (
          <IndicePontos
            arena={arena}
            camadas={camadas}
            selecionado={selecionado}
            onEscolher={(id) => {
              const cat = CATEGORIAS[arena.pontos.find((p) => p.id === id)?.categoria ?? "estrutura"];
              if (!camadas[cat.camada]) setCamadas((v) => ({ ...v, [cat.camada]: true }));
              abrirPonto(id, modo === "3d");
            }}
            onFechar={() => {
              setPainelEsquerdo(null);
              devolverFoco();
            }}
          />
        )}
        {conferenciaAtiva && (
          <PainelConferencia
            arena={arena}
            divergencias={divergencias}
            camadas={camadas}
            foco={focoConferencia}
            onFocar={focarDivergencia}
            onVerFicha={(id) => abrirPonto(id, modo === "3d")}
            onFechar={() => {
              setPainelEsquerdo(null);
              setFocoConferencia(null);
              devolverFoco();
            }}
          />
        )}
        {fichaAberta && ponto && (
          <PainelPonto
            arena={arena}
            ponto={ponto}
            estreito={estreito}
            divergente={idsDivergentes.has(ponto.id)}
            onFechar={fecharDireito}
            onAproximar={usar3D ? () => motorRef.current?.focar(ponto.id) : undefined}
            onConferir={() => abrirConferencia(divergencias.find((d) => d.pontoIds.includes(ponto.id))?.id ?? null)}
            onAbrirAta={() => setPainelDireito("ata")}
          />
        )}
        {painelDireito === "ata" && <PainelAta arena={arena} ponto={ponto} estreito={estreito} onFechar={fecharDireito} />}
        {painelDireito === "sem-posicao" && <PainelSemPosicao arena={arena} estreito={estreito} onFechar={fecharDireito} />}
      </div>
    </div>
  );
}
