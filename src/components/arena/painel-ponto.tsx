"use client";

import type { Arena, PontoArena } from "@/domain/arena/tipos";
import { CATEGORIAS } from "@/domain/arena/categorias";
import { itensNaoPosicionados } from "@/domain/arena/geometria";
import { cn } from "@/lib/cn";
import { IconeFechar } from "./icones";

const DIRECOES = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];

/** "a 214 m a oeste do Obelisco": referência que a equipe usa em campo. */
function referencia(arena: Arena, p: PontoArena) {
  if (!arena.marco) return null;
  const dx = p.posicao[0] - arena.marco.posicao[0];
  const dz = p.posicao[1] - arena.marco.posicao[1];
  const d = Math.hypot(dx, dz);
  if (d < 25) return `junto ao ${arena.marco.nome}`;
  const graus = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const dir = DIRECOES[Math.round(((graus + 360) % 360) / 45) % 8];
  return `a ${Math.round(d / 5) * 5} m a ${dir} do ${arena.marco.nome}`;
}

const TOM_STATUS = {
  ok: "bg-success-bg text-success",
  atencao: "bg-warning-bg text-warning",
  neutro: "bg-neutral-bg text-ink-2",
};

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft px-4 py-3">
      <h3 className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

export function PainelPonto({ arena, ponto, estreito, onFechar, onAproximar }: { arena: Arena; ponto: PontoArena; estreito: boolean; onFechar: () => void; onAproximar: () => void }) {
  const cat = CATEGORIAS[ponto.categoria];
  const zona = arena.zonas.find((z) => z.id === ponto.zonaId);
  const ref = referencia(arena, ponto);
  return (
    <aside
      aria-label={`Informações: ${ponto.nome}`}
      className={cn(
        "pointer-events-auto absolute z-20 flex flex-col overflow-hidden border border-line bg-surface shadow-[0_12px_32px_rgba(42,20,24,.14)] animate-fade-up-rapido",
        estreito ? "inset-x-0 bottom-0 max-h-[62%] rounded-t-[14px]" : "bottom-3 right-3 top-[60px] w-[360px] rounded-[12px]",
      )}
    >
      <header className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span aria-hidden className="mt-1 block size-3 shrink-0 rounded-full ring-4 ring-white" style={{ background: cat.cor, boxShadow: `0 0 0 1px ${cat.cor}33` }} />
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            {ponto.legenda && <span className="font-mono text-ink-2">nº {ponto.legenda}</span>}
            <span>{ponto.tipo}</span>
          </p>
          <h2 className="m-0 mt-0.5 text-[18px] font-semibold leading-[1.25] tracking-[-0.015em] text-ink">{ponto.nome}</h2>
          {ponto.status && <span className={cn("mt-2 inline-block rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium", TOM_STATUS[ponto.status.tom])}>{ponto.status.rotulo}</span>}
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar informações" className="-mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[7px] border-0 bg-transparent text-ink-3 hover:bg-subtle hover:text-ink">
          <IconeFechar />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="m-0 px-4 pb-3 text-[13.5px] leading-[1.55] text-ink-2">{ponto.resumo}</p>

        <Bloco titulo="Localização">
          <dl className="m-0 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Área</dt>
            <dd className="m-0 text-ink">{zona?.nome ?? "Entorno da arena"}</dd>
            {ref && (
              <>
                <dt className="text-muted">Referência</dt>
                <dd className="m-0 text-ink">{ref}</dd>
              </>
            )}
            <dt className="text-muted">Camada</dt>
            <dd className="m-0 text-ink">{cat.rotulo}</dd>
          </dl>
        </Bloco>

        <Bloco titulo="Itens da ata">
          {ponto.itensAta.length === 0 ? (
            <p className="m-0 text-[12.5px] text-muted">Nenhuma linha da ata corresponde a este ponto.</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <caption className="sr-only">Itens da ata de reunião de OS</caption>
              <tbody>
                {ponto.itensAta.map((i, k) => (
                  <tr key={k} className="align-top">
                    <th scope="row" className="border-b border-line-row py-1.5 pr-2 text-left font-normal text-ink">
                      {i.item}
                      {(i.detalhe || i.obs) && <span className="block text-[11.5px] text-muted">{[i.detalhe, i.obs].filter(Boolean).join(" · ")}</span>}
                    </th>
                    <td className="w-14 border-b border-line-row py-1.5 text-right font-mono tabular-nums text-ink">{i.quantidade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloco>

        <Bloco titulo="Responsável">
          <p className="m-0 text-[13px] text-ink">{ponto.responsavel ?? <span className="text-muted">Não informado na planta nem na ata</span>}</p>
        </Bloco>

        {ponto.observacoes.length > 0 && (
          <Bloco titulo="Observações">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {ponto.observacoes.map((o, k) => (
                <li key={k} className="relative pl-3 text-[12.5px] leading-[1.5] text-ink-2 before:absolute before:left-0 before:top-[0.6em] before:size-1 before:rounded-full before:bg-line-strong">
                  {o}
                </li>
              ))}
            </ul>
          </Bloco>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-line-soft bg-subtle px-4 py-2.5">
        <button type="button" onClick={onAproximar} className="h-8 cursor-pointer rounded-[7px] border-0 bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-hover">
          Aproximar
        </button>
        <button type="button" onClick={onFechar} className="h-8 cursor-pointer rounded-[7px] border border-line-strong bg-surface px-3 text-[12.5px] text-ink-2 hover:bg-subtle">
          Fechar
        </button>
        <span className="ml-auto text-[11px] text-meta">A câmera fica onde está</span>
      </footer>
    </aside>
  );
}

/** Tudo que as fontes citam e o mapa não posiciona: nada fica escondido do usuário. */
export function PainelSemPosicao({ arena, estreito, onFechar }: { arena: Arena; estreito: boolean; onFechar: () => void }) {
  const fora = itensNaoPosicionados(arena);
  return (
    <aside
      aria-label="Itens sem posição no mapa"
      className={cn(
        "pointer-events-auto absolute z-20 flex flex-col overflow-hidden border border-line bg-surface shadow-[0_12px_32px_rgba(42,20,24,.14)] animate-fade-up-rapido",
        estreito ? "inset-x-0 bottom-0 max-h-[62%] rounded-t-[14px]" : "bottom-3 right-3 top-[60px] w-[360px] rounded-[12px]",
      )}
    >
      <header className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[16px] font-semibold text-ink">Sem posição no mapa</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-muted">Itens citados na ata ou na legenda da planta que não têm lugar desenhado.</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[7px] border-0 bg-transparent text-ink-3 hover:bg-subtle">
          <IconeFechar />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {arena.semPosicaoNaPlanta.length > 0 && (
          <Bloco titulo="Legenda da planta">
            {arena.semPosicaoNaPlanta.map((s) => (
              <p key={s.item} className="m-0 mb-1.5 text-[12.5px] text-ink-2">
                <span className="font-medium text-ink">{s.item}.</span> {s.motivo}
              </p>
            ))}
            {arena.contagensDaPlanta.map((c) => (
              <p key={c.item} className="m-0 flex justify-between border-b border-line-row py-1 text-[12.5px]">
                <span>{c.item}</span>
                <span className="font-mono tabular-nums">{c.quantidade}</span>
              </p>
            ))}
          </Bloco>
        )}
        <Bloco titulo={`Ata — ${fora.length} linhas sem ponto`}>
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">Linhas da ata sem ponto no mapa</caption>
            <tbody>
              {fora.map((i, k) => (
                <tr key={k}>
                  <th scope="row" className="border-b border-line-row py-1.5 pr-2 text-left font-normal text-ink">
                    {i.item}
                    <span className="block text-[11px] text-muted">{i.secao}</span>
                  </th>
                  <td className="w-16 border-b border-line-row py-1.5 text-right font-mono tabular-nums">{i.quantidade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bloco>
      </div>
    </aside>
  );
}
