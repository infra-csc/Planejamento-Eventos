"use client";

import { useMemo, useRef } from "react";
import type { PontoArena, Vec2 } from "@/domain/arena/tipos";
import { CATEGORIAS, prioridadeRotulo, type Camada } from "@/domain/arena/categorias";
import { distancia, quantidadeAta, rotuloDistancia } from "@/domain/arena/posicoes";
import { cn } from "@/lib/cn";
import type { MotorArena } from "./cena/motor";
import type { PosicionarItem } from "./painel-ponto";
import type { EdicaoPlano } from "./plano-2d";

/**
 * Marcadores HTML sobre a cena 3D (o motor posiciona cada um no quadro) e as pontas da régua.
 * Fica sempre montado dentro do overlay: o arraste em andamento sobrevive a trocas de estado.
 */
export function Marcadores3D({
  visivel,
  pontos,
  camadas,
  selecionado,
  hover,
  setHover,
  idsFoco,
  conferenciaAtiva,
  idsDivergentes,
  medindo,
  medida,
  pontaMedida,
  marcarMedida,
  editando,
  colocando,
  edicaoPlano,
  setPrevia,
  abrirPonto,
  motorRef,
}: {
  visivel: boolean;
  pontos: PontoArena[];
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  idsFoco: Set<string>;
  conferenciaAtiva: boolean;
  idsDivergentes: Set<string>;
  medindo: boolean;
  medida: { a: Vec2 | null; b: Vec2 | null };
  pontaMedida: Vec2 | null;
  marcarMedida: (x: number, z: number) => void;
  editando: boolean;
  colocando: PosicionarItem | null;
  edicaoPlano: EdicaoPlano | null;
  setPrevia: (previa: { id: string; posicao: [number, number] } | null) => void;
  abrirPonto: (id: string) => void;
  motorRef: React.RefObject<MotorArena | null>;
}) {
  /** Arraste de marcador no 3D (modo edição). */
  const arraste3d = useRef<{ id: string; x0: number; y0: number; moveu: boolean; ultimo: [number, number] | null; dx: number; dy: number } | null>(null);
  const ignorarClique = useRef(false);
  // Ordem de tabulação dos marcadores: espacial (norte → sul), não a de autoria dos dados.
  const pontosOrdenados = useMemo(() => [...pontos].sort((a, b) => a.posicao[1] - b.posicao[1] || a.posicao[0] - b.posicao[0]), [pontos]);
  const quantidades = useMemo(() => new Map(pontos.map((p) => [p.id, quantidadeAta(p)])), [pontos]);

  return (
    <>
      {visivel &&
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
                    {qtd != null && <span className={cn("ml-1 numero text-rotulo font-normal", ativo ? "text-white/75" : "text-muted")}>× {qtd.toLocaleString("pt-BR")}</span>}
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
      {visivel && medida.a && (
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
    </>
  );
}
