"use client";

import { useEffect, useRef } from "react";
import type { Arena, ItemAta, PontoArena } from "@/domain/arena/tipos";
import { CATEGORIAS } from "@/domain/arena/categorias";
import { itensNaoPosicionados } from "@/domain/arena/geometria";
import { quantidadeAta } from "@/domain/arena/posicoes";
import { cn } from "@/lib/cn";
import { Badge, type Tom } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { IconeFechar } from "@/components/ui/icons";

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

const TOM_STATUS: Record<"ok" | "atencao" | "neutro", Tom> = {
  ok: "success",
  atencao: "warning",
  neutro: "neutral",
};

const chaveAta = (i: ItemAta) => `${i.secao}|${i.item}`;

function gaveta(estreito: boolean) {
  return cn(
    "pointer-events-auto absolute z-20 flex flex-col overflow-hidden border border-line bg-surface shadow-popover animate-fade-up-rapido",
    estreito ? "inset-x-0 bottom-0 max-h-[62%] rounded-t-modal" : "bottom-3 right-3 top-[60px] w-[360px] rounded-modal",
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft px-4 py-3">
      <h3 className="m-0 mb-2 text-rotulo font-medium uppercase tracking-[0.08em] text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

function BotaoFechar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <IconButton label={rotulo} onClick={onClick} className="-mr-1">
      <IconeFechar />
    </IconButton>
  );
}

/**
 * Ficha do ponto. O rodapé responde "o que eu faço com isto?": aproximar, conferir com a ata (quando
 * as fontes divergem) e abrir a ata na linha correspondente. Fechar fica no X e no Esc.
 */
