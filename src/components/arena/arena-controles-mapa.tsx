"use client";

import type { Arena, CategoriaPonto } from "@/domain/arena/tipos";
import { CATEGORIAS, COR_PERCURSO, type Camada } from "@/domain/arena/categorias";
import { cn } from "@/lib/cn";
import type { MotorArena } from "./cena/motor";
import { Button } from "@/components/ui/button";
import { Kbd, RotuloGrupo } from "@/components/ui/layout";
import { Minimapa } from "./minimapa";
import { BotaoMapa, cartao } from "./arena-botao-mapa";
import { IconeEnquadrar, IconeMais, IconeMenos, IconeNorte } from "./icones";

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

/** Aviso enquanto a cena 3D é montada. */
export function CarregandoArena({ arena }: { arena: Arena }) {
  return (
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
  );
}

/** Canto inferior direito: procedência e itens sem posição a um clique, câmera (4) e atalhos. */
export function ControlesCanto({
  arena,
  direitaAberta,
  estreito,
  mostrarPlano,
  fontesAbertas,
  ajudaAberta,
  setAjudaAberta,
  usar3D,
  pronto,
  motorRef,
}: {
  arena: Arena;
  direitaAberta: boolean;
  estreito: boolean;
  mostrarPlano: boolean;
  fontesAbertas: boolean;
  ajudaAberta: boolean;
  setAjudaAberta: (atualizar: (aberta: boolean) => boolean) => void;
  usar3D: boolean;
  pronto: boolean;
  motorRef: React.RefObject<MotorArena | null>;
}) {
  return (
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
      {usar3D && pronto && (
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
  );
}

/** Minimapa e legenda: recuam quando há painel à esquerda. Somem durante a edição (menos ruído). */
export function LegendaMapa({
  arena,
  camadas,
  selecionado,
  painelEsquerdoAberto,
  direitaAberta,
  estreito,
  largo,
  editando,
  mostrarMinimapa,
  pegadaRef,
  motorRef,
  legendaAberta,
  setLegendaAberta,
  conferenciaAtiva,
  categoriasPresentes,
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  painelEsquerdoAberto: boolean;
  direitaAberta: boolean;
  estreito: boolean;
  largo: boolean;
  editando: boolean;
  mostrarMinimapa: boolean;
  pegadaRef: React.RefObject<SVGPolygonElement | null>;
  motorRef: React.RefObject<MotorArena | null>;
  legendaAberta: boolean;
  setLegendaAberta: (atualizar: (aberta: boolean) => boolean) => void;
  conferenciaAtiva: boolean;
  categoriasPresentes: CategoriaPonto[];
}) {
  return (
    <div className={cn("pointer-events-none absolute bottom-3 z-10 flex items-end gap-2", painelEsquerdoAberto && !estreito ? "left-[376px]" : "left-3", ((estreito && (direitaAberta || painelEsquerdoAberto)) || editando) && "hidden")}>
      {mostrarMinimapa && <Minimapa arena={arena} camadas={camadas} selecionado={selecionado} pegadaRef={pegadaRef} onIr={(x, z) => motorRef.current?.irPara(x, z)} />}
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
              <span aria-hidden className="flex h-2.5 w-5 overflow-hidden rounded-xs">
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
  );
}

/** O 3D falhou: a planta 2D assume, com a opção de tentar de novo. */
export function AvisoErro3D({ erro, onTentarDeNovo }: { erro: string | null; onTentarDeNovo: () => void }) {
  return (
    <div role="alert" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-cartao border border-danger-border bg-surface px-3.5 py-2.5 shadow-popover">
      <span className="text-pequeno text-ink-2">
        <span className="font-medium text-danger">3D indisponível.</span> {erro} Mostrando a planta 2D.
      </span>
      <Button size="sm" className="shrink-0" onClick={onTentarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  );
}

/** O motor mediu quadros lentos: oferece o modo leve. */
export function AvisoLento({ onUsarLeve, onManter }: { onUsarLeve: () => void; onManter: () => void }) {
  return (
    <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-cartao border border-warning-border bg-surface px-3.5 py-2.5 shadow-popover">
      <span className="text-pequeno text-ink-2">O 3D está pesado neste computador.</span>
      <Button variant="primary" size="sm" onClick={onUsarLeve}>
        Usar modo leve
      </Button>
      <Button variant="ghost" size="sm" onClick={onManter}>
        Manter
      </Button>
    </div>
  );
}
