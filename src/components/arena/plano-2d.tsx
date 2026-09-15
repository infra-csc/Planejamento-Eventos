"use client";

import { useRef, useState } from "react";
import type { Arena } from "@/domain/arena/tipos";
import { CATEGORIAS, COR_PERCURSO, type Camada } from "@/domain/arena/categorias";
import { poligonoFaixa } from "@/domain/arena/geometria";

const pts = (lista: Array<[number, number]>) => lista.map(([x, z]) => `${x},${z}`).join(" ");

/**
 * Planta 2D vetorial: alternativa funcional quando o 3D não roda, e vista preferida de quem só quer
 * localizar. Mesmos dados, mesma seleção.
 */
export function Plano2D({
  arena,
  camadas,
  selecionado,
  onSelecionar,
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
}) {
  const { minX, maxX, minZ, maxZ } = arena.area;
  const largura = maxX - minX;
  const altura = maxZ - minZ;
  const [vista, setVista] = useState({ s: 1, x: 0, y: 0 });
  const arraste = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const zoom = (fator: number) => setVista((v) => ({ ...v, s: Math.min(8, Math.max(1, v.s * fator)) }));

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#e7e9dd]">
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minZ} ${largura} ${altura}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`Planta 2D da arena ${arena.evento.nome}`}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onPointerDown={(e) => {
          arraste.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, moveu: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const a = arraste.current;
          const svg = svgRef.current;
          if (!a || !svg) return;
          const k = largura / svg.clientWidth / vista.s;
          if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) a.moveu = true;
          setVista((v) => ({ ...v, x: a.vx + (e.clientX - a.x) * k, y: a.vy + (e.clientY - a.y) * k }));
        }}
        onPointerUp={() => {
          if (arraste.current && !arraste.current.moveu) onSelecionar(null);
          arraste.current = null;
        }}
      >
        <g transform={`translate(${(minX + largura / 2) * (1 - vista.s) + vista.x * vista.s} ${(minZ + altura / 2) * (1 - vista.s) + vista.y * vista.s}) scale(${vista.s})`}>
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
          {arena.pontos
            .filter((p) => camadas[CATEGORIAS[p.categoria].camada])
            .map((p) => {
              const ativo = p.id === selecionado;
              const rotulo = camadas.rotulos && (p.principal || vista.s >= 2.2 || ativo);
              return (
                <g
                  key={p.id}
                  transform={`translate(${p.posicao[0]} ${p.posicao[1]}) scale(${1 / vista.s})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.nome}, ${p.tipo}`}
                  aria-pressed={ativo}
                  className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[#8e2740]"
                  onPointerUp={(e) => {
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
                  <circle r={ativo ? 8 : 5.5} fill={CATEGORIAS[p.categoria].cor} stroke="#fff" strokeWidth={ativo ? 3 : 2} />
                  {rotulo && (
                    <text x={9} y={4} fontSize={11} fontFamily="var(--font-geist), Arial, sans-serif" fontWeight={ativo ? 600 : 500} fill="#2a1418" paintOrder="stroke" stroke="#f7f5f2" strokeWidth={3}>
                      {p.nome}
                    </text>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
      <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-[9px] border border-line bg-surface shadow-sm">
        <button type="button" aria-label="Aproximar" onClick={() => zoom(1.4)} className="grid size-9 cursor-pointer place-items-center border-0 border-b border-line-soft bg-transparent text-[18px] text-ink-2 hover:bg-subtle">
          +
        </button>
        <button type="button" aria-label="Afastar" onClick={() => zoom(1 / 1.4)} className="grid size-9 cursor-pointer place-items-center border-0 border-b border-line-soft bg-transparent text-[18px] text-ink-2 hover:bg-subtle">
          −
        </button>
        <button type="button" aria-label="Enquadrar a arena" onClick={() => setVista({ s: 1, x: 0, y: 0 })} className="grid h-9 cursor-pointer place-items-center border-0 bg-transparent px-2 text-[11px] font-medium text-ink-2 hover:bg-subtle">
          Tudo
        </button>
      </div>
    </div>
  );
}
