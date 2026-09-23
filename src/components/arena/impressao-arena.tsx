import type { Arena, CategoriaPonto, PontoArena, Vec2 } from "@/domain/arena/tipos";
import { CATEGORIAS, COR_PERCURSO } from "@/domain/arena/categorias";
import { itensNaoPosicionados, poligonoFaixa } from "@/domain/arena/geometria";
import { formatarData, formatarDataHora } from "@/lib/format";

/**
 * Mapa de montagem para impressão (A4 paisagem): a mesma planta do plano 2D, estática, com os
 * pontos numerados na ordem espacial; nas páginas seguintes, a lista numerada e o que ficou sem
 * posição. Sem interatividade e sem three.js: é o papel que a equipe leva a campo.
 */

const pts = (lista: Vec2[]) => lista.map(([x, z]) => `${x},${z}`).join(" ");
const FONTE = "Arial, Helvetica, sans-serif";
const numero1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Ordem de leitura do mapa: norte → sul, oeste → leste (a mesma do plano 2D). */
export function ordenarPontos(pontos: PontoArena[]): PontoArena[] {
  return [...pontos].sort((a, b) => a.posicao[1] - b.posicao[1] || a.posicao[0] - b.posicao[0]);
}

function quantidadeAta(p: PontoArena): number | null {
  const qs = p.itensAta.map((i) => i.quantidade).filter((q): q is number => q != null);
  return qs.length ? qs.reduce((a, q) => a + q, 0) : null;
}

