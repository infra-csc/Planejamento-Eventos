"use client";

import { useMemo, useRef, useState } from "react";
import type { Arena, PontoArena, Vec2 } from "@/domain/arena/tipos";
import { CATEGORIAS, COR_PERCURSO, formaDoPonto, prioridadeRotulo, rotulosSemSobreposicao, type CaixaRotulo, type CaixaTela, type Camada, type FormaItem } from "@/domain/arena/categorias";
import { poligonoFaixa } from "@/domain/arena/geometria";
import { distancia, emGraus, quantidadeAta, rotuloDistancia } from "@/domain/arena/posicoes";
import { cn } from "@/lib/cn";
import { IconeMais, IconeMenos } from "./icones";

const pts = (lista: Array<[number, number]>) => lista.map(([x, z]) => `${x},${z}`).join(" ");

/** Modo conferência: pontos em `destaque` acendem; os demais esmaecem. `foco` é o item escolhido na lista. */
export type RealcePlano = { destaque: Set<string>; foco: Set<string> };

/**
 * Modo edição (logística): arrastar um ponto move; com `colocando` definido, um clique no mapa
 * posiciona o item escolhido. `editadas` marca os pontos com posição manual.
 */
export type EdicaoPlano = {
  colocando: string | null;
  editadas: Set<string>;
  onMover: (id: string, x: number, z: number) => void;
  onColocar: (x: number, z: number) => void;
};

/** Régua: cada clique (no chão ou num ponto) marca uma ponta; `cursor` desenha a prévia da segunda. */
export type MedicaoPlano = {
  a: Vec2 | null;
  b: Vec2 | null;
  cursor: Vec2 | null;
  onClicar: (x: number, z: number) => void;
  onCursor: (p: Vec2 | null) => void;
};

/** Largura aproximada do texto (unidades do SVG): a planta não mede o DOM a cada zoom. */
const larguraTexto = (texto: string, tamanho: number, forte: boolean) => texto.length * tamanho * (forte ? 0.6 : 0.56);
const sufixoQuantidade = (q: number | null | undefined) => (q != null ? ` × ${q.toLocaleString("pt-BR")}` : "");

/** Pegada do item em metros, girada junto com o ponto. Só para itens acrescentados na edição. */
function Pegada({ forma, cor }: { forma: FormaItem; cor: string }) {
  switch (forma) {
    case "arvore":
      return <circle r={2.4} fill="#6e7c5b" fillOpacity={0.55} stroke="#4f5b41" strokeWidth={0.15} />;
    case "bueiro":
      return <circle r={0.5} fill="#3a3637" stroke="#8c8585" strokeWidth={0.12} />;
    case "poste":
      return (
        <g stroke="#5d5f61" strokeWidth={0.15}>
          <circle r={0.25} fill="#5d5f61" />
          <line x1={0} y1={0} x2={1.3} y2={0} />
        </g>
      );
    case "rampa":
      return (
        <g>
          <rect x={-1.5} y={-2} width={3} height={4} fill="#b9b2a8" stroke="#8c8585" strokeWidth={0.1} />
          <rect x={-1.5} y={-2} width={3} height={0.3} fill="#d9b43a" />
        </g>
      );
    case "grade":
      return <line x1={-1.5} y1={0} x2={1.5} y2={0} stroke="#6d6566" strokeWidth={0.35} strokeLinecap="round" />;
    case "tenda":
      return <rect x={-1.5} y={-1.5} width={3} height={3} fill="#f4f1ec" stroke="#8c9196" strokeWidth={0.15} />;
    case "banheiro":
      return <rect x={-0.6} y={-0.6} width={1.2} height={1.2} fill="#3e5f86" />;
    case "energia":
      return <rect x={-0.5} y={-0.3} width={1} height={0.6} fill="#d9b43a" stroke="#5b6158" strokeWidth={0.1} />;
    case "marcador":
      return <circle r={0.6} fill={cor} fillOpacity={0.7} />;
  }
}

/**
 * Planta 2D vetorial: alternativa funcional quando o 3D não roda, e vista preferida de quem só quer
 * localizar. Mesmos dados, mesma seleção.
 */
