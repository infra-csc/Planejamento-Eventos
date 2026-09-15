"use client";

import { useRef } from "react";
import type { Arena } from "@/domain/arena/tipos";
import { CATEGORIAS, COR_PERCURSO, type Camada } from "@/domain/arena/categorias";
import { poligonoFaixa } from "@/domain/arena/geometria";

const pts = (lista: Array<[number, number]>) => lista.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(" ");

/**
 * Minimapa com a área que a câmera enxerga: responde "onde estou?" e "como volto?".
 * O polígono da câmera é atualizado direto no DOM pelo motor (sem re-render do React por quadro).
 */
export function Minimapa({
  arena,
  camadas,
  selecionado,
  pegadaRef,
  onIr,
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  pegadaRef: React.RefObject<SVGPolygonElement | null>;
  onIr: (x: number, z: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { minX, maxX, minZ, maxZ } = arena.area;
  const w = maxX - minX;
  const h = maxZ - minZ;
  return (
    <div className="pointer-events-auto overflow-hidden rounded-[10px] border border-line bg-[#e4e6d9] shadow-[0_2px_8px_rgba(42,20,24,.1)]">
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minZ} ${w} ${h}`}
        width={216}
        height={Math.round((216 * h) / w)}
        className="block cursor-crosshair"
        role="img"
        aria-label="Minimapa: clique para levar a câmera até o local"
        onClick={(e) => {
          const svg = svgRef.current;
          const m = svg?.getScreenCTM();
          if (!svg || !m) return;
          const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
          onIr(p.x, p.y);
        }}
      >
        {arena.zonas
          .filter((z) => z.tipo === "agua" || z.tipo === "arena")
          .map((z) => (
            <polygon key={z.id} points={pts(z.poligono)} fill={z.tipo === "agua" ? "#b9c9ca" : "#d6dac6"} />
          ))}
        {arena.vias.map((v) => (
          <polyline key={v.nome} points={pts(v.eixo)} fill="none" stroke="#b1aaa2" strokeWidth={v.largura} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {arena.edificacoes.map((e, i) => ("centro" in e ? <circle key={i} cx={e.centro[0]} cy={e.centro[1]} r={e.raio} fill="#cbc4bb" /> : <polygon key={i} points={pts(e.poligono)} fill="#cbc4bb" />))}
        {arena.currais.map((c) => (
          <polygon key={c.id} points={pts(poligonoFaixa(c.eixo, c.largura))} fill={c.cor} />
        ))}
        {camadas.percurso &&
          arena.percurso.trechos.map((t) => <polyline key={t.id} points={pts(t.eixo)} fill="none" stroke={COR_PERCURSO} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        {arena.marco && <rect x={arena.marco.posicao[0] - 5} y={arena.marco.posicao[1] - 5} width={10} height={10} fill="#6f6366" />}
        {arena.pontos
          .filter((p) => camadas[CATEGORIAS[p.categoria].camada])
          .map((p) => (
            <circle key={p.id} cx={p.posicao[0]} cy={p.posicao[1]} r={p.id === selecionado ? 9 : 5} fill={CATEGORIAS[p.categoria].cor} stroke="#fff" strokeWidth={p.id === selecionado ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
          ))}
        <polygon ref={pegadaRef} points="" fill="rgba(142,39,64,0.12)" stroke="#8e2740" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
