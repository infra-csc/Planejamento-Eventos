"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Arena, Vec2 } from "@/domain/arena/tipos";
import { CATEGORIAS, camadasPadrao, type Camada } from "@/domain/arena/categorias";
import { distancia } from "@/domain/arena/posicoes";
import { divergenciasDaArena } from "@/domain/arena/conferencia";
import { buscarPontos, itensNaoPosicionados } from "@/domain/arena/geometria";
import { cn } from "@/lib/cn";
import type { MotorArena } from "./cena/motor";
import type { Qualidade } from "./cena/materiais";
import { restaurarPlantaArenaFormAction } from "@/app/(app)/arena/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/layout";
import { Plano2D } from "./plano-2d";
import { CabecalhoArena } from "./arena-cabecalho";
import { AcoesPontoEdicao, BarraEdicao } from "./arena-barra-edicao";
import { BarraFerramentasMapa, type VistaMapa } from "./arena-barra-ferramentas";
import { AvisoErro3D, AvisoLento, CarregandoArena, ControlesCanto, LegendaMapa } from "./arena-controles-mapa";
import { Marcadores3D } from "./arena-marcadores-3d";
import { PaineisLaterais, type PainelDireito, type PainelEsquerdo } from "./arena-paineis-laterais";
import { useAtalhosEdicao, useEdicaoArena } from "./use-edicao-arena";

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
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [painelEsquerdo, setPainelEsquerdo] = useState<PainelEsquerdo>(null);
  // Régua: `a` e `b` em metros; `cursorMedida` é a prévia da segunda ponta sob o ponteiro.
  const [medindo, setMedindo] = useState(false);
  // Edição de posições (logística): estado, "Desfazer" e a arena com os ajustes ainda não refletidos pelo servidor.
  const edicao = useEdicaoArena({ arenaServidor, editadas, selecionado, setSelecionado, setPainelEsquerdo, medindo });
  const { arena, editando, colocando, setColocando, setMenuItens, setFormEdicao, setPrevia, edicaoPlano, pontoSelecionadoEdicao } = edicao;
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
  const vistaRef = useRef<VistaMapa>("perspectiva");

  const [vistaMapa, setVistaMapa] = useState<VistaMapa>("planta");
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [qualidade, setQualidade] = useState<Qualidade | null>(null);
  const [lento, setLento] = useState(false);
  const [camadas, setCamadas] = useState<Record<Camada, boolean>>(camadasPadrao);
  const [hover, setHover] = useState<string | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [estreito, setEstreito] = useState(false);
  const [largo, setLargo] = useState(true);
  const [painelCamadas, setPainelCamadas] = useState(false);
  const [painelDireito, setPainelDireito] = useState<PainelDireito>(null);
  const [focoConferencia, setFocoConferencia] = useState<string | null>(null);
  const [fontesAbertas, setFontesAbertas] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [indiceBusca, setIndiceBusca] = useState(0);
  const [plantaFundo, setPlantaFundo] = useState(true);
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

  // Ctrl+Z e Q/E da edição: registrados depois dos atalhos gerais, como antes.
  useAtalhosEdicao({ wrapperRef, edicao, medindo });

  return (
    <div className="flex flex-col">
      {/* Cabeçalho compacto (tamanho "sm"): lido uma vez, não pode roubar altura do mapa para sempre. */}
      <CabecalhoArena arena={arena} totalDivergencias={totalDivergencias} conferenciaAtiva={conferenciaAtiva} onAlternarConferencia={alternarConferencia} />

      <BarraEdicao
        slug={arena.slug}
        podeEditar={podeEditar}
        edicao={edicao}
        setSelecionado={setSelecionado}
        medindo={medindo}
        medida={medida}
        pontaMedida={pontaMedida}
        distanciaMedida={distanciaMedida}
        alternarMedicao={alternarMedicao}
        semPosicaoAberta={painelDireito === "sem-posicao"}
        foraDoMapa={foraDoMapa}
        abrirSemPosicao={abrirSemPosicao}
        setFontesAbertas={setFontesAbertas}
      />

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
          <Marcadores3D
            visivel={usar3D && estado === "pronto"}
            pontos={arena.pontos}
            camadas={camadas}
            selecionado={selecionado}
            hover={hover}
            setHover={setHover}
            idsFoco={idsFoco}
            conferenciaAtiva={conferenciaAtiva}
            idsDivergentes={idsDivergentes}
            medindo={medindo}
            medida={medida}
            pontaMedida={pontaMedida}
            marcarMedida={marcarMedida}
            editando={editando}
            colocando={colocando}
            edicaoPlano={edicaoPlano}
            setPrevia={setPrevia}
            abrirPonto={abrirPonto}
            motorRef={motorRef}
          />
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

        {usar3D && estado === "carregando" && <CarregandoArena arena={arena} />}

        <BarraFerramentasMapa
          buscaRef={buscaRef}
          termo={termo}
          setTermo={setTermo}
          buscaAberta={buscaAberta}
          setBuscaAberta={setBuscaAberta}
          indiceBusca={indiceBusca}
          setIndiceBusca={setIndiceBusca}
          resultados={resultados}
          escolherResultado={escolherResultado}
          indiceAberto={painelEsquerdo === "indice"}
          alternarIndice={alternarIndice}
          vistaMapa={vistaMapa}
          escolherVista={escolherVista}
          painelCamadas={painelCamadas}
          setPainelCamadas={setPainelCamadas}
          camadas={camadas}
          setCamadas={setCamadas}
          modo={modo}
          pontosPorCamada={pontosPorCamada}
          plantaImagemUrl={plantaImagemUrl}
          plantaFundo={plantaFundo}
          setPlantaFundo={setPlantaFundo}
          qualidade={qualidade}
          trocarQualidade={trocarQualidade}
          telaCheia={telaCheia}
          alternarTelaCheia={alternarTelaCheia}
        />

        <ControlesCanto
          arena={arena}
          direitaAberta={direitaAberta}
          estreito={estreito}
          mostrarPlano={mostrarPlano}
          fontesAbertas={fontesAbertas}
          ajudaAberta={ajudaAberta}
          setAjudaAberta={setAjudaAberta}
          usar3D={usar3D}
          pronto={estado === "pronto"}
          motorRef={motorRef}
        />

        <LegendaMapa
          arena={arena}
          camadas={camadas}
          selecionado={selecionado}
          painelEsquerdoAberto={Boolean(painelEsquerdo)}
          direitaAberta={direitaAberta}
          estreito={estreito}
          largo={largo}
          editando={editando}
          mostrarMinimapa={usar3D && estado === "pronto" && !estreito}
          pegadaRef={pegadaRef}
          motorRef={motorRef}
          legendaAberta={legendaAberta}
          setLegendaAberta={setLegendaAberta}
          conferenciaAtiva={conferenciaAtiva}
          categoriasPresentes={categoriasPresentes}
        />

        {estado === "erro" && modo === "3d" && (
          <AvisoErro3D
            erro={erro}
            onTentarDeNovo={() => {
              setErro(null);
              setEstado("carregando");
              setTentativa((t) => t + 1);
            }}
          />
        )}
        {lento && usar3D && <AvisoLento onUsarLeve={() => trocarQualidade("leve")} onManter={() => setLento(false)} />}
        {/* Ações do ponto escolhido (editando): flutuam no canto do mapa (a legenda some ao editar) em vez de espremer a barra. */}
        {editando && pontoSelecionadoEdicao && !colocando && !medindo && (
          <AcoesPontoEdicao ponto={pontoSelecionadoEdicao} pontoEditado={edicao.pontoEditado} girar={edicao.girar} setFormEdicao={setFormEdicao} excluirDoMapa={edicao.excluirDoMapa} />
        )}
        {arena.pontos.length === 0 && !editando && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <div className="pointer-events-auto rounded-cartao border border-line bg-surface">
              <EmptyState compact title="Nada posicionado ainda" description={podeEditar ? "Clique em Editar mapa e use + Adicionar ao mapa para posicionar estruturas, obstáculos e os itens da ata." : "A logística ainda não posicionou estruturas neste mapa."} />
            </div>
          </div>
        )}

        <PaineisLaterais
          arena={arena}
          camadas={camadas}
          setCamadas={setCamadas}
          selecionado={selecionado}
          modo={modo}
          estreito={estreito}
          usar3D={usar3D}
          motorRef={motorRef}
          painelEsquerdo={painelEsquerdo}
          setPainelEsquerdo={setPainelEsquerdo}
          painelDireito={painelDireito}
          setPainelDireito={setPainelDireito}
          conferenciaAtiva={conferenciaAtiva}
          divergencias={divergencias}
          idsDivergentes={idsDivergentes}
          focoConferencia={focoConferencia}
          setFocoConferencia={setFocoConferencia}
          focarDivergencia={focarDivergencia}
          ponto={ponto}
          fichaAberta={fichaAberta}
          abrirPonto={abrirPonto}
          abrirConferencia={abrirConferencia}
          fecharDireito={fecharDireito}
          devolverFoco={devolverFoco}
          editando={editando}
          colocando={colocando}
          setColocando={setColocando}
          medindo={medindo}
          pararMedicao={pararMedicao}
        />
        {edicao.confirmarRestaurar && (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && edicao.setConfirmarRestaurar(false)}
            title="Restaurar a planta original"
            description={`${edicao.idsEditados.size === 1 ? "A única edição do mapa é descartada" : `Todas as ${edicao.idsEditados.size} edições do mapa são descartadas`}: os pontos voltam ao lugar da planta do evento e os itens acrescentados saem do mapa. Fica registrado quem restaurou.`}
            confirmLabel="Restaurar planta original"
            danger
            action={restaurarPlantaArenaFormAction}
            hidden={{ slug: arena.slug }}
            onSuccess={edicao.aposRestaurar}
          />
        )}
      </div>
    </div>
  );
}
