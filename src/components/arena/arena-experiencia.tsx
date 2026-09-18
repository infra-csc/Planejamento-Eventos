"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Arena, PontoArena, Vec2 } from "@/domain/arena/tipos";
import { CAMADAS, CATEGORIAS, COR_PERCURSO, GRUPOS_CAMADAS, camadasEssenciais, camadasPadrao, camadasTudo, prioridadeRotulo, type Camada } from "@/domain/arena/categorias";
import { chaveItemAta, descreverGiro, distancia, distanciaPrecisa, normalizarAngulo, quantidadeAta, rotuloDistancia } from "@/domain/arena/posicoes";
import { divergenciasDaArena } from "@/domain/arena/conferencia";
import { buscarPontos, itensNaoPosicionados } from "@/domain/arena/geometria";
import { cn } from "@/lib/cn";
import type { MotorArena } from "./cena/motor";
import type { Qualidade } from "./cena/materiais";
import { PainelAta, PainelPonto, PainelSemPosicao, type PosicionarItem } from "./painel-ponto";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removerPosicaoArenaAction, restaurarPlantaArenaFormAction, salvarPosicaoArenaAction } from "@/app/(app)/arena/actions";
import { toast, toastErro } from "@/components/ui/toast";
import { Badge, ChipMono } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/field";
import { IconeLapis } from "@/components/ui/icons";
import { EmptyState, Kbd, Meta, PageHeader, RotuloGrupo } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { PainelConferencia } from "./painel-conferencia";
import { Plano2D } from "./plano-2d";
import { IndicePontos } from "./indice-pontos";
import { Minimapa } from "./minimapa";
import { IconeBusca, IconeCamadas, IconeEnquadrar, IconeImprimir, IconeLista, IconeMais, IconeMenos, IconeNorte, IconeRegua, IconeSairTelaCheia, IconeTelaCheia } from "./icones";

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
  ["M", "Medir distância"],
  ["Q  E", "Girar o ponto selecionado (edição)"],
  ["Ctrl Z", "Desfazer (edição)"],
  ["Esc", "Fechar painel ou parar de medir"],
];

const cartao = "rounded-cartao border border-line bg-surface/95 shadow-pill backdrop-blur";