export function Plano2D({
  arena,
  camadas,
  selecionado,
  realce,
  recuoDireita,
  onSelecionar,
  edicao,
  medicao,
  fundo,
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  realce?: RealcePlano | null;
  /** Painel aberto à direita: os controles de zoom recuam para não ficarem por baixo. */
  recuoDireita?: boolean;
  onSelecionar: (id: string | null) => void;
  edicao?: EdicaoPlano | null;
  medicao?: MedicaoPlano | null;
  /** Imagem da planta do evento, esticada no retângulo `arena.area`, atrás de tudo. */
  fundo?: string | null;
}) {
  const { minX, maxX, minZ, maxZ } = arena.area;
  const largura = maxX - minX;
  const altura = maxZ - minZ;
  const [vista, setVista] = useState({ s: 1, x: 0, y: 0 });
  const [passando, setPassando] = useState<string | null>(null);
  const arraste = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const grupoRef = useRef<SVGGElement>(null);
  // Ponto sendo arrastado no modo edição: posição provisória até soltar.
  const [arrastando, setArrastando] = useState<{ id: string; x: number; z: number; moveu: boolean } | null>(null);
  /** Coordenada do mapa (metros) sob o ponteiro, considerando zoom e deslocamento. */
  const paraMapa = (clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current;
    const g = grupoRef.current;
    const ctm = g?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = pt.matrixTransform(ctm.inverse());
    return [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10];
  };
  // Ordem de tabulação espacial (norte → sul, oeste → leste), não a ordem de autoria dos dados.
  const pontos = useMemo(() => [...arena.pontos].sort((a, b) => a.posicao[1] - b.posicao[1] || a.posicao[0] - b.posicao[0]), [arena.pontos]);
  const visiveis = useMemo(() => pontos.filter((p) => camadas[CATEGORIAS[p.categoria].camada]), [pontos, camadas]);
  const quantidades = useMemo(() => new Map(arena.pontos.map((p) => [p.id, quantidadeAta(p)])), [arena.pontos]);

  const posicaoDe = (p: PontoArena): Vec2 => (arrastando?.id === p.id ? [arrastando.x, arrastando.z] : p.posicao);

  /**
   * Candidatos a rótulo (de longe: principais, selecionado, sob o ponteiro e, na conferência, os
   * divergentes) e, entre eles, só os que cabem sem sobrepor outro rótulo nem cobrir um pino.
   * As contas são em unidades do SVG: o rótulo tem tamanho fixo e a distância cresce com o zoom.
   */
  const s = vista.s;
  const emEdicao = Boolean(edicao);
  const rotulosVisiveis = useMemo(() => {
    const rotulos: CaixaRotulo[] = [];
    const pinos: CaixaTela[] = [];
    for (const p of visiveis) {
      const ativo = p.id === selecionado;
      const divergente = realce?.destaque.has(p.id) ?? false;
      const emFoco = (realce?.foco.has(p.id) ?? false) || p.id === passando;
      const [px, pz] = arrastando?.id === p.id ? [arrastando.x, arrastando.z] : p.posicao;
      const X = px * s;
      const Y = pz * s;
      const r = emEdicao ? 11 : divergente ? 13 : 8;
      pinos.push({ id: p.id, x0: X - r, y0: Y - r, x1: X + r, y1: Y + r });
      const candidato = realce ? ativo || emFoco || (divergente && camadas.rotulos) : ativo || emFoco || (camadas.rotulos && (Boolean(p.principal) || s >= 2.2));
      if (!candidato) continue;
      const forte = ativo || emFoco;
      const dx = divergente ? 16 : 9;
      const w = larguraTexto(p.nome, 11, forte) + larguraTexto(sufixoQuantidade(quantidades.get(p.id)), 10, false);
      rotulos.push({ id: p.id, x0: X + dx - 2, y0: Y - 9, x1: X + dx + w + 2, y1: Y + 6, prioridade: prioridadeRotulo({ selecionado: ativo, foco: emFoco, principal: Boolean(p.principal) || divergente }) });
    }
    return rotulosSemSobreposicao(rotulos, pinos);
  }, [visiveis, selecionado, realce, passando, s, camadas.rotulos, emEdicao, arrastando, quantidades]);

  const zoom = (fator: number) => setVista((v) => ({ ...v, s: Math.min(8, Math.max(1, v.s * fator)) }));

  // Régua: segunda ponta é o clique ou, enquanto não houver, o ponteiro.
  const pontaB = medicao?.b ?? medicao?.cursor ?? null;
  const medidaA = medicao?.a ?? null;
  const baseApagada = fundo ? 0.3 : 1;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#e7e9dd]">
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minZ} ${largura} ${altura}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("h-full w-full touch-none select-none", (edicao?.colocando || medicao) && "cursor-crosshair")}
        role="group"
        aria-label={`Planta 2D da arena ${arena.evento.nome}`}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onPointerDown={(e) => {
          arraste.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, moveu: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (arrastando) {
            const m = paraMapa(e.clientX, e.clientY);
            if (m) setArrastando((d) => (d ? { ...d, x: m[0], z: m[1], moveu: true } : d));
            return;
          }
          if (medicao?.a && !medicao.b) medicao.onCursor(paraMapa(e.clientX, e.clientY));
          const a = arraste.current;
          const svg = svgRef.current;
          if (!a || !svg) return;
          const k = largura / svg.clientWidth / vista.s;
          if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) a.moveu = true;
          setVista((v) => ({ ...v, x: a.vx + (e.clientX - a.x) * k, y: a.vy + (e.clientY - a.y) * k }));
        }}
        onPointerLeave={() => medicao?.onCursor(null)}
        onPointerUp={(e) => {
          if (arrastando) {
            if (arrastando.moveu) edicao?.onMover(arrastando.id, arrastando.x, arrastando.z);
            else onSelecionar(arrastando.id);
            setArrastando(null);
            arraste.current = null;
            return;
          }
          if (arraste.current && !arraste.current.moveu) {
            const m = medicao || edicao?.colocando ? paraMapa(e.clientX, e.clientY) : null;
            if (m && medicao) medicao.onClicar(m[0], m[1]);
            else if (m) edicao!.onColocar(m[0], m[1]);
            else if (!medicao) onSelecionar(null);
          }
          arraste.current = null;
        }}
      >
        <g ref={grupoRef} transform={`translate(${(minX + largura / 2) * (1 - vista.s) + vista.x * vista.s} ${(minZ + altura / 2) * (1 - vista.s) + vista.y * vista.s}) scale(${vista.s})`}>
          {fundo && <image href={fundo} x={minX} y={minZ} width={largura} height={altura} preserveAspectRatio="none" opacity={0.85} />}
          {/* Com a planta de fundo, o terreno desenhado vira só uma veladura: a imagem é a referência. */}
          <g opacity={baseApagada}>
            {arena.zonas
              .filter((z) => z.tipo === "arena" || z.tipo === "agua")
              .map((z) => (
                <polygon key={z.id} points={pts(z.poligono)} fill={z.tipo === "agua" ? "#c5d3d3" : "#dde0cf"} />
              ))}
            {arena.vias.map((v) => (
              <polyline key={v.nome} points={pts(v.eixo)} fill="none" stroke="#bdb6ad" strokeWidth={v.largura} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {arena.edificacoes.map((e, i) =>
              "centro" in e ? <circle key={i} cx={e.centro[0]} cy={e.centro[1]} r={e.raio} fill="#d6d0c9" /> : <polygon key={i} points={pts(e.poligono)} fill="#d6d0c9" />,
            )}
            {arena.marco && (
              <g>
                <path d={`M ${arena.marco.posicao[0] - arena.marco.raioPraca} ${arena.marco.posicao[1]} A ${arena.marco.raioPraca} ${arena.marco.raioPraca} 0 0 0 ${arena.marco.posicao[0] + arena.marco.raioPraca} ${arena.marco.posicao[1]}`} fill="#e2dcd2" stroke="#8c8585" strokeWidth={4} />
                <rect x={arena.marco.posicao[0] - 4} y={arena.marco.posicao[1] - 4} width={8} height={8} fill="#6f6366" />
              </g>
            )}
          </g>
          {camadas.zonas &&
            arena.currais.map((c) => <polygon key={c.id} points={pts(poligonoFaixa(c.eixo, c.largura))} fill={c.cor} stroke="#2a1418" strokeOpacity={0.35} strokeWidth={0.6} />)}
          {camadas.zonas &&
            arena.zonas
              .filter((z) => z.tipo === "apoio" || z.tipo === "restrita")
              .map((z) => <polygon key={z.id} points={pts(z.poligono)} fill="#efe7d6" fillOpacity={0.8} stroke="#6d6566" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />)}
          {camadas.percurso &&
            arena.percurso.trechos.map((t) => (
              <polyline key={t.id} points={pts(t.eixo)} fill="none" stroke={COR_PERCURSO} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
          {/* Pegadas em escala real dos itens acrescentados, sob os pinos, giradas com o ponto. */}
          {visiveis.map((p) => {
            const forma = formaDoPonto(p);
            if (!forma) return null;
            const [px, pz] = posicaoDe(p);
            const apagado = Boolean(realce) && !realce?.destaque.has(p.id);
            return (
              <g key={p.id} transform={`translate(${px} ${pz}) rotate(${-emGraus(p.rotacao ?? 0)})`} opacity={apagado ? 0.35 : 0.95} pointerEvents="none">
                <Pegada forma={forma} cor={CATEGORIAS[p.categoria].cor} />
              </g>
            );
          })}
          {visiveis.map((p) => {
            const ativo = p.id === selecionado;
            const divergente = realce?.destaque.has(p.id) ?? false;
            const emFoco = realce?.foco.has(p.id) ?? false;
            const apagado = Boolean(realce) && !divergente;
            const rotulo = rotulosVisiveis.has(p.id);
            const cor = apagado ? "#c3bcbc" : divergente ? "#a8400f" : CATEGORIAS[p.categoria].cor;
            const emArraste = arrastando?.id === p.id;
            const [px, pz] = posicaoDe(p);
            const manual = edicao?.editadas.has(p.id) ?? false;
            const giro = p.rotacao ?? 0;
            // Seta de orientação: sempre no selecionado durante a edição; nos demais, só se girados.
            const seta = edicao && (ativo || emGraus(giro) !== 0);
            const qtd = sufixoQuantidade(quantidades.get(p.id));
            return (
              <g
                key={p.id}
                transform={`translate(${px} ${pz}) scale(${1 / vista.s})`}
                style={edicao && !medicao ? { cursor: emArraste ? "grabbing" : "grab" } : undefined}
                onPointerDown={
                  edicao
                    ? (e) => {
                        // Posicionando um item ou medindo: o clique vale para o mapa, mesmo em cima de outro ponto.
                        if (edicao.colocando || medicao) return;
                        e.stopPropagation();
                        (e.currentTarget.ownerSVGElement ?? svgRef.current)?.setPointerCapture?.(e.pointerId);
                        setArrastando({ id: p.id, x: p.posicao[0], z: p.posicao[1], moveu: false });
                      }
                    : undefined
                }
                role="button"
                tabIndex={0}
                aria-label={`${p.nome}, ${p.tipo}${qtd ? `, quantidade${qtd.replace(" ×", "")}` : ""}${divergente ? ", com divergência entre planta e ata" : ""}`}
                aria-pressed={ativo}
                className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-[var(--color-accent)]"
                onPointerEnter={() => setPassando(p.id)}
                onPointerLeave={() => setPassando((v) => (v === p.id ? null : v))}
                onPointerUp={(e) => {
                  if (medicao) {
                    // Medindo, o clique no ponto prende a ponta da régua no centro dele. Arrastar ainda move o mapa.
                    if (arraste.current?.moveu) return;
                    e.stopPropagation();
                    arraste.current = null;
                    medicao.onClicar(p.posicao[0], p.posicao[1]);
                    return;
                  }
                  if (edicao) return; // o SVG trata soltar/selecionar no modo edição
                  e.stopPropagation();
                  arraste.current = null;
                  onSelecionar(p.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (medicao) medicao.onClicar(p.posicao[0], p.posicao[1]);
                    else onSelecionar(p.id);
                  }
                }}
              >
                {divergente && <circle r={13} fill="none" stroke="#a8400f" strokeWidth={emFoco ? 2 : 1.5} strokeDasharray="3 3" opacity={emFoco ? 1 : 0.7} />}
                {edicao && <circle r={emArraste ? 16 : 11} fill={emArraste ? "rgba(142,39,64,.12)" : "transparent"} stroke={manual || emArraste ? "#8e2740" : "#8e274055"} strokeWidth={1.5} strokeDasharray={manual ? undefined : "2 2"} />}
                {seta && (
                  <g transform={`rotate(${-emGraus(giro)})`} stroke={ativo ? "#8e2740" : "#6d6566"} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" pointerEvents="none">
                    <line x1={0} y1={-12} x2={0} y2={-19} />
                    <path d="M -3 -16 L 0 -20 L 3 -16" />
                  </g>
                )}
                <circle r={apagado ? 4 : divergente ? 7 : ativo ? 8 : 5.5} fill={cor} stroke="#fff" strokeWidth={ativo || emFoco ? 3 : 2} />
                {rotulo && (
                  <text x={divergente ? 16 : 9} y={4} fontSize={11} fontFamily="var(--font-geist), Arial, sans-serif" fontWeight={ativo || emFoco || p.id === passando ? 600 : 500} fill="#2a1418" paintOrder="stroke" stroke="#f7f5f2" strokeWidth={3}>
                    {p.nome}
                    {qtd && (
                      <tspan className="font-mono" fontSize={10} fontWeight={400} fillOpacity={0.62}>
                        {qtd}
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            );
          })}
          {medidaA && pontaB && (
            <g pointerEvents="none">
              <line x1={medidaA[0]} y1={medidaA[1]} x2={pontaB[0]} y2={pontaB[1]} stroke="#8e2740" strokeWidth={2} strokeDasharray="7 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={medicao?.b ? 1 : 0.7} />
              {distancia(medidaA, pontaB) > 0 && (
                <g transform={`translate(${(medidaA[0] + pontaB[0]) / 2} ${(medidaA[1] + pontaB[1]) / 2}) scale(${1 / vista.s})`}>
                  {(() => {
                    const texto = rotuloDistancia(distancia(medidaA, pontaB));
                    const w = larguraTexto(texto, 11, true) + 14;
                    return (
                      <>
                        <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill="#8e2740" stroke="#fff" strokeWidth={1.5} />
                        <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily="var(--font-geist), Arial, sans-serif" fill="#fff">
                          {texto}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          )}
          {medidaA &&
            [medidaA, medicao?.b].map((q, i) =>
              q ? (
                <g key={i} transform={`translate(${q[0]} ${q[1]}) scale(${1 / vista.s})`} pointerEvents="none">
                  <circle r={4.5} fill="#fff" stroke="#8e2740" strokeWidth={2.5} />
                </g>
              ) : null,
            )}
        </g>
      </svg>
      <div className={cn("pointer-events-auto absolute bottom-3 flex flex-col overflow-hidden rounded-cartao border border-line bg-surface shadow-pill", recuoDireita ? "right-[384px]" : "right-3")}>
        <button type="button" aria-label="Aproximar" title="Aproximar" onClick={() => zoom(1.4)} className="grid size-9 cursor-pointer place-items-center border-0 border-b border-line-soft bg-transparent text-ink-2 hover:bg-subtle hover:text-ink">
          <IconeMais />
        </button>
        <button type="button" aria-label="Afastar" title="Afastar" onClick={() => zoom(1 / 1.4)} className="grid size-9 cursor-pointer place-items-center border-0 border-b border-line-soft bg-transparent text-ink-2 hover:bg-subtle hover:text-ink">
          <IconeMenos />
        </button>
        <button type="button" aria-label="Enquadrar a arena" title="Enquadrar a arena" onClick={() => setVista({ s: 1, x: 0, y: 0 })} className="grid h-9 cursor-pointer place-items-center border-0 bg-transparent px-2 text-rotulo font-medium text-ink-2 hover:bg-subtle hover:text-ink">
          Tudo
        </button>
      </div>
    </div>
  );
}