export function PainelPonto({
  arena,
  ponto,
  estreito,
  divergente,
  onFechar,
  onAproximar,
  onConferir,
  onAbrirAta,
}: {
  arena: Arena;
  ponto: PontoArena;
  estreito: boolean;
  divergente: boolean;
  onFechar: () => void;
  /** Ausente na planta 2D (a câmera é do 3D). */
  onAproximar?: () => void;
  onConferir: () => void;
  onAbrirAta: () => void;
}) {
  const cat = CATEGORIAS[ponto.categoria];
  const zona = arena.zonas.find((z) => z.id === ponto.zonaId);
  const ref = referencia(arena, ponto);
  const total = quantidadeAta(ponto);
  return (
    <aside aria-labelledby="ficha-titulo" className={gaveta(estreito)}>
      <header className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span aria-hidden className="mt-1 block size-3 shrink-0 rounded-full ring-4 ring-white" style={{ background: cat.cor, boxShadow: `0 0 0 1px ${cat.cor}33` }} />
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-x-2 text-pequeno text-muted">
            {ponto.legenda && <span className="font-mono text-ink-2">nº {ponto.legenda}</span>}
            <span>{ponto.tipo}</span>
          </p>
          <h2 id="ficha-titulo" className="m-0 mt-0.5 text-titulo font-semibold leading-[1.25] tracking-[-0.015em] text-ink">
            {ponto.nome}
          </h2>
          {ponto.status && (
            <Badge tom={TOM_STATUS[ponto.status.tom]} className="mt-2">
              {ponto.status.rotulo}
            </Badge>
          )}
        </div>
        <BotaoFechar rotulo="Fechar informações" onClick={onFechar} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="m-0 px-4 pb-3 text-corpo leading-[1.55] text-ink-2">{ponto.resumo}</p>

        <Bloco titulo="Localização">
          <dl className="m-0 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-corpo">
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
            <p className="m-0 text-pequeno text-muted">Nenhuma linha da ata corresponde a este ponto.</p>
          ) : (
            <table className="w-full border-collapse text-pequeno">
              <caption className="sr-only">Itens da ata de reunião de OS</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line-soft pb-1 text-left text-rotulo font-normal text-muted">
                    Item
                  </th>
                  <th scope="col" className="w-14 border-b border-line-soft pb-1 text-right text-rotulo font-normal text-muted">
                    Qtd.
                  </th>
                </tr>
              </thead>
              <tbody>
                {ponto.itensAta.map((i, k) => (
                  <tr key={k} className="align-top">
                    <th scope="row" className="border-b border-line-row py-1.5 pr-2 text-left font-normal text-ink">
                      {i.item}
                      {(i.detalhe || i.obs) && <span className="block text-rotulo text-muted">{[i.detalhe, i.obs].filter(Boolean).join(" · ")}</span>}
                    </th>
                    <td className="w-14 border-b border-line-row py-1.5 text-right font-mono tabular-nums text-ink">{i.quantidade != null ? i.quantidade.toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
              {/* Mais de uma linha com quantidade: o total é o "× N" que aparece junto ao rótulo no mapa. */}
              {total != null && ponto.itensAta.filter((i) => i.quantidade != null).length > 1 && (
                <tfoot>
                  <tr>
                    <th scope="row" className="pt-1.5 text-left font-medium text-ink-2">
                      Total
                    </th>
                    <td className="pt-1.5 text-right font-mono font-medium tabular-nums text-ink">{total.toLocaleString("pt-BR")}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </Bloco>

        <Bloco titulo="Responsável">
          <p className="m-0 text-corpo text-ink">{ponto.responsavel ?? <span className="text-muted">Não informado na planta nem na ata</span>}</p>
        </Bloco>

        {ponto.observacoes.length > 0 && (
          <Bloco titulo="Observações">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {ponto.observacoes.map((o, k) => (
                <li key={k} className="relative pl-3 text-pequeno leading-[1.5] text-ink-2 before:absolute before:left-0 before:top-[0.6em] before:size-1 before:rounded-full before:bg-line-strong">
                  {o}
                </li>
              ))}
            </ul>
          </Bloco>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line-soft bg-subtle px-4 py-2.5">
        {onAproximar && (
          <Button variant="primary" size="sm" onClick={onAproximar}>
            Aproximar
          </Button>
        )}
        {divergente && (
          <Button variant="parcial" size="sm" onClick={onConferir}>
            Conferir com a ata
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onAbrirAta}>
          Abrir a ata
        </Button>
      </footer>
    </aside>
  );
}

/** Ata completa da reunião de OS, com as linhas do ponto em destaque (e rolagem até a primeira). */
export function PainelAta({ arena, ponto, estreito, onFechar }: { arena: Arena; ponto: PontoArena | null; estreito: boolean; onFechar: () => void }) {
  const destaque = new Set(ponto?.itensAta.map(chaveAta) ?? []);
  const primeira = arena.ata.find((i) => destaque.has(chaveAta(i)));
  const rolagemRef = useRef<HTMLDivElement>(null);
  const primeiraRef = useRef<HTMLTableRowElement>(null);
  const secoes = [...new Set(arena.ata.map((i) => i.secao))];

  useEffect(() => {
    const caixa = rolagemRef.current;
    const linha = primeiraRef.current;
    // Medido pela tela: o offsetTop de uma linha é relativo à tabela, não à área que rola.
    if (caixa && linha) caixa.scrollTop = Math.max(0, linha.getBoundingClientRect().top - caixa.getBoundingClientRect().top + caixa.scrollTop - caixa.clientHeight / 3);
  }, [ponto?.id]);

  return (
    <aside aria-labelledby="ata-titulo" className={gaveta(estreito)}>
      <header className="flex items-start gap-3 border-b border-line-soft px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="ata-titulo" className="m-0 text-titulo font-semibold text-ink">
            Ata da reunião de OS
          </h2>
          <p className="m-0 mt-0.5 text-pequeno leading-[1.45] text-muted">
            {arena.fonte.rotuloAta} · {arena.ata.length} linhas{ponto ? ` · linhas de ${ponto.nome} em destaque` : ""}
          </p>
        </div>
        <BotaoFechar rotulo="Fechar ata" onClick={onFechar} />
      </header>
      <div ref={rolagemRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {ponto && destaque.size === 0 && <p className="m-0 border-b border-line-soft bg-subtle px-4 py-2.5 text-pequeno text-muted">Nenhuma linha da ata corresponde a {ponto.nome}.</p>}
        {secoes.map((secao) => (
          <section key={secao} className="px-4 pb-1 pt-3">
            <h3 className="m-0 mb-1 font-mono text-micro tracking-[0.06em] text-meta">{secao}</h3>
            <table className="w-full border-collapse text-pequeno">
              <caption className="sr-only">Seção {secao} da ata</caption>
              <tbody>
                {arena.ata
                  .filter((i) => i.secao === secao)
                  .map((i) => {
                    const marcado = destaque.has(chaveAta(i));
                    return (
                      <tr key={chaveAta(i)} ref={i === primeira ? primeiraRef : undefined} className={cn("align-top", marcado && "bg-selected shadow-[inset_3px_0_0_var(--color-accent)]")} aria-current={marcado ? "true" : undefined}>
                        <th scope="row" className={cn("border-b border-line-row py-1.5 pl-2 pr-2 text-left font-normal", marcado ? "font-medium text-ink" : "text-ink-2")}>
                          {i.item}
                          {(i.detalhe || i.obs) && <span className="block text-rotulo font-normal text-muted">{[i.detalhe, i.obs].filter(Boolean).join(" · ")}</span>}
                        </th>
                        <td className="w-16 border-b border-line-row py-1.5 pr-2 text-right font-mono tabular-nums text-ink">{i.quantidade ?? "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </aside>
  );
}

/** Tudo que as fontes citam e o mapa não posiciona: prova de que o mapa não escondeu nada. */
/** No modo edição, cada item sem lugar ganha "Posicionar": escolhe o item e clica no mapa. */
export type PosicionarItem = { chave: string; nome: string; itemAta: string | null; categoria?: string | null };

export function PainelSemPosicao({
  arena,
  estreito,
  onFechar,
  edicao,
}: {
  arena: Arena;
  estreito: boolean;
  onFechar: () => void;
  edicao?: { colocando: string | null; onPosicionar: (item: PosicionarItem) => void } | null;
}) {
  const botaoPosicionar = (item: PosicionarItem) =>
    edicao ? (
      <Button
        size="xs"
        variant="secondary"
        onClick={() => edicao.onPosicionar(item)}
        aria-pressed={edicao.colocando === item.chave}
        className="shrink-0 hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
      >
        {edicao.colocando === item.chave ? "Clique no mapa" : "Posicionar"}
      </Button>
    ) : null;
  const fora = itensNaoPosicionados(arena);
  const porSecao = new Map<string, ItemAta[]>();
  for (const i of fora) porSecao.set(i.secao, [...(porSecao.get(i.secao) ?? []), i]);
  return (
    <aside aria-labelledby="sem-posicao-titulo" className={gaveta(estreito)}>
      <header className="flex items-start gap-3 border-b border-line-soft px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="sem-posicao-titulo" className="m-0 text-titulo font-semibold text-ink">
            Sem posição no mapa
          </h2>
          <p className="m-0 mt-[3px] text-pequeno leading-[1.45] text-muted">Citado na ata ou na legenda da planta, sem lugar desenhado. Nada some do sistema por não ter coordenada.</p>
        </div>
        <BotaoFechar rotulo="Fechar" onClick={onFechar} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {(arena.semPosicaoNaPlanta.length > 0 || arena.contagensDaPlanta.length > 0) && (
          <section className="border-b border-line-soft px-4 py-3">
            <h3 className="m-0 mb-2 text-rotulo font-medium uppercase tracking-[0.08em] text-muted">Na legenda da planta</h3>
            {arena.semPosicaoNaPlanta.map((s) => (
              <div key={s.item} className="mb-2 flex items-start gap-2">
                <p className="m-0 min-w-0 flex-1 text-pequeno leading-[1.5] text-ink-2">
                  <span className="font-medium text-ink">{s.item}.</span> {s.motivo}
                </p>
                {botaoPosicionar({ chave: `novo:planta:${s.item}`, nome: s.item, itemAta: null })}
              </div>
            ))}
            {arena.contagensDaPlanta.map((c) => (
              <p key={c.item} className="m-0 flex justify-between gap-3 border-b border-line-row py-[5px] text-pequeno text-ink-2">
                <span>{c.item}</span>
                <span className="font-mono tabular-nums text-ink">{c.quantidade}</span>
              </p>
            ))}
          </section>
        )}
        <section className="px-4 py-3">
          <h3 className="m-0 mb-1 text-rotulo font-medium uppercase tracking-[0.08em] text-muted">Linhas da ata sem ponto</h3>
          <p className="m-0 mb-2.5 text-pequeno leading-[1.45] text-muted">
            {fora.length} de {arena.ata.length} linhas da ata não têm ponto correspondente. Material de consumo e itens distribuídos pelo percurso entram aqui.
          </p>
          {[...porSecao].map(([secao, itens]) => (
            <div key={secao} className="mb-2.5">
              <p className="m-0 mb-[3px] font-mono text-micro tracking-[0.06em] text-meta">{secao}</p>
              <table className="w-full border-collapse text-pequeno">
                <caption className="sr-only">Linhas da seção {secao} sem ponto no mapa</caption>
                <tbody>
                  {itens.map((i) => (
                    <tr key={chaveAta(i)}>
                      <th scope="row" className="border-b border-line-row py-[5px] pr-2 text-left font-normal text-ink">
                        {i.item}
                      </th>
                      <td className="w-[52px] border-b border-line-row py-[5px] text-right font-mono tabular-nums text-ink-2">{i.quantidade ?? "—"}</td>
                      {edicao && <td className="w-[104px] border-b border-line-row py-[3px] pl-2 text-right">{botaoPosicionar({ chave: `novo:ata:${chaveAta(i)}`, nome: i.item, itemAta: chaveAta(i) })}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}
