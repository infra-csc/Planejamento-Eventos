"use client";

import type { Dispatch, SetStateAction } from "react";
import type { PontoArena } from "@/domain/arena/tipos";
import { CAMADAS, CATEGORIAS, GRUPOS_CAMADAS, camadasEssenciais, camadasTudo, type Camada } from "@/domain/arena/categorias";
import { cn } from "@/lib/cn";
import type { Qualidade } from "./cena/materiais";
import { ChipMono } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Kbd, RotuloGrupo } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { BotaoMapa, cartao } from "./arena-botao-mapa";
import { IconeBusca, IconeCamadas, IconeLista, IconeSairTelaCheia, IconeTelaCheia } from "./icones";

export type VistaMapa = "perspectiva" | "superior" | "planta";

/** Uma pergunta ("como quero ver isto?"), três respostas com o nome do que a pessoa vê. */
const VISTAS: Array<[VistaMapa, string, string]> = [
  ["perspectiva", "Perspectiva", "Volume das estruturas em 3D"],
  ["superior", "De cima", "3D visto de cima, com sombras e volumes"],
  ["planta", "Planta", "Desenho vetorial, sem 3D — mais leve e imprimível"],
];

/** Barra superior: busca e índice à esquerda; vista, camadas e tela cheia à direita. A busca encolhe em vez de estourar. */
export function BarraFerramentasMapa({
  buscaRef,
  termo,
  setTermo,
  buscaAberta,
  setBuscaAberta,
  indiceBusca,
  setIndiceBusca,
  resultados,
  escolherResultado,
  indiceAberto,
  alternarIndice,
  vistaMapa,
  escolherVista,
  painelCamadas,
  setPainelCamadas,
  camadas,
  setCamadas,
  modo,
  pontosPorCamada,
  plantaImagemUrl,
  plantaFundo,
  setPlantaFundo,
  qualidade,
  trocarQualidade,
  telaCheia,
  alternarTelaCheia,
}: {
  buscaRef: React.RefObject<HTMLInputElement | null>;
  termo: string;
  setTermo: (termo: string) => void;
  buscaAberta: boolean;
  setBuscaAberta: (aberta: boolean) => void;
  indiceBusca: number;
  setIndiceBusca: Dispatch<SetStateAction<number>>;
  resultados: PontoArena[];
  escolherResultado: (id: string) => void;
  indiceAberto: boolean;
  alternarIndice: () => void;
  vistaMapa: VistaMapa;
  escolherVista: (v: VistaMapa) => void;
  painelCamadas: boolean;
  setPainelCamadas: Dispatch<SetStateAction<boolean>>;
  camadas: Record<Camada, boolean>;
  setCamadas: Dispatch<SetStateAction<Record<Camada, boolean>>>;
  modo: "2d" | "3d";
  pontosPorCamada: Partial<Record<Camada, number>>;
  plantaImagemUrl: string | null;
  plantaFundo: boolean;
  setPlantaFundo: (ativo: boolean) => void;
  qualidade: Qualidade | null;
  trocarQualidade: (q: Qualidade) => void;
  telaCheia: boolean;
  alternarTelaCheia: () => void;
}) {
  const opcaoAtiva = buscaAberta ? resultados[indiceBusca] : undefined;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div className="pointer-events-auto relative min-w-0 max-w-[320px] flex-[1_1_200px]">
          <label htmlFor="arena-busca" className="sr-only">
            Encontrar ponto na arena
          </label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <IconeBusca />
          </span>
          <Input
            ref={buscaRef}
            id="arena-busca"
            type="search"
            value={termo}
            autoComplete="off"
            placeholder="Encontrar: largada, GV, Livelo, nº 12…"
            aria-keyshortcuts="/"
            onChange={(e) => {
              setTermo(e.target.value);
              setBuscaAberta(true);
              setIndiceBusca(0);
            }}
            onFocus={() => setBuscaAberta(true)}
            onBlur={() => setBuscaAberta(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndiceBusca((i) => Math.min(i + 1, resultados.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndiceBusca((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && resultados[indiceBusca]) {
                e.preventDefault();
                escolherResultado(resultados[indiceBusca].id);
                buscaRef.current?.blur();
              }
            }}
            role="combobox"
            aria-expanded={buscaAberta}
            aria-controls="arena-busca-lista"
            aria-autocomplete="list"
            aria-activedescendant={opcaoAtiva ? `arena-opcao-${opcaoAtiva.id}` : undefined}
            className="pl-9 pr-10 shadow-pill"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </span>
          {buscaAberta && (
            <ul id="arena-busca-lista" role="listbox" aria-label="Pontos encontrados" className="absolute left-0 right-0 top-10 m-0 max-h-[320px] list-none overflow-y-auto rounded-cartao border border-line bg-surface p-1 shadow-popover">
              {resultados.length === 0 ? (
                <li className="px-3 py-2.5 text-pequeno text-muted">Nada encontrado para “{termo}”.</li>
              ) : (
                resultados.map((p, i) => (
                  <li
                    key={p.id}
                    id={`arena-opcao-${p.id}`}
                    role="option"
                    aria-selected={i === indiceBusca}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolherResultado(p.id)}
                    onMouseEnter={() => setIndiceBusca(i)}
                    className={cn("flex cursor-pointer items-center gap-2.5 rounded-controle px-2.5 py-2", i === indiceBusca && "bg-accent-bg")}
                  >
                    <span aria-hidden className="block size-2.5 shrink-0 rounded-full" style={{ background: CATEGORIAS[p.categoria].cor }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-corpo text-ink">{p.nome}</span>
                      <span className="block text-rotulo text-muted">{p.tipo}</span>
                    </span>
                    {p.legenda && <span className="font-mono text-rotulo text-meta">{p.legenda.split(" ")[0]}</span>}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <div className={cn("pointer-events-auto shrink-0 overflow-hidden", cartao)}>
          <BotaoMapa rotulo="Índice de pontos" atalho="P" ativo={indiceAberto} onClick={alternarIndice} tamanho="campo">
            <IconeLista />
          </BotaoMapa>
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        <Pills rotulo="Vista do mapa" className="pointer-events-auto shrink-0 shadow-pill" itens={VISTAS.map(([v, rotulo]) => ({ label: rotulo, ativo: vistaMapa === v, onSelect: () => escolherVista(v) }))} />
        <div className="pointer-events-auto relative">
          <div className={cn("overflow-hidden", cartao)}>
            <BotaoMapa rotulo="Camadas" ativo={painelCamadas} onClick={() => setPainelCamadas((v) => !v)} tamanho="campo">
              <IconeCamadas />
            </BotaoMapa>
          </div>
          {painelCamadas && (
            <PainelCamadas
              camadas={camadas}
              setCamadas={setCamadas}
              modo={modo}
              pontosPorCamada={pontosPorCamada}
              plantaImagemUrl={plantaImagemUrl}
              plantaFundo={plantaFundo}
              setPlantaFundo={setPlantaFundo}
              qualidade={qualidade}
              trocarQualidade={trocarQualidade}
            />
          )}
        </div>
        <div className={cn("pointer-events-auto overflow-hidden", cartao)}>
          <BotaoMapa rotulo={telaCheia ? "Sair da tela cheia" : "Tela cheia"} atalho="F" onClick={alternarTelaCheia} tamanho="campo">
            {telaCheia ? <IconeSairTelaCheia /> : <IconeTelaCheia />}
          </BotaoMapa>
        </div>
      </div>
    </div>
  );
}

/** Painel "O que aparece no mapa": camadas, planta de fundo e qualidade do 3D. */
function PainelCamadas({
  camadas,
  setCamadas,
  modo,
  pontosPorCamada,
  plantaImagemUrl,
  plantaFundo,
  setPlantaFundo,
  qualidade,
  trocarQualidade,
}: {
  camadas: Record<Camada, boolean>;
  setCamadas: Dispatch<SetStateAction<Record<Camada, boolean>>>;
  modo: "2d" | "3d";
  pontosPorCamada: Partial<Record<Camada, number>>;
  plantaImagemUrl: string | null;
  plantaFundo: boolean;
  setPlantaFundo: (ativo: boolean) => void;
  qualidade: Qualidade | null;
  trocarQualidade: (q: Qualidade) => void;
}) {
  return (
    <div className="absolute right-0 top-11 z-40 w-[292px] rounded-cartao border border-line bg-surface shadow-popover animate-fade-up-rapido">
      <div className="flex items-center gap-1.5 border-b border-line-soft px-2.5 py-[9px]">
        <span className="flex-1 [&>div]:mb-0">
          <RotuloGrupo>O que aparece no mapa</RotuloGrupo>
        </span>
        <Button size="xs" className="shrink-0" onClick={() => setCamadas(camadasTudo())}>
          Tudo
        </Button>
        <Button size="xs" className="shrink-0" onClick={() => setCamadas(camadasEssenciais())} title="Padrões sem o público: para conferir implantação">
          Essencial
        </Button>
      </div>
      <div className="p-1">
        {GRUPOS_CAMADAS.map((g, i) => (
          <fieldset key={g.titulo} className={cn("m-0 border-0 p-0", i > 0 && "mt-0.5 border-t border-line-faint pt-0.5")}>
            <legend className="px-2 pb-[3px] pt-1.5 text-rotulo font-medium text-ink-2">{g.titulo}</legend>
            {g.camadas
              .filter((id) => modo === "3d" || (id !== "publico" && id !== "fluxo"))
              .map((id) => {
                const c = CAMADAS.find((x) => x.id === id);
                if (!c) return null;
                const n = pontosPorCamada[id];
                return (
                  <label key={id} htmlFor={`camada-${id}`} className="flex cursor-pointer items-start gap-2.5 rounded-controle px-2 py-[5px] hover:bg-subtle">
                    <input id={`camada-${id}`} type="checkbox" checked={camadas[id]} onChange={(e) => setCamadas((v) => ({ ...v, [id]: e.target.checked }))} className="mt-0.5 size-4 accent-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-corpo text-ink">{c.rotulo}</span>
                      <span className="block text-rotulo leading-[1.4] text-muted">{c.descricao}</span>
                    </span>
                    {n ? (
                      <span className="shrink-0" aria-label={`${n} pontos`}>
                        <ChipMono tom="control">{n}</ChipMono>
                      </span>
                    ) : null}
                  </label>
                );
              })}
          </fieldset>
        ))}
        {plantaImagemUrl && (
          <fieldset className="m-0 mt-0.5 border-0 border-t border-line-faint p-0 pt-0.5">
            <legend className="px-2 pb-[3px] pt-1.5 text-rotulo font-medium text-ink-2">Referência</legend>
            <label htmlFor="camada-planta-fundo" className="flex cursor-pointer items-start gap-2.5 rounded-controle px-2 py-[5px] hover:bg-subtle">
              <input id="camada-planta-fundo" type="checkbox" checked={plantaFundo} onChange={(e) => setPlantaFundo(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-corpo text-ink">Planta de fundo</span>
                <span className="block text-rotulo leading-[1.4] text-muted">Imagem da planta do evento sob o mapa</span>
              </span>
            </label>
          </fieldset>
        )}
      </div>
      {modo === "3d" && (
        <div className="border-t border-line-soft px-3 pb-2.5 pt-2.5">
          <span className="block [&>div]:mb-1.5">
            <RotuloGrupo>Qualidade</RotuloGrupo>
          </span>
          <Pills rotulo="Qualidade do 3D" itens={(["alta", "leve"] as const).map((q) => ({ label: q === "alta" ? "Alta" : "Leve", ativo: qualidade === q, onSelect: () => trocarQualidade(q) }))} />
          <p className="m-0 mt-1.5 text-rotulo text-meta">{qualidade ? "Escolhida por você." : "Automática pelo aparelho."} Leve desliga sombras e reduz árvores e público.</p>
        </div>
      )}
    </div>
  );
}
