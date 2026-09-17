"use client";

import { useMemo, useRef, useState } from "react";
import type { Arena } from "@/domain/arena/tipos";
import { CATEGORIAS, COR_PERCURSO, type Camada } from "@/domain/arena/categorias";
import { poligonoFaixa } from "@/domain/arena/geometria";
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
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  realce?: RealcePlano | null;
  /** Painel aberto à direita: os controles de zoom recuam para não ficarem por baixo. */
  recuoDireita?: boolean;
  onSelecionar: (id: string | null) => void;
  edicao?: EdicaoPlano | null;
}) {
  const { minX, maxX, minZ, maxZ } = arena.area;
  const largura = maxX - minX;
  const altura = maxZ - minZ;
  const [vista, setVista] = useState({ s: 1, x: 0, y: 0 });
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

  const zoom = (fator: number) => setVista((v) => ({ ...v, s: Math.min(8, Math.max(1, v.s * fator)) }));

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#e7e9dd]">
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minZ} ${largura} ${altura}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("h-full w-full touch-none select-none", edicao?.colocando && "cursor-crosshair")}
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
          const a = arraste.current;
          const svg = svgRef.current;
          if (!a || !svg) return;
          const k = largura / svg.clientWidth / vista.s;
          if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) a.moveu = true;
          setVista((v) => ({ ...v, x: a.vx + (e.clientX - a.x) * k, y: a.vy + (e.clientY - a.y) * k }));
        }}
        onPointerUp={(e) => {
          if (arrastando) {
            if (arrastando.moveu) edicao?.onMover(arrastando.id, arrastando.x, arrastando.z);
            else onSelecionar(arrastando.id);
            setArrastando(null);
            arraste.current = null;
            return;
          }
          if (arraste.current && !arraste.current.moveu) {
            const m = edicao?.colocando ? paraMapa(e.clientX, e.clientY) : null;
            if (m) edicao!.onColocar(m[0], m[1]);
            else onSelecionar(null);
          }
          arraste.current = null;
        }}
      >
        <g ref={grupoRef} transform={`translate(${(minX + largura / 2) * (1 - vista.s) + vista.x * vista.s} ${(minZ + altura / 2) * (1 - vista.s) + vista.y * vista.s}) scale(${vista.s})`}>
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
          {pontos
            .filter((p) => camadas[CATEGORIAS[p.categoria].camada])
            .map((p) => {
              const ativo = p.id === selecionado;
              const divergente = realce?.destaque.has(p.id) ?? false;
              const emFoco = realce?.foco.has(p.id) ?? false;
              const apagado = Boolean(realce) && !divergente;
              // Na conferência, os rótulos seguem a divergência, não a camada.
              const rotulo = realce ? divergente && (emFoco || camadas.rotulos) : camadas.rotulos && (p.principal || vista.s >= 2.2 || ativo);
              const cor = apagado ? "#c3bcbc" : divergente ? "#a8400f" : CATEGORIAS[p.categoria].cor;
              const emArraste = arrastando?.id === p.id;
              const [px, pz] = emArraste ? [arrastando.x, arrastando.z] : p.posicao;
              const manual = edicao?.editadas.has(p.id) ?? false;
              return (
                <g
                  key={p.id}
                  transform={`translate(${px} ${pz}) scale(${1 / vista.s})`}
                  style={edicao ? { cursor: emArraste ? "grabbing" : "grab" } : undefined}
                  onPointerDown={
                    edicao
                      ? (e) => {
                          // Posicionando um item: o clique vale para o mapa, mesmo em cima de outro ponto.
                          if (edicao.colocando) return;
                          e.stopPropagation();
                          (e.currentTarget.ownerSVGElement ?? svgRef.current)?.setPointerCapture?.(e.pointerId);
                          setArrastando({ id: p.id, x: p.posicao[0], z: p.posicao[1], moveu: false });
                        }
                      : undefined
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.nome}, ${p.tipo}${divergente ? ", com divergência entre planta e ata" : ""}`}
                  aria-pressed={ativo}
                  className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-[var(--color-accent)]"
                  onPointerUp={(e) => {
                    if (edicao) return; // o SVG trata soltar/selecionar no modo edição
                    e.stopPropagation();
                    arraste.current = null;
                    onSelecionar(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelecionar(p.id);
                    }
                  }}
                >
                  {divergente && <circle r={13} fill="none" stroke="#a8400f" strokeWidth={emFoco ? 2 : 1.5} strokeDasharray="3 3" opacity={emFoco ? 1 : 0.7} />}
                  {edicao && <circle r={emArraste ? 16 : 11} fill={emArraste ? "rgba(142,39,64,.12)" : "transparent"} stroke={manual || emArraste ? "#8e2740" : "#8e274055"} strokeWidth={1.5} strokeDasharray={manual ? undefined : "2 2"} />}
                  <circle r={apagado ? 4 : divergente ? 7 : ativo ? 8 : 5.5} fill={cor} stroke="#fff" strokeWidth={ativo || emFoco ? 3 : 2} />
                  {rotulo && (
                    <text x={divergente ? 16 : 9} y={4} fontSize={11} fontFamily="var(--font-geist), Arial, sans-serif" fontWeight={ativo || emFoco ? 600 : 500} fill="#2a1418" paintOrder="stroke" stroke="#f7f5f2" strokeWidth={3}>
                      {p.nome}
                    </text>
                  )}
                </g>
              );
            })}
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