function BotaoMapa({
  rotulo,
  atalho,
  onClick,
  children,
  ativo,
  className,
  tamanho = "md",
}: {
  rotulo: string;
  atalho?: string;
  onClick: () => void;
  children: React.ReactNode;
  ativo?: boolean;
  className?: string;
  /** `campo`: mesma altura do Input (34px), para a barra superior. */
  tamanho?: "md" | "campo";
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={atalho ? `${rotulo} (${atalho})` : rotulo}
      aria-pressed={ativo}
      aria-keyshortcuts={atalho}
      onClick={onClick}
      className={cn(
        "grid cursor-pointer place-items-center border-0 bg-transparent text-ink-2 hover:bg-subtle hover:text-ink aria-pressed:bg-accent-bg aria-pressed:text-accent",
        tamanho === "campo" ? "size-[34px]" : "size-9",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * O que a logística mais acrescenta no mapa: obstáculos do terreno e apoios simples.
 * Um clique escolhe o item, o próximo clique põe no lugar — sem formulário antes.
 */
const ATALHOS_ITEM: Array<{ nome: string; categoria: string }> = [
  { nome: "Árvore", categoria: "obstaculo" },
  { nome: "Bueiro", categoria: "obstaculo" },
  { nome: "Poste", categoria: "obstaculo" },
  { nome: "Desnível / rampa", categoria: "obstaculo" },
  { nome: "Grade / barreira", categoria: "operacao" },
  { nome: "Tenda extra", categoria: "operacao" },
  { nome: "Banheiro químico", categoria: "operacao" },
  { nome: "Ponto de energia", categoria: "operacao" },
];

/** Ajuste salvo agora e ainda não refletido pelo servidor. */
type Ajuste = { posicao?: [number, number]; rotacao?: number };
/** Registro de arena_posicoes como a interface consegue recriá-lo (inclusive de um ponto excluído). */
type Registro = { tipo: "MOVER" | "NOVO"; x: number; z: number; nome: string; categoria: string; itemAta: string | null; rotacao: number | null };
/** Ação desta sessão de edição. Desfazer = devolver o registro do ponto ao que era antes (ou apagá-lo, se não havia). */
type AcaoEdicao = { rotulo: string; chave: string; antes: Registro | null };

const LIMITE_DESFAZER = 30;
const PASSO_GIRO = Math.PI / 12;
const tipoRegistro = (chave: string) => (chave.startsWith("novo:") ? "NOVO" : "MOVER");
const itemAtaDe = (p: PontoArena) => (p.itensAta[0] ? chaveItemAta(p.itensAta[0]) : null);

export function ArenaExperiencia({
  arena: arenaServidor,
  podeEditar = false,
  editadas = [],
  plantaImagemUrl = null,
}: {
  arena: Arena;
  podeEditar?: boolean;
  editadas?: string[];
  /** Imagem da planta do evento: fundo da Planta 2D e textura no chão do 3D, no retângulo `arena.area`. */
  plantaImagemUrl?: string | null;
}) {
  const router = useRouter();
  const [salvando, iniciarSalvar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);
  const [menuItens, setMenuItens] = useState(false);
  /** Ações desta sessão de edição, da mais antiga à mais recente, para o "Desfazer". */
  const [pilha, setPilha] = useState<AcaoEdicao[]>([]);
  const [colocando, setColocando] = useState<PosicionarItem | null>(null);
  // Formulário do banner de edição: item novo (fora da planta) ou nome/categoria do ponto selecionado.
  const [formEdicao, setFormEdicao] = useState<{ modo: "novo" | "info"; nome: string; categoria: string } | null>(null);
  // Posições e giros salvos agora e ainda não refletidos pelo servidor: o ponto não "pula de volta" enquanto recarrega.
  const [locais, setLocais] = useState<Record<string, Ajuste>>({});
  // Registros criados (true) ou apagados (false) nesta sessão e ainda não refletidos em `editadas`.
  const [registrosLocais, setRegistrosLocais] = useState<Record<string, boolean>>({});
  // Arraste em andamento no 3D: só desenho, nada salvo ainda.
  const [previa, setPrevia] = useState<{ id: string; posicao: [number, number] } | null>(null);
  const [baseServidor, setBaseServidor] = useState(arenaServidor);
  if (baseServidor !== arenaServidor) {
    setBaseServidor(arenaServidor);
    setLocais({});
    setRegistrosLocais({});
  }
  const arenaSalva = useMemo(() => {
    if (Object.keys(locais).length === 0) return arenaServidor;
    return {
      ...arenaServidor,
      pontos: arenaServidor.pontos.map((p) => {
        const l = locais[p.id];
        return l ? { ...p, posicao: l.posicao ?? p.posicao, rotacao: l.rotacao ?? p.rotacao } : p;
      }),
    };
  }, [arenaServidor, locais]);
  const arena = useMemo(
    () => (previa ? { ...arenaSalva, pontos: arenaSalva.pontos.map((p) => (p.id === previa.id ? { ...p, posicao: previa.posicao } : p)) } : arenaSalva),
    [arenaSalva, previa],
  );
  const idsEditados = useMemo(() => new Set(editadas), [editadas]);
  const temRegistro = (chave: string) => (chave in registrosLocais ? registrosLocais[chave] : idsEditados.has(chave));
  /** A cena 3D nasce com a arena do momento; depois as edições chegam por `atualizarPontos`, sem remontar a cada arraste. */
  const arenaCenaRef = useRef(arena);
  useLayoutEffect(() => {
    arenaCenaRef.current = arena;
  });
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
  /** Clique no chão do 3D: no modo edição com item escolhido, posiciona ali. */
  const aoClicarChaoRef = useRef<(x: number, z: number) => boolean>(() => false);
  /** Arraste de marcador no 3D (modo edição). */
  const arraste3d = useRef<{ id: string; x0: number; y0: number; moveu: boolean; ultimo: [number, number] | null; dx: number; dy: number } | null>(null);
  const ignorarClique = useRef(false);
  const vistaRef = useRef<VistaMapa>("perspectiva");

  const [vistaMapa, setVistaMapa] = useState<VistaMapa>("planta");
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
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [indiceBusca, setIndiceBusca] = useState(0);
  const [plantaFundo, setPlantaFundo] = useState(true);
  // Régua: `a` e `b` em metros; `cursorMedida` é a prévia da segunda ponta sob o ponteiro.
  const [medindo, setMedindo] = useState(false);
  const [medida, setMedida] = useState<{ a: Vec2 | null; b: Vec2 | null }>({ a: null, b: null });
  const [cursorMedida, setCursorMedida] = useState<Vec2 | null>(null);
  const cursorRaf = useRef(0);

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
  const quantidades = useMemo(() => new Map(arena.pontos.map((p) => [p.id, quantidadeAta(p)])), [arena.pontos]);
  const distanciaMedida = medida.a && medida.b ? distancia(medida.a, medida.b) : null;
  const pontaMedida = medida.b ?? (medida.a ? cursorMedida : null);

  /* ------------------------------------------------------------------ */
  /* Régua: dois cliques (no chão ou num ponto), o terceiro recomeça      */
  /* ------------------------------------------------------------------ */

  const pararMedicao = () => {
    cancelAnimationFrame(cursorRaf.current);
    setMedindo(false);
    setMedida({ a: null, b: null });
    setCursorMedida(null);
  };
  const alternarMedicao = () => {
    if (medindo) return pararMedicao();
    // Medir não convive com posicionar item: o clique seria disputado pelos dois.
    setMedindo(true);
    setMedida({ a: null, b: null });
    setColocando(null);
    setMenuItens(false);
    setFormEdicao(null);
  };
  const marcarMedida = (x: number, z: number) => {
    setCursorMedida(null);
    setMedida((m) => (!m.a || m.b ? { a: [x, z], b: null } : { a: m.a, b: [x, z] }));
  };
  /** Prévia sob o ponteiro, no máximo uma por quadro. */
  const moverCursorMedida = (p: Vec2 | null) => {
    cancelAnimationFrame(cursorRaf.current);
    cursorRaf.current = requestAnimationFrame(() => setCursorMedida(p));
  };

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
          arena: arenaCenaRef.current,
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
            aoClicarChao: (x, z) => aoClicarChaoRef.current(x, z),
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
  }, [modo, qualidade, tentativa]);

  // Clique num ponto do mapa sempre significa "quero ver este ponto"; no vazio, fecha a ficha.
  useEffect(() => {
    vistaRef.current = vistaMapa;
    aoSelecionarNoMapa.current = (id) => {
      // Medindo, o clique é da régua (o motor já entrega o chão; este é o caso do clique no céu).
      if (medindo) return;
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
    if (estado === "pronto") motorRef.current?.atualizarPontos(arena.pontos);
    if (estado === "pronto") motorRef.current?.modoEdicao(editando);
  }, [arena.pontos, estado, editando]);

  useEffect(() => {
    motorRef.current?.definirSelecao(selecionado);
    motorRef.current?.invalidar();
  }, [selecionado, estado]);

  useEffect(() => {
    motorRef.current?.definirRealce(conferenciaAtiva ? idsDivergentes : null);
  }, [conferenciaAtiva, idsDivergentes, estado]);

  useEffect(() => {
    if (estado === "pronto") motorRef.current?.definirMedida(medida.a, pontaMedida);
  }, [medida.a, pontaMedida, estado]);

  useEffect(() => {
    if (estado === "pronto") motorRef.current?.definirPlantaFundo(plantaImagemUrl, plantaFundo);
  }, [plantaImagemUrl, plantaFundo, estado]);

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
        if (medindo && !digitando) pararMedicao();
        else if (buscaAberta) setBuscaAberta(false);
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
        m: alternarMedicao,
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

  /* ------------------------------------------------------------------ */
  /* Edição de posições (logística)                                       */
  /* ------------------------------------------------------------------ */

  const salvarPosicao = (dados: Parameters<typeof salvarPosicaoArenaAction>[1], rotulo: string, silencioso = false) => {
    const tinha = temRegistro(dados.chave);
    setRegistrosLocais((r) => ({ ...r, [dados.chave]: true }));
    iniciarSalvar(async () => {
      const r = await salvarPosicaoArenaAction(arena.slug, dados);
      if (!r.ok) {
        toastErro(r.erro);
        setLocais((l) => {
          const n = { ...l };
          delete n[dados.chave];
          return n;
        });
        setRegistrosLocais((x) => ({ ...x, [dados.chave]: tinha }));
        return;
      }
      // Arrastar salva a cada solta: um aviso por arrasto viraria ruído. O estado aparece na barra.
      if (!silencioso) toast(rotulo);
      router.refresh();
    });
  };

  /** Registro do ponto como está salvo agora (sem a prévia de arraste); null se ele segue a planta. */
  const registroDe = (chave: string): Registro | null => {
    if (!temRegistro(chave)) return null;
    const p = arenaSalva.pontos.find((q) => q.id === chave);
    if (!p) return null;
    return { tipo: tipoRegistro(chave), x: p.posicao[0], z: p.posicao[1], nome: p.nome, categoria: p.categoria, itemAta: itemAtaDe(p), rotacao: p.rotacao ?? null };
  };
  /** Guarda o estado anterior do ponto antes de cada mudança, para o "Desfazer" em vários passos. */
  const empilhar = (rotulo: string, chave: string) => setPilha((p) => [...p, { rotulo, chave, antes: registroDe(chave) }].slice(-LIMITE_DESFAZER));

  // Esc sai do modo "clique no mapa" sem ter de achar o botão Cancelar.
  useEffect(() => {
    if (!colocando && !menuItens) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setColocando(null);
      setMenuItens(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [colocando, menuItens]);

  const alternarEdicao = () => {
    if (editando) {
      setEditando(false);
      setColocando(null);
      setMenuItens(false);
      setFormEdicao(null);
      setPilha([]);
      return;
    }
    // Edita na vista em que a pessoa está (planta, de cima ou perspectiva), sem painel aberto por cima.
    setEditando(true);
    setPainelEsquerdo(null);
    setSelecionado(null);
  };

  const edicaoPlano = editando
    ? {
        colocando: colocando?.chave ?? null,
        editadas: idsEditados,
        onMover: (id: string, x: number, z: number) => {
          const p = arenaSalva.pontos.find((q) => q.id === id);
          setPrevia(null);
          if (!p) return;
          empilhar(`mover ${p.nome}`, id);
          setLocais((l) => ({ ...l, [id]: { ...l[id], posicao: [x, z] } }));
          salvarPosicao({ chave: id, tipo: tipoRegistro(id), x, z, nome: p.nome, itemAta: itemAtaDe(p) }, "", true);
        },
        onColocar: (x: number, z: number) => {
          if (!colocando) return;
          const item = colocando;
          setColocando(null);
          empilhar(`posicionar ${item.nome}`, item.chave);
          setSelecionado(item.chave);
          salvarPosicao({ chave: item.chave, tipo: "NOVO", x, z, nome: item.nome, itemAta: item.itemAta, categoria: item.categoria ?? null }, `${item.nome} entrou no mapa — arraste para acertar o lugar`);
        },
      }
    : null;

  // Atualizado depois de cada render: o motor chama a versão com o item escolhido mais recente.
  useEffect(() => {
    aoClicarChaoRef.current = (x, z) => {
      if (medindo) {
        marcarMedida(x, z);
        return true;
      }
      if (!edicaoPlano || !colocando) return false;
      edicaoPlano.onColocar(x, z);
      return true;
    };
  });

  const pontoEditado = editando && selecionado && temRegistro(selecionado) ? arena.pontos.find((p) => p.id === selecionado) : null;
  const pontoSelecionadoEdicao = editando && selecionado ? arena.pontos.find((p) => p.id === selecionado) ?? null : null;

  const confirmarFormEdicao = () => {
    if (!formEdicao) return;
    const nome = formEdicao.nome.trim();
    if (!nome) return toastErro("Informe o nome do item.");
    if (formEdicao.modo === "novo") {
      setColocando({ chave: `novo:livre:${Date.now().toString(36)}`, nome, itemAta: null, categoria: formEdicao.categoria });
      setFormEdicao(null);
      return;
    }
    const p = pontoSelecionadoEdicao;
    if (!p) return setFormEdicao(null);
    empilhar(`renomear ${p.nome}`, p.id);
    salvarPosicao({ chave: p.id, tipo: tipoRegistro(p.id), x: p.posicao[0], z: p.posicao[1], nome, categoria: formEdicao.categoria, itemAta: itemAtaDe(p) }, `${nome}: dados salvos`);
    setFormEdicao(null);
  };

  /** Giro do ponto selecionado em torno dele mesmo; positivo é anti-horário visto de cima. */
  const girar = (delta: number) => {
    const p = pontoSelecionadoEdicao;
    if (!p || medindo) return;
    const rotacao = normalizarAngulo((p.rotacao ?? 0) + delta);
    empilhar(`girar ${p.nome}`, p.id);
    setLocais((l) => ({ ...l, [p.id]: { ...l[p.id], rotacao } }));
    salvarPosicao({ chave: p.id, tipo: tipoRegistro(p.id), x: p.posicao[0], z: p.posicao[1], nome: p.nome, itemAta: itemAtaDe(p), rotacao }, "", true);
  };

  /** Apaga o registro: ponto movido volta à planta, item novo sai do mapa (o da ata volta para "sem posição"). */
  const removerRegistro = (id: string, aviso: string, limparSelecao = true) => {
    const tinha = temRegistro(id);
    setRegistrosLocais((r) => ({ ...r, [id]: false }));
    iniciarSalvar(async () => {
      const r = await removerPosicaoArenaAction(arena.slug, id);
      if (!r.ok) {
        setRegistrosLocais((x) => ({ ...x, [id]: tinha }));
        return toastErro(r.erro);
      }
      toast(aviso);
      if (limparSelecao) setSelecionado(null);
      else if (id.startsWith("novo:")) setSelecionado((sel) => (sel === id ? null : sel));
      router.refresh();
    });
  };

  const excluirDoMapa = (p: PontoArena) => {
    const livre = p.id.startsWith("novo:livre:");
    const novo = p.id.startsWith("novo:");
    empilhar(livre ? `excluir ${p.nome}` : novo ? `tirar ${p.nome} do mapa` : `voltar ${p.nome} ao lugar original`, p.id);
    removerRegistro(p.id, livre ? `${p.nome} excluído do mapa` : novo ? `${p.nome} voltou para "sem posição"` : `${p.nome} voltou ao lugar da planta`);
  };

  const desfazer = () => {
    const acao = pilha[pilha.length - 1];
    if (!acao || salvando) return;
    setPilha((p) => p.slice(0, -1));
    const aviso = `Desfeito: ${acao.rotulo}`;
    if (!acao.antes) return removerRegistro(acao.chave, aviso, false);
    const a = acao.antes;
    setLocais((l) => ({ ...l, [acao.chave]: { posicao: [a.x, a.z], rotacao: a.rotacao ?? 0 } }));
    salvarPosicao({ chave: acao.chave, tipo: a.tipo, x: a.x, z: a.z, nome: a.nome, categoria: a.categoria, itemAta: a.itemAta, rotacao: a.rotacao }, aviso);
  };

  // Atalhos da edição: Ctrl+Z desfaz, Q/E giram o selecionado. Fora de campos de texto.
  const atalhosEdicaoRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    atalhosEdicaoRef.current = (e: KeyboardEvent) => {
      if (!editando || !wrapperRef.current?.isConnected) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable)) return;
      const tecla = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && tecla === "z") {
        e.preventDefault();
        desfazer();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || !pontoSelecionadoEdicao || colocando || medindo) return;
      if (tecla === "q" || tecla === "e") {
        e.preventDefault();
        girar(tecla === "q" ? PASSO_GIRO : -PASSO_GIRO);
      }
    };
  });
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => atalhosEdicaoRef.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);

  // Mapa inteiro de volta à planta do evento: usado quando a edição saiu do controle.
  const aposRestaurar = () => {
    setConfirmarRestaurar(false);
    setPilha([]);
    // A cena 3D guarda as posições que já desenhou: só recarregando ela volta limpa, igual à planta.
    window.location.reload();
  };

  return (
    <div className="flex flex-col">
      {/* Cabeçalho compacto (tamanho "sm"): lido uma vez, não pode roubar altura do mapa para sempre. */}
      <PageHeader
        tamanho="sm"
        title={arena.evento.nome}
        eyebrow={<span className="font-mono">{arena.evento.sku}</span>}
        meta={
          <>
            {arena.evento.data && <Meta rotulo={arena.evento.largadas.length > 0 ? "Prova" : "Data"} valor={DATA.format(new Date(`${arena.evento.data}T12:00:00Z`))} mono />}
            {arena.evento.largadas.length > 0 && <Meta rotulo="Largadas" valor={arena.evento.largadas.map((l) => `${l.distancia} ${l.hora}`).join(" · ")} mono />}
            {arena.evento.largadas.length === 0 && arena.evento.local && <Meta rotulo="Local" valor={arena.evento.local} />}
            {arena.evento.publicoEsperado && <Meta rotulo="Público" valor={<span className="tabular-nums">{arena.evento.publicoEsperado.toLocaleString("pt-BR")}</span>} mono />}
            {arena.evento.diretorProva && <Meta rotulo="Direção" valor={arena.evento.diretorProva} />}
          </>
        }
        actions={
          totalDivergencias === 0 ? (
            arena.pontos.length > 0 && <Badge tom="success">Planta e ata conferidas</Badge>
          ) : (
            <Button variant="parcial" size="sm" aria-pressed={conferenciaAtiva} onClick={alternarConferencia} className="aria-pressed:border-warning aria-pressed:bg-warning aria-pressed:text-white">
              <span aria-hidden className={cn("block size-1.5 animate-pulse-dot rounded-full", conferenciaAtiva ? "bg-warning-bg" : "bg-danger")} />
              {totalDivergencias} {totalDivergencias === 1 ? "item a conferir" : "itens a conferir"}
            </Button>
          )
        }
      />

      {/*
        Barra de edição com ALTURA FIXA: nada nela aparece ou some empurrando o mapa (antes, selecionar
        um ponto criava uma linha nova e o mapa pulava 44 px — o ponto parecia cair fora do clique).
        O menu de itens e o formulário flutuam por cima, sem mexer no layout.
      */}
      <div className="relative mb-3 flex h-12 items-center gap-2 rounded-cartao border border-line bg-surface px-3">
        {podeEditar && (
          <Button variant={editando ? "primary" : "secondary"} size="sm" aria-pressed={editando} onClick={alternarEdicao}>
            <IconeLapis size={12} />
            {editando ? "Concluir edição" : "Editar mapa"}
          </Button>
        )}
        {editando && (
          <>
            <Button variant="secondary" size="sm" aria-expanded={menuItens} disabled={Boolean(colocando) || medindo} onClick={() => setMenuItens((v) => !v)}>
              + Adicionar ao mapa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pilha.length === 0 || salvando || Boolean(colocando)}
              title={pilha.length ? `Desfazer: ${pilha[pilha.length - 1].rotulo} (Ctrl+Z)` : "Nada para desfazer nesta sessão"}
              aria-keyshortcuts="Control+Z"
              onClick={desfazer}
              className="tabular-nums"
            >
              Desfazer{pilha.length > 0 && ` (${pilha.length})`}
            </Button>
            <span aria-hidden className="mx-1 h-6 w-px bg-line" />
          </>
        )}

        {/* Área de contexto: uma frase só, trocada conforme o momento. */}
        <div role="status" className="flex min-w-0 flex-1 items-center gap-2 text-pequeno text-ink-3">
          {medindo ? (
            <>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
                <IconeRegua className="size-3" />
              </span>
              <span className="min-w-0 truncate">
                {distanciaMedida != null ? (
                  <>
                    Distância: <span className="font-medium tabular-nums text-ink">{distanciaPrecisa(distanciaMedida)}</span> · clique de novo para outra medida
                  </>
                ) : medida.a ? (
                  <>
                    Clique no segundo ponto{pontaMedida && <span className="tabular-nums"> · {distanciaPrecisa(distancia(medida.a, pontaMedida))}</span>}
                  </>
                ) : (
                  "Régua: clique no primeiro ponto, no chão ou num pino"
                )}
              </span>
              <Kbd>Esc</Kbd>
            </>
          ) : colocando ? (
            <>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-micro font-semibold text-white">2</span>
              <span className="min-w-0 truncate">
                Clique no mapa onde fica <span className="font-medium text-ink">{colocando.nome}</span>
              </span>
              <Button size="xs" className="shrink-0" onClick={() => setColocando(null)}>
                Cancelar <Kbd>Esc</Kbd>
              </Button>
            </>
          ) : editando && pontoSelecionadoEdicao ? (
            <>
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{pontoSelecionadoEdicao.nome}</span> · arraste para mover
                {descreverGiro(pontoSelecionadoEdicao.rotacao) && <span className="tabular-nums"> · girado {descreverGiro(pontoSelecionadoEdicao.rotacao)}</span>}
              </span>
            </>
          ) : editando ? (
            <span className="min-w-0 truncate">{salvando ? "Salvando…" : "Arraste um ponto para mover, ou use “Adicionar ao mapa”."}</span>
          ) : (
            <span className="min-w-0 truncate">{idsEditados.size > 0 ? `${idsEditados.size} ${idsEditados.size === 1 ? "ponto ajustado" : "pontos ajustados"} em relação à planta original.` : "Planta original do evento."}</span>
          )}
        </div>

        <Button size="sm" variant="ghost" aria-pressed={medindo} aria-keyshortcuts="M" title={medindo ? "Parar de medir (Esc)" : "Medir a distância entre dois pontos (M)"} onClick={alternarMedicao} className="shrink-0 aria-pressed:bg-accent-bg aria-pressed:text-accent">
          <IconeRegua />
          {medindo ? "Parar" : "Medir"}
        </Button>
        <Button size="sm" variant="ghost" className="shrink-0 tabular-nums" aria-pressed={painelDireito === "sem-posicao"} onClick={abrirSemPosicao}>
          {foraDoMapa} sem posição
        </Button>
        {/* Ações de vez em quando ficam num menu: a barra mostra só o que se usa editando. */}
        <Dropdown>
          <DropdownTrigger asChild>
            <Button size="sm" variant="ghost" className="shrink-0" aria-label="Mais ações do mapa" title="Imprimir, fontes dos dados e restaurar">
              <span aria-hidden className="text-destaque leading-none">⋯</span>
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem onSelect={() => window.open(`/impressao/arena/${arena.slug}`, "_blank", "noopener,noreferrer")}>
              <IconeImprimir />
              Imprimir mapa (PDF)
            </DropdownItem>
            <DropdownItem onSelect={() => setFontesAbertas(true)}>De onde vêm os dados</DropdownItem>
            {podeEditar && (
              <>
                <DropdownSeparator />
                <DropdownItem danger disabled={salvando || idsEditados.size === 0} onSelect={() => setConfirmarRestaurar(true)}>
                  {idsEditados.size === 0 ? "Já está igual à planta original" : "Restaurar planta original…"}
                </DropdownItem>
              </>
            )}
          </DropdownContent>
        </Dropdown>

        {/* Passo 1: escolher o que pôr no mapa. Flutua sob a barra. */}
        {editando && menuItens && !colocando && !medindo && (
          <div role="dialog" aria-label="Adicionar ao mapa" className="absolute left-3 top-[calc(100%+6px)] z-30 w-[min(560px,calc(100%-24px))] rounded-cartao border border-line bg-surface p-3 shadow-popover animate-fade-up-rapido">
            <p className="m-0 flex items-center gap-2 text-pequeno font-medium text-ink">
              <span className="grid size-5 place-items-center rounded-full bg-accent text-micro font-semibold text-white">1</span>
              O que você quer pôr no mapa?
            </p>
            <p className="mb-2.5 ml-7 mt-0.5 text-rotulo text-muted">Escolha e depois clique no lugar. Dá para arrastar para acertar.</p>
            <div className="ml-7 flex flex-wrap gap-1.5">
              {ATALHOS_ITEM.map((a) => (
                <Button
                  key={a.nome}
                  size="sm"
                  onClick={() => {
                    setMenuItens(false);
                    setFormEdicao(null);
                    setSelecionado(null);
                    setColocando({ chave: `novo:livre:${Date.now().toString(36)}`, nome: a.nome, itemAta: null, categoria: a.categoria });
                  }}
                >
                  {a.nome}
                </Button>
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setMenuItens(false);
                  setFormEdicao({ modo: "novo", nome: "", categoria: "obstaculo" });
                }}
              >
                Outro, com nome…
              </Button>
            </div>
            <p className="mb-0 ml-7 mt-2.5 text-rotulo text-muted">
              Item da ata que ainda não tem lugar?{" "}
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-rotulo text-accent underline"
                onClick={() => {
                  setMenuItens(false);
                  abrirSemPosicao();
                }}
              >
                Veja os {foraDoMapa} sem posição
              </button>
            </p>
          </div>
        )}

        {/* Nome próprio para um item novo, ou renomear um ponto. Flutua sob a barra. */}
        {editando && formEdicao && (
          <form
            className="absolute left-3 top-[calc(100%+6px)] z-30 flex w-[min(640px,calc(100%-24px))] flex-wrap items-center gap-2 rounded-cartao border border-line bg-surface p-3 shadow-popover animate-fade-up-rapido"
            onSubmit={(e) => {
              e.preventDefault();
              confirmarFormEdicao();
            }}
          >
            <span className="min-w-[220px] flex-1">
              <Input autoFocus aria-label="Nome do item" value={formEdicao.nome} onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })} placeholder="Ex.: Árvore baixa em cima do acesso" className="w-full" />
            </span>
            <span className="w-[200px]">
              <label htmlFor="edicao-categoria" className="sr-only">
                Categoria
              </label>
              <Select id="edicao-categoria" value={formEdicao.categoria} onValueChange={(v) => setFormEdicao({ ...formEdicao, categoria: v })} ordenarAlfabetico={false} opcoes={Object.entries(CATEGORIAS).map(([id, c]) => ({ value: id, label: c.rotulo }))} />
            </span>
            <Button type="submit" variant="primary" size="sm">
              {formEdicao.modo === "novo" ? "Escolher lugar no mapa" : "Salvar"}
            </Button>
            <Button size="sm" onClick={() => setFormEdicao(null)}>
              Cancelar
            </Button>
          </form>
        )}
      </div>

      <div
        ref={wrapperRef}
        onPointerMove={usar3D && medindo && medida.a && !medida.b ? (e) => moverCursorMedida(motorRef.current?.chaoEm(e.clientX, e.clientY) ?? null) : undefined}
        className={cn(
          "overflow-hidden border border-line bg-[#e6e2dc]",
          telaCheia ? "fixed inset-0 z-[var(--z-tela-cheia)] h-[100dvh] w-screen rounded-none border-0" : "relative h-[calc(100dvh-250px)] min-h-[520px] rounded-modal",
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
                const qtd = quantidades.get(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-ponto-id={p.id}
                    aria-label={`${p.nome}, ${p.tipo}${qtd != null ? `, quantidade ${qtd}` : ""}${divergente ? ", com divergência entre planta e ata" : ""}`}
                    aria-pressed={ativo}
                    onClick={(e) => {
                      if (ignorarClique.current) {
                        ignorarClique.current = false;
                        return;
                      }
                      if (medindo) return marcarMedida(p.posicao[0], p.posicao[1]);
                      if (editando && colocando) {
                        const chao = motorRef.current?.chaoEm(e.clientX, e.clientY);
                        if (chao) edicaoPlano?.onColocar(chao[0], chao[1]);
                        return;
                      }
                      abrirPonto(p.id);
                    }}
                    onPointerDown={(e) => {
                      if (!editando || colocando || medindo || e.button !== 0) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      motorRef.current?.travarCamera(true);
                      // O canto do botão é o ponto no chão; guardamos onde, em relação a ele, a pessoa pegou.
                      const base = e.currentTarget.getBoundingClientRect();
                      arraste3d.current = { id: p.id, x0: e.clientX, y0: e.clientY, moveu: false, ultimo: null, dx: e.clientX - base.left, dy: e.clientY - base.top };
                    }}
                    onPointerMove={(e) => {
                      const a = arraste3d.current;
                      if (!a || a.id !== p.id) return;
                      if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) return;
                      a.moveu = true;
                      const chao = motorRef.current?.chaoEm(e.clientX - a.dx, e.clientY - a.dy);
                      if (!chao) return;
                      a.ultimo = chao;
                      setPrevia({ id: p.id, posicao: chao });
                    }}
                    onPointerUp={() => {
                      const a = arraste3d.current;
                      arraste3d.current = null;
                      motorRef.current?.travarCamera(false);
                      if (!a || a.id !== p.id || !a.moveu || !a.ultimo) return;
                      ignorarClique.current = true;
                      edicaoPlano?.onMover(p.id, a.ultimo[0], a.ultimo[1]);
                    }}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover(null)}
                    data-prioridade={prioridadeRotulo({ selecionado: ativo, foco: emFoco, principal: divergente || p.principal })}
                    className={cn(
                      "group/pin pointer-events-auto absolute left-0 top-0 border-0 bg-transparent p-0 will-change-transform",
                      medindo ? "cursor-crosshair" : editando && !colocando ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
                    )}
                    style={{ visibility: "hidden", zIndex: emFoco ? 3 : divergente || p.principal ? 2 : 1 }}
                  >
                    <span className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
                      <span
                        data-rotulo
                        className={cn(
                          "mb-1 whitespace-nowrap rounded-chip border px-1.5 py-[3px] text-rotulo font-medium leading-none shadow-pill transition-[opacity,transform] duration-150 group-data-[oculto=1]/pin:invisible group-data-[oculto=1]/pin:opacity-0",
                          ativo ? "border-accent bg-accent text-white" : divergente ? "border-danger-border bg-surface/95 text-danger" : "border-line bg-surface/95 text-ink",
                          !rotulo && "hidden",
                          !emFoco && !p.principal && !divergente && "group-data-[zoom=longe]/mapa:hidden",
                        )}
                      >
                        {p.legenda && !emFoco && <span className="mr-1 font-mono text-micro opacity-60">{p.legenda.split(" ")[0]}</span>}
                        {p.nome}
                        {qtd != null && <span className={cn("ml-1 font-mono text-micro font-normal tabular-nums", ativo ? "text-white/75" : "text-muted")}>× {qtd.toLocaleString("pt-BR")}</span>}
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
          {usar3D && estado === "pronto" && medida.a && (
            <>
              {[medida.a, medida.b].map((q, i) =>
                q ? (
                  <span key={i} aria-hidden data-chao={`${q[0]},${q[1]}`} className="absolute left-0 top-0 z-[4]" style={{ visibility: "hidden" }}>
                    <span className="block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-accent bg-surface shadow-pill" />
                  </span>
                ) : null,
              )}
              {pontaMedida && distancia(medida.a, pontaMedida) > 0 && (
                <span aria-hidden data-chao={`${(medida.a[0] + pontaMedida[0]) / 2},${(medida.a[1] + pontaMedida[1]) / 2}`} className="absolute left-0 top-0 z-[4]" style={{ visibility: "hidden" }}>
                  <span className={cn("block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-white bg-accent px-2 py-0.5 text-rotulo font-semibold tabular-nums text-white shadow-pill", !medida.b && "opacity-80")}>
                    {rotuloDistancia(distancia(medida.a, pontaMedida))}
                  </span>
                </span>
              )}
            </>
          )}
        </div>

        {mostrarPlano && (
          <Plano2D
            arena={arena}
            camadas={camadas}
            selecionado={selecionado}
            realce={conferenciaAtiva ? { destaque: idsDivergentes, foco: idsFoco } : null}
            recuoDireita={direitaAberta && !estreito}
            onSelecionar={(id) => aoSelecionarNoMapa.current(id)}
            edicao={edicaoPlano}
            medicao={medindo ? { a: medida.a, b: medida.b, cursor: cursorMedida, onClicar: marcarMedida, onCursor: moverCursorMedida } : null}
            fundo={plantaImagemUrl && plantaFundo ? plantaImagemUrl : null}
          />
        )}

        {usar3D && estado === "carregando" && (
          <div className="absolute inset-0 grid place-items-center bg-[#ebe7e1]" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 text-center">
              <svg width="132" height="64" viewBox="0 0 120 64" aria-hidden className="text-accent">
                <path d="M6 50 C 30 44, 40 18, 62 20 S 100 42, 114 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 6" className="animate-esqueleto" />
                <circle cx="6" cy="50" r="4" fill="var(--color-ink)" />
                <circle cx="114" cy="14" r="4" fill="var(--color-ink)" />
              </svg>
              <p className="m-0 text-secao font-medium text-ink">Montando a arena</p>
              <p className="m-0 text-pequeno text-muted">
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
              <Input
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
                className="pl-9 pr-10 shadow-pill"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <Kbd>/</Kbd>
              </span>
              {buscaAberta && (
                <ul id="arena-busca-lista" role="listbox" aria-label="Pontos encontrados" className="absolute left-0 right-0 top-10 m-0 max-h-[320px] list-none overflow-y-auto rounded-cartao border border-line bg-surface p-1 shadow-popover">
                  {resultados.length === 0 ? (
                    <li className="px-3 py-2.5 text-pequeno text-muted">Nada encontrado para “{termo}”.</li>
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
                        className={cn("flex cursor-pointer items-center gap-2.5 rounded-controle px-2.5 py-2", i === indiceBusca && "bg-accent-bg")}
                      >
                        <span aria-hidden className="block size-2.5 shrink-0 rounded-full" style={{ background: CATEGORIAS[p.categoria].cor }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-corpo text-ink">{p.nome}</span>
                          <span className="block text-rotulo text-muted">{p.tipo}</span>
                        </span>
                        {p.legenda && <span className="font-mono text-rotulo text-meta">{p.legenda.split(" ")[0]}</span>}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <div className={cn("pointer-events-auto shrink-0 overflow-hidden", cartao)}>
              <BotaoMapa rotulo="Índice de pontos" atalho="P" ativo={painelEsquerdo === "indice"} onClick={alternarIndice} tamanho="campo">
                <IconeLista />
              </BotaoMapa>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <Pills rotulo="Vista do mapa" className="pointer-events-auto shrink-0 shadow-pill" itens={VISTAS.map(([v, rotulo]) => ({ label: rotulo, ativo: vistaMapa === v, onSelect: () => escolherVista(v) }))} />
            <div className="pointer-events-auto relative">
              <div className={cn("overflow-hidden", cartao)}>
                <BotaoMapa rotulo="Camadas" ativo={painelCamadas} onClick={() => setPainelCamadas((v) => !v)} tamanho="campo">
                  <IconeCamadas />
                </BotaoMapa>
              </div>
              {painelCamadas && (
                <div className="absolute right-0 top-11 z-40 w-[292px] rounded-cartao border border-line bg-surface shadow-popover animate-fade-up-rapido">
                  <div className="flex items-center gap-1.5 border-b border-line-soft px-2.5 py-[9px]">
                    <span className="flex-1 [&>div]:mb-0">
                      <RotuloGrupo>O que aparece no mapa</RotuloGrupo>
                    </span>
                    <Button size="xs" className="shrink-0" onClick={() => setCamadas(camadasTudo())}>
                      Tudo
                    </Button>
                    <Button size="xs" className="shrink-0" onClick={() => setCamadas(camadasEssenciais())} title="Padrões sem o público: para conferir implantação">
                      Essencial
                    </Button>
                  </div>
                  <div className="p-1">
                    {GRUPOS_CAMADAS.map((g, i) => (
                      <fieldset key={g.titulo} className={cn("m-0 border-0 p-0", i > 0 && "mt-0.5 border-t border-line-faint pt-0.5")}>
                        <legend className="px-2 pb-[3px] pt-1.5 text-rotulo font-medium text-ink-2">{g.titulo}</legend>
                        {g.camadas
                          .filter((id) => modo === "3d" || (id !== "publico" && id !== "fluxo"))
                          .map((id) => {
                            const c = CAMADAS.find((x) => x.id === id);
                            if (!c) return null;
                            const n = pontosPorCamada[id];
                            return (
                              <label key={id} htmlFor={`camada-${id}`} className="flex cursor-pointer items-start gap-2.5 rounded-controle px-2 py-[5px] hover:bg-subtle">
                                <input id={`camada-${id}`} type="checkbox" checked={camadas[id]} onChange={(e) => setCamadas((v) => ({ ...v, [id]: e.target.checked }))} className="mt-0.5 size-4 accent-accent" />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-corpo text-ink">{c.rotulo}</span>
                                  <span className="block text-rotulo leading-[1.4] text-muted">{c.descricao}</span>
                                </span>
                                {n ? (
                                  <span className="shrink-0" aria-label={`${n} pontos`}>
                                    <ChipMono tom="control">{n}</ChipMono>
                                  </span>
                                ) : null}
                              </label>
                            );
                          })}
                      </fieldset>
                    ))}
                    {plantaImagemUrl && (
                      <fieldset className="m-0 mt-0.5 border-0 border-t border-line-faint p-0 pt-0.5">
                        <legend className="px-2 pb-[3px] pt-1.5 text-rotulo font-medium text-ink-2">Referência</legend>
                        <label htmlFor="camada-planta-fundo" className="flex cursor-pointer items-start gap-2.5 rounded-controle px-2 py-[5px] hover:bg-subtle">
                          <input id="camada-planta-fundo" type="checkbox" checked={plantaFundo} onChange={(e) => setPlantaFundo(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-corpo text-ink">Planta de fundo</span>
                            <span className="block text-rotulo leading-[1.4] text-muted">Imagem da planta do evento sob o mapa</span>
                          </span>
                        </label>
                      </fieldset>
                    )}
                  </div>
                  {modo === "3d" && (
                    <div className="border-t border-line-soft px-3 pb-2.5 pt-2.5">
                      <span className="block [&>div]:mb-1.5">
                        <RotuloGrupo>Qualidade</RotuloGrupo>
                      </span>
                      <Pills rotulo="Qualidade do 3D" itens={(["alta", "leve"] as const).map((q) => ({ label: q === "alta" ? "Alta" : "Leve", ativo: qualidade === q, onSelect: () => trocarQualidade(q) }))} />
                      <p className="m-0 mt-1.5 text-rotulo text-meta">{qualidade ? "Escolhida por você." : "Automática pelo aparelho."} Leve desliga sombras e reduz árvores e público.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={cn("pointer-events-auto overflow-hidden", cartao)}>
              <BotaoMapa rotulo={telaCheia ? "Sair da tela cheia" : "Tela cheia"} atalho="F" onClick={alternarTelaCheia} tamanho="campo">
                {telaCheia ? <IconeSairTelaCheia /> : <IconeTelaCheia />}
              </BotaoMapa>
            </div>
          </div>
        </div>

        {/* Canto inferior direito: procedência e itens sem posição a um clique, câmera (4) e atalhos. */}
        <div className={cn("pointer-events-none absolute z-10 flex flex-col items-end gap-2", direitaAberta && !estreito ? "right-[384px]" : "right-3", mostrarPlano ? "bottom-[132px]" : "bottom-3")}>
          {fontesAbertas && (
            <div role="dialog" aria-labelledby="fontes-titulo" className="pointer-events-auto max-w-[360px] rounded-cartao border border-line bg-surface px-[13px] py-[11px] shadow-popover animate-fade-up-rapido">
              <span id="fontes-titulo" className="block [&>div]:mb-[5px]">
                <RotuloGrupo>Fontes deste mapa</RotuloGrupo>
              </span>
              <ul className="m-0 list-none p-0 text-rotulo leading-[1.5] text-ink-2">
                {arena.fonte.documentos.map((d) => (
                  <li key={d.nome} className="mb-1">
                    <span className="font-medium text-ink">{d.nome}</span> — {d.detalhe}
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-1 text-rotulo leading-[1.5] text-muted">{arena.fonte.nota}</p>
            </div>
          )}
          {ajudaAberta && usar3D && (
            <div role="dialog" aria-labelledby="atalhos-titulo" className="pointer-events-auto w-[290px] rounded-cartao border border-line bg-surface p-3 shadow-popover animate-fade-up-rapido">
              <span id="atalhos-titulo" className="block [&>div]:mb-2">
                <RotuloGrupo>Como navegar</RotuloGrupo>
              </span>
              <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-pequeno">
                {ATALHOS.map(([tecla, acao]) => (
                  <div key={tecla} className="contents">
                    <dt className="whitespace-nowrap">
                      <Kbd>{tecla}</Kbd>
                    </dt>
                    <dd className="m-0 text-ink-2">{acao}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
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
              <BotaoMapa rotulo="Atalhos do teclado" atalho="?" ativo={ajudaAberta} onClick={() => setAjudaAberta((v) => !v)} className="border-t border-line-soft font-mono text-secao [@media(pointer:coarse)]:hidden">
                ?
              </BotaoMapa>
            </div>
          )}
        </div>

        {/* Minimapa e legenda: recuam quando há painel à esquerda. Somem durante a edição (menos ruído). */}
        <div className={cn("pointer-events-none absolute bottom-3 z-10 flex items-end gap-2", painelEsquerdo && !estreito ? "left-[376px]" : "left-3", ((estreito && (direitaAberta || painelEsquerdo)) || editando) && "hidden")}>
          {usar3D && estado === "pronto" && !estreito && <Minimapa arena={arena} camadas={camadas} selecionado={selecionado} pegadaRef={pegadaRef} onIr={(x, z) => motorRef.current?.irPara(x, z)} />}
          <div className={cn("pointer-events-auto max-w-[250px]", cartao)}>
            <button type="button" aria-expanded={legendaAberta && largo} onClick={() => setLegendaAberta((v) => !v)} className="flex h-9 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3 text-pequeno font-medium text-ink-2">
              Legenda
              <span aria-hidden className={cn("text-micro text-muted transition-transform", legendaAberta && largo && "rotate-180")}>
                ▲
              </span>
            </button>
            {legendaAberta && largo && (
              <div className="border-t border-line-soft px-3 pb-2.5 pt-2 text-pequeno text-ink-2">
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
                        <span aria-hidden className="block size-2.5 rounded-full border-2 border-white bg-danger ring-1 ring-ink/20" />
                        Planta e ata divergem
                      </p>
                      <p className="m-0 flex items-center gap-2">
                        <span aria-hidden className="block size-2.5 rounded-full border-2 border-white bg-[#c3bcbc] ring-1 ring-ink/20" />
                        Sem divergência
                      </p>
                    </>
                  ) : (
                    categoriasPresentes.map((c) => (
                      <p key={c} className="m-0 flex items-center gap-2">
                        <span aria-hidden className="block size-2.5 rounded-full border-2 border-white ring-1 ring-ink/20" style={{ background: CATEGORIAS[c].cor }} />
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
          <div role="alert" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-cartao border border-danger-border bg-surface px-3.5 py-2.5 shadow-popover">
            <span className="text-pequeno text-ink-2">
              <span className="font-medium text-danger">3D indisponível.</span> {erro} Mostrando a planta 2D.
            </span>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setErro(null);
                setEstado("carregando");
                setTentativa((t) => t + 1);
              }}
            >
              Tentar de novo
            </Button>
          </div>
        )}
        {lento && usar3D && (
          <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-cartao border border-warning-border bg-surface px-3.5 py-2.5 shadow-popover">
            <span className="text-pequeno text-ink-2">O 3D está pesado neste computador.</span>
            <Button variant="primary" size="sm" onClick={() => trocarQualidade("leve")}>
              Usar modo leve
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLento(false)}>
              Manter
            </Button>
          </div>
        )}
        {/* Ações do ponto escolhido (editando): flutuam no canto do mapa (a legenda some ao editar) em vez de espremer a barra. */}
        {editando && pontoSelecionadoEdicao && !colocando && !medindo && (
          <div role="toolbar" aria-label={`Ações de ${pontoSelecionadoEdicao.nome}`} className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-24px)] items-center gap-1.5 overflow-x-auto rounded-cartao border border-line-strong bg-surface px-2 py-1.5 shadow-popover">
            <span className="max-w-[180px] shrink truncate px-1 text-pequeno font-medium text-ink">{pontoSelecionadoEdicao.nome}</span>
            <Button size="xs" className="shrink-0" aria-label="Girar 15° no sentido anti-horário" title="Girar 15° no sentido anti-horário (Q)" aria-keyshortcuts="Q" onClick={() => girar(PASSO_GIRO)}>
              ↺ 15°
            </Button>
            <Button size="xs" className="shrink-0" aria-label="Girar 15° no sentido horário" title="Girar 15° no sentido horário (E)" aria-keyshortcuts="E" onClick={() => girar(-PASSO_GIRO)}>
              ↻ 15°
            </Button>
            <Button size="xs" className="shrink-0" onClick={() => setFormEdicao({ modo: "info", nome: pontoSelecionadoEdicao.nome, categoria: pontoSelecionadoEdicao.categoria })}>
              Renomear
            </Button>
            {pontoEditado && (
              <Button size="xs" className="shrink-0" variant="recusar" onClick={() => excluirDoMapa(pontoEditado)}>
                {pontoEditado.id.startsWith("novo:livre:") ? "Excluir" : pontoEditado.id.startsWith("novo:") ? "Tirar do mapa" : "Voltar ao lugar original"}
              </Button>
            )}
          </div>
        )}
        {arena.pontos.length === 0 && !editando && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <div className="pointer-events-auto rounded-cartao border border-line bg-surface">
              <EmptyState compact title="Nada posicionado ainda" description={podeEditar ? "Clique em Editar mapa e use + Adicionar ao mapa para posicionar estruturas, obstáculos e os itens da ata." : "A logística ainda não posicionou estruturas neste mapa."} />
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
        {painelDireito === "sem-posicao" && (
          <PainelSemPosicao
            arena={arena}
            estreito={estreito}
            onFechar={fecharDireito}
            edicao={
              editando
                ? {
                    colocando: colocando?.chave ?? null,
                    onPosicionar: (item) => {
                      if (medindo) pararMedicao();
                      setColocando((c) => (c?.chave === item.chave ? null : item));
                    },
                  }
                : null
            }
          />
        )}
        {confirmarRestaurar && (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setConfirmarRestaurar(false)}
            title="Restaurar a planta original"
            description={`${idsEditados.size === 1 ? "A única edição do mapa é descartada" : `Todas as ${idsEditados.size} edições do mapa são descartadas`}: os pontos voltam ao lugar da planta do evento e os itens acrescentados saem do mapa. Fica registrado quem restaurou.`}
            confirmLabel="Restaurar planta original"
            danger
            action={restaurarPlantaArenaFormAction}
            hidden={{ slug: arena.slug }}
            onSuccess={aposRestaurar}
          />
        )}
      </div>
    </div>
  );
}