function curto(texto: string, max = 90): string {
  const t = texto.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Comprimento da escala gráfica: 50 m, a não ser que fique pequeno ou grande demais para a área. */
function comprimentoEscala(largura: number): number {
  if (50 >= largura * 0.06 && 50 <= largura * 0.3) return 50;
  const alvo = largura * 0.15;
  return [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].reduce((m, c) => (Math.abs(c - alvo) < Math.abs(m - alvo) ? c : m));
}

function Marcador({ n, cor, tamanho = 18 }: { n: number; cor: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" aria-hidden className="inline-block shrink-0 align-middle">
      <circle cx={10} cy={10} r={9.5} fill={cor} />
      <text x={10} y={10.5} textAnchor="middle" dominantBaseline="central" fontSize={n >= 100 ? 8 : n >= 10 ? 9.5 : 11} fontWeight={700} fontFamily={FONTE} fill="#fff">
        {n}
      </text>
    </svg>
  );
}

function Amostra({ children }: { children: React.ReactNode }) {
  return (
    <svg width={22} height={12} viewBox="0 0 22 12" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

function PlantaImpressa({ arena, slug, temPlanta, pontos }: { arena: Arena; slug: string; temPlanta: boolean; pontos: PontoArena[] }) {
  const { minX, maxX, minZ, maxZ } = arena.area;
  const largura = maxX - minX;
  const altura = maxZ - minZ;
  // Unidade de desenho: ~1/200 do maior lado. Marcadores e textos ficam do mesmo tamanho no papel em qualquer arena.
  const u = Math.max(largura, altura) / 200;
  const pad = u * 4;
  const vb = { x: minX - pad, y: minZ - pad, w: largura + pad * 2, h: altura + pad * 2 };
  // Com a planta de fundo, o desenho de contexto (gramado, vias, prédios) fica transparente para não escondê-la.
  const contexto = temPlanta ? 0.3 : 1;

  const escala = comprimentoEscala(largura);
  const ex = vb.x + u * 5;
  const ey = vb.y + vb.h - u * 6;
  const nx = vb.x + vb.w - u * 9;
  const ny = vb.y + u * 11;

  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" role="img" aria-label={`Planta da arena ${arena.evento.nome} com ${pontos.length} pontos numerados`}>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#fff" />
      <rect x={minX} y={minZ} width={largura} height={altura} fill="#e7e9dd" />
      {temPlanta && <image href={`/api/arenas/${encodeURIComponent(slug)}/planta`} x={minX} y={minZ} width={largura} height={altura} preserveAspectRatio="none" opacity={0.85} />}
      <g opacity={contexto}>
        {arena.zonas
          .filter((z) => z.tipo === "arena" || z.tipo === "agua")
          .map((z) => (
            <polygon key={z.id} points={pts(z.poligono)} fill={z.tipo === "agua" ? "#c5d3d3" : "#dde0cf"} />
          ))}
        {arena.vias.map((v) => (
          <polyline key={v.nome} points={pts(v.eixo)} fill="none" stroke="#bdb6ad" strokeWidth={v.largura} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {arena.edificacoes.map((e, i) => ("centro" in e ? <circle key={i} cx={e.centro[0]} cy={e.centro[1]} r={e.raio} fill="#d6d0c9" /> : <polygon key={i} points={pts(e.poligono)} fill="#d6d0c9" />))}
      </g>
      {arena.marco && (
        <g>
          <path
            d={`M ${arena.marco.posicao[0] - arena.marco.raioPraca} ${arena.marco.posicao[1]} A ${arena.marco.raioPraca} ${arena.marco.raioPraca} 0 0 0 ${arena.marco.posicao[0] + arena.marco.raioPraca} ${arena.marco.posicao[1]}`}
            fill="#e2dcd2"
            fillOpacity={contexto}
            stroke="#8c8585"
            strokeWidth={u * 0.6}
          />
          <rect x={arena.marco.posicao[0] - u * 1.2} y={arena.marco.posicao[1] - u * 1.2} width={u * 2.4} height={u * 2.4} fill="#6f6366" />
        </g>
      )}
      {arena.currais.map((c) => (
        <polygon key={c.id} points={pts(poligonoFaixa(c.eixo, c.largura))} fill={c.cor} stroke="#2a1418" strokeOpacity={0.45} strokeWidth={u * 0.25} />
      ))}
      {arena.zonas
        .filter((z) => z.tipo === "apoio" || z.tipo === "restrita")
        .map((z) => (
          <polygon key={z.id} points={pts(z.poligono)} fill="#efe7d6" fillOpacity={temPlanta ? 0.35 : 0.8} stroke="#6d6566" strokeWidth={u * 0.3} strokeDasharray={`${u} ${u * 0.7}`} />
        ))}
      {arena.percurso.trechos.map((t) => (
        <polyline key={t.id} points={pts(t.eixo)} fill="none" stroke={COR_PERCURSO} strokeWidth={u * 0.9} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <rect x={minX} y={minZ} width={largura} height={altura} fill="none" stroke="#6d6566" strokeWidth={u * 0.2} />

      {pontos.map((p, i) => {
        const n = i + 1;
        return (
          <g key={p.id} transform={`translate(${p.posicao[0]} ${p.posicao[1]})`}>
            <circle r={u * 2.4} fill={CATEGORIAS[p.categoria].cor} stroke="#fff" strokeWidth={u * 0.4} />
            <text y={u * 0.1} textAnchor="middle" dominantBaseline="central" fontSize={u * (n >= 100 ? 1.8 : n >= 10 ? 2.2 : 2.6)} fontWeight={700} fontFamily={FONTE} fill="#fff">
              {n}
            </text>
          </g>
        );
      })}

      {/* Norte: a planta tem z crescendo para o sul, então o norte é para cima. */}
      <g transform={`translate(${nx} ${ny})`}>
        <circle r={u * 5.5} fill="#fff" fillOpacity={0.9} stroke="#2a1418" strokeWidth={u * 0.25} />
        <polygon points={`0,${-u * 4} ${u * 2},${u * 2} 0,${u * 0.8} ${-u * 2},${u * 2}`} fill="#2a1418" />
        <text y={u * 8} textAnchor="middle" dominantBaseline="central" fontSize={u * 3} fontWeight={700} fontFamily={FONTE} fill="#2a1418" paintOrder="stroke" stroke="#fff" strokeWidth={u * 0.8}>
          N
        </text>
      </g>

      {/* Escala gráfica em metros, no mesmo sistema de coordenadas da planta. */}
      <g>
        <rect x={ex - u * 1.5} y={ey - u * 5.5} width={escala + u * 3} height={u * 8.5} fill="#fff" fillOpacity={0.9} />
        <rect x={ex} y={ey} width={escala / 2} height={u * 1.2} fill="#2a1418" />
        <rect x={ex + escala / 2} y={ey} width={escala / 2} height={u * 1.2} fill="#fff" stroke="#2a1418" strokeWidth={u * 0.2} />
        <text x={ex} y={ey - u * 1.4} textAnchor="start" fontSize={u * 2.4} fontFamily={FONTE} fill="#2a1418">
          0
        </text>
        <text x={ex + escala} y={ey - u * 1.4} textAnchor="end" fontSize={u * 2.4} fontFamily={FONTE} fill="#2a1418">
          {escala} m
        </text>
      </g>
    </svg>
  );
}

function Legenda({ arena, pontos }: { arena: Arena; pontos: PontoArena[] }) {
  const usadas = new Set(pontos.map((p) => p.categoria));
  const categorias = (Object.keys(CATEGORIAS) as CategoriaPonto[]).filter((c) => usadas.has(c));
  const temAreas = arena.zonas.some((z) => z.tipo === "apoio" || z.tipo === "restrita");
  return (
    <div className="text-[10.5px] leading-tight">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide">Legenda</p>
      <ul className="m-0 list-none space-y-1 p-0">
        {categorias.map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <Amostra>
              <circle cx={11} cy={6} r={5.5} fill={CATEGORIAS[c].cor} />
            </Amostra>
            <span>
              {CATEGORIAS[c].rotulo} <span className="text-neutral-500">({pontos.filter((p) => p.categoria === c).length})</span>
            </span>
          </li>
        ))}
        {arena.percurso.trechos.length > 0 && (
          <li className="flex items-center gap-1.5">
            <Amostra>
              <line x1={1} y1={6} x2={21} y2={6} stroke={COR_PERCURSO} strokeWidth={3} strokeLinecap="round" />
            </Amostra>
            <span>Percurso</span>
          </li>
        )}
        {temAreas && (
          <li className="flex items-center gap-1.5">
            <Amostra>
              <rect x={1} y={1} width={20} height={10} fill="#efe7d6" stroke="#6d6566" strokeDasharray="3 2" />
            </Amostra>
            <span>Área de apoio / restrita</span>
          </li>
        )}
        {arena.currais.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <Amostra>
              <rect x={1} y={1} width={20} height={10} fill={c.cor} stroke="#2a1418" strokeOpacity={0.45} />
            </Amostra>
            <span>
              {c.nome} <span className="text-neutral-500">· {c.metros} m</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-neutral-600">Números na ordem do mapa: de norte para sul e, na mesma altura, de oeste para leste. A lista numerada está na página seguinte.</p>
    </div>
  );
}

export function ImpressaoArena({ arena, slug, temPlanta, geradoEm }: { arena: Arena; slug: string; temPlanta: boolean; geradoEm: Date }) {
  const pontos = ordenarPontos(arena.pontos);
  const ev = arena.evento;
  const data = ev.data ? formatarData(ev.data.slice(0, 10)) : null;
  const semPosicao = [
    ...itensNaoPosicionados(arena).map((i) => ({ origem: `Ata · ${i.secao}`, item: i.item, quantidade: i.quantidade, nota: [i.detalhe, i.obs].filter(Boolean).join(" · ") })),
    ...arena.semPosicaoNaPlanta.map((s) => ({ origem: "Planta", item: s.item, quantidade: null as number | null, nota: s.motivo })),
  ];

  return (
    <div className="text-[12px] text-black">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>

      {/* Página 1: a planta. Altura fixa para caber numa folha A4 paisagem (190 mm úteis). */}
      <section className="flex h-[188mm] flex-col break-after-page">
        <header className="mb-3 flex items-end justify-between gap-6 border-b border-black pb-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest">Norte Mkt · Mapa de montagem</p>
            <h1 className="mt-0.5 truncate text-lg font-semibold">{ev.nome}</h1>
            <p className="mt-0.5 text-[11px] text-neutral-600">{[data, ev.local || null, ev.montagem ? `Montagem: ${ev.montagem}` : null].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="shrink-0 text-right text-[10.5px] text-neutral-600">
            <p>{pontos.length} pontos no mapa</p>
            <p>Gerado em {formatarDataHora(geradoEm)}</p>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_52mm] gap-4">
          <div className="min-h-0 border border-neutral-400">
            <PlantaImpressa arena={arena} slug={slug} temPlanta={temPlanta} pontos={pontos} />
          </div>
          <Legenda arena={arena} pontos={pontos} />
        </div>
      </section>

      {/* Página 2 em diante: lista numerada. */}
      <section className="pt-1">
        <h2 className="mb-2 text-base font-semibold">Pontos do mapa</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-left text-[10px] uppercase tracking-wide">
              <th className="w-10 py-1 pr-2">Nº</th>
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3">Categoria</th>
              <th className="py-1 pr-3">Tipo</th>
              <th className="py-1 pr-3 text-right">Qtd. ata</th>
              <th className="py-1 pr-3 whitespace-nowrap">Posição x · z (m)</th>
              <th className="py-1">Observação</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p, i) => {
              const qtd = quantidadeAta(p);
              const obs = [p.status?.rotulo, p.resumo ? curto(p.resumo) : null].filter(Boolean).join(" · ");
              return (
                <tr key={p.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                  <td className="py-1 pr-2">
                    <Marcador n={i + 1} cor={CATEGORIAS[p.categoria].cor} />
                  </td>
                  <td className="py-1 pr-3 font-medium">
                    {p.nome}
                    {p.legenda ? <span className="font-normal text-neutral-500"> · leg. {p.legenda}</span> : null}
                  </td>
                  <td className="py-1 pr-3">{CATEGORIAS[p.categoria].rotulo}</td>
                  <td className="py-1 pr-3">{p.tipo}</td>
                  <td className="numero py-1 pr-3 text-right font-semibold">{qtd ?? "—"}</td>
                  <td className="numero py-1 pr-3 whitespace-nowrap text-[11px]">
                    {numero1.format(p.posicao[0])} · {numero1.format(p.posicao[1])}
                  </td>
                  <td className="py-1 text-[11px] text-neutral-600">{obs || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-neutral-500">Posição em metros a partir do marco da arena: x cresce para leste, z cresce para sul.</p>
      </section>

      <section className="mt-6">
        <h2 className="mb-1 text-base font-semibold">Itens sem posição no mapa</h2>
        {semPosicao.length === 0 ? (
          <p className="text-neutral-600">Todos os itens da ata e da legenda da planta têm posição no mapa.</p>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-neutral-600">Linhas da ata sem ponto correspondente e itens da legenda da planta sem lugar desenhado. Precisam ser localizados em campo.</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-black text-left text-[10px] uppercase tracking-wide">
                  <th className="py-1 pr-3">Origem</th>
                  <th className="py-1 pr-3">Item</th>
                  <th className="py-1 pr-3 text-right">Qtd.</th>
                  <th className="py-1">Observação</th>
                </tr>
              </thead>
              <tbody>
                {semPosicao.map((s, i) => (
                  <tr key={`${s.origem}-${s.item}-${i}`} className="break-inside-avoid border-b border-neutral-300 align-top">
                    <td className="py-1 pr-3 text-[11px] text-neutral-600">{s.origem}</td>
                    <td className="py-1 pr-3">{s.item}</td>
                    <td className="numero py-1 pr-3 text-right">{s.quantidade ?? "—"}</td>
                    <td className="py-1 text-[11px] text-neutral-600">{s.nota ? curto(s.nota, 120) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <footer className="mt-10 grid break-inside-avoid grid-cols-[2fr_1fr] gap-8 text-[11px]">
        <div className="border-t border-black pt-1.5">Conferido por:</div>
        <div className="border-t border-black pt-1.5">Data:</div>
      </footer>
    </div>
  );
}
