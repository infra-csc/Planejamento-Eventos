"use client";

import type { PontoArena, Vec2 } from "@/domain/arena/tipos";
import { CATEGORIAS } from "@/domain/arena/categorias";
import { descreverGiro, distancia, distanciaPrecisa } from "@/domain/arena/posicoes";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/field";
import { IconeLapis } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/layout";
import { IconeImprimir, IconeRegua } from "./icones";
import { PASSO_GIRO, type EdicaoArena, type FormEdicao } from "./use-edicao-arena";

/**
 * O que a logística mais acrescenta no mapa: obstáculos do terreno e apoios simples.
 * Um clique escolhe o item, o próximo clique põe no lugar — sem formulário antes.
 */
const ATALHOS_ITEM: Array<{ nome: string; categoria: string }> = [
  { nome: "Árvore", categoria: "obstaculo" },
  { nome: "Bueiro", categoria: "obstaculo" },
  { nome: "Poste", categoria: "obstaculo" },
  { nome: "Desnível / rampa", categoria: "obstaculo" },
  { nome: "Grade / barreira", categoria: "operacao" },
  { nome: "Tenda extra", categoria: "operacao" },
  { nome: "Banheiro químico", categoria: "operacao" },
  { nome: "Ponto de energia", categoria: "operacao" },
];

/**
 * Barra de edição com ALTURA FIXA: nada nela aparece ou some empurrando o mapa (antes, selecionar
 * um ponto criava uma linha nova e o mapa pulava 44 px — o ponto parecia cair fora do clique).
 * O menu de itens e o formulário flutuam por cima, sem mexer no layout.
 */
export function BarraEdicao({
  slug,
  podeEditar,
  edicao,
  setSelecionado,
  medindo,
  medida,
  pontaMedida,
  distanciaMedida,
  alternarMedicao,
  semPosicaoAberta,
  foraDoMapa,
  abrirSemPosicao,
  setFontesAbertas,
}: {
  slug: string;
  podeEditar: boolean;
  edicao: EdicaoArena;
  setSelecionado: (id: string | null) => void;
  medindo: boolean;
  medida: { a: Vec2 | null; b: Vec2 | null };
  pontaMedida: Vec2 | null;
  distanciaMedida: number | null;
  alternarMedicao: () => void;
  semPosicaoAberta: boolean;
  foraDoMapa: number;
  abrirSemPosicao: () => void;
  setFontesAbertas: (aberto: boolean) => void;
}) {
  const { editando, alternarEdicao, menuItens, setMenuItens, colocando, setColocando, pilha, salvando, desfazer, pontoSelecionadoEdicao, idsEditados, setConfirmarRestaurar, formEdicao, setFormEdicao, confirmarFormEdicao } = edicao;
  return (
    <div className="relative mb-3 flex h-12 items-center gap-2 rounded-cartao border border-line bg-surface px-3">
      {podeEditar && (
        <Button variant={editando ? "primary" : "secondary"} size="sm" aria-pressed={editando} onClick={alternarEdicao}>
          <IconeLapis size={12} />
          {editando ? "Concluir edição" : "Editar mapa"}
        </Button>
      )}
      {editando && (
        <>
          <Button variant="secondary" size="sm" aria-expanded={menuItens} disabled={Boolean(colocando) || medindo} onClick={() => setMenuItens((v) => !v)}>
            + Adicionar ao mapa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pilha.length === 0 || salvando || Boolean(colocando)}
            title={pilha.length ? `Desfazer: ${pilha[pilha.length - 1].rotulo} (Ctrl+Z)` : "Nada para desfazer nesta sessão"}
            aria-keyshortcuts="Control+Z"
            onClick={desfazer}
            className="tabular-nums"
          >
            Desfazer{pilha.length > 0 && ` (${pilha.length})`}
          </Button>
          <span aria-hidden className="mx-1 h-6 w-px bg-line" />
        </>
      )}

      {/* Área de contexto: uma frase só, trocada conforme o momento. */}
      <div role="status" className="flex min-w-0 flex-1 items-center gap-2 text-pequeno text-ink-3">
        {medindo ? (
          <>
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
              <IconeRegua className="size-3" />
            </span>
            <span className="min-w-0 truncate">
              {distanciaMedida != null ? (
                <>
                  Distância: <span className="font-medium tabular-nums text-ink">{distanciaPrecisa(distanciaMedida)}</span> · clique de novo para outra medida
                </>
              ) : medida.a ? (
                <>
                  Clique no segundo ponto{pontaMedida && <span className="tabular-nums"> · {distanciaPrecisa(distancia(medida.a, pontaMedida))}</span>}
                </>
              ) : (
                "Régua: clique no primeiro ponto, no chão ou num pino"
              )}
            </span>
            <Kbd>Esc</Kbd>
          </>
        ) : colocando ? (
          <>
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-micro font-semibold text-white">2</span>
            <span className="min-w-0 truncate">
              Clique no mapa onde fica <span className="font-medium text-ink">{colocando.nome}</span>
            </span>
            <Button size="xs" className="shrink-0" onClick={() => setColocando(null)}>
              Cancelar <Kbd>Esc</Kbd>
            </Button>
          </>
        ) : editando && pontoSelecionadoEdicao ? (
          <>
            <span className="min-w-0 truncate">
              <span className="font-medium text-ink">{pontoSelecionadoEdicao.nome}</span> · arraste para mover
              {descreverGiro(pontoSelecionadoEdicao.rotacao) && <span className="tabular-nums"> · girado {descreverGiro(pontoSelecionadoEdicao.rotacao)}</span>}
            </span>
          </>
        ) : editando ? (
          <span className="min-w-0 truncate">{salvando ? "Salvando…" : "Arraste um ponto para mover, ou use “Adicionar ao mapa”."}</span>
        ) : (
          <span className="min-w-0 truncate">{idsEditados.size > 0 ? `${idsEditados.size} ${idsEditados.size === 1 ? "ponto ajustado" : "pontos ajustados"} em relação à planta original.` : "Planta original do evento."}</span>
        )}
      </div>

      <Button size="sm" variant="ghost" aria-pressed={medindo} aria-keyshortcuts="M" title={medindo ? "Parar de medir (Esc)" : "Medir a distância entre dois pontos (M)"} onClick={alternarMedicao} className="shrink-0 aria-pressed:bg-accent-bg aria-pressed:text-accent">
        <IconeRegua />
        {medindo ? "Parar" : "Medir"}
      </Button>
      <Button size="sm" variant="ghost" className="shrink-0 tabular-nums" aria-pressed={semPosicaoAberta} onClick={abrirSemPosicao}>
        {foraDoMapa} sem posição
      </Button>
      {/* Ações de vez em quando ficam num menu: a barra mostra só o que se usa editando. */}
      <Dropdown>
        <DropdownTrigger asChild>
          <Button size="sm" variant="ghost" className="shrink-0" aria-label="Mais ações do mapa" title="Imprimir, fontes dos dados e restaurar">
            <span aria-hidden className="text-destaque leading-none">⋯</span>
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => window.open(`/impressao/arena/${slug}`, "_blank", "noopener,noreferrer")}>
            <IconeImprimir />
            Imprimir mapa (PDF)
          </DropdownItem>
          <DropdownItem onSelect={() => setFontesAbertas(true)}>De onde vêm os dados</DropdownItem>
          {podeEditar && (
            <>
              <DropdownSeparator />
              <DropdownItem danger disabled={salvando || idsEditados.size === 0} onSelect={() => setConfirmarRestaurar(true)}>
                {idsEditados.size === 0 ? "Já está igual à planta original" : "Restaurar planta original…"}
              </DropdownItem>
            </>
          )}
        </DropdownContent>
      </Dropdown>

      {/* Passo 1: escolher o que pôr no mapa. Flutua sob a barra. */}
      {editando && menuItens && !colocando && !medindo && (
        <div role="dialog" aria-label="Adicionar ao mapa" className="absolute left-3 top-[calc(100%+6px)] z-30 w-[min(560px,calc(100%-24px))] rounded-cartao border border-line bg-surface p-3 shadow-popover animate-fade-up-rapido">
          <p className="m-0 flex items-center gap-2 text-pequeno font-medium text-ink">
            <span className="grid size-5 place-items-center rounded-full bg-accent text-micro font-semibold text-white">1</span>
            O que você quer pôr no mapa?
          </p>
          <p className="mb-2.5 ml-7 mt-0.5 text-rotulo text-muted">Escolha e depois clique no lugar. Dá para arrastar para acertar.</p>
          <div className="ml-7 flex flex-wrap gap-1.5">
            {ATALHOS_ITEM.map((a) => (
              <Button
                key={a.nome}
                size="sm"
                onClick={() => {
                  setMenuItens(false);
                  setFormEdicao(null);
                  setSelecionado(null);
                  setColocando({ chave: `novo:livre:${Date.now().toString(36)}`, nome: a.nome, itemAta: null, categoria: a.categoria });
                }}
              >
                {a.nome}
              </Button>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMenuItens(false);
                setFormEdicao({ modo: "novo", nome: "", categoria: "obstaculo" });
              }}
            >
              Outro, com nome…
            </Button>
          </div>
          <p className="mb-0 ml-7 mt-2.5 text-rotulo text-muted">
            Item da ata que ainda não tem lugar?{" "}
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-rotulo text-accent underline"
              onClick={() => {
                setMenuItens(false);
                abrirSemPosicao();
              }}
            >
              Veja os {foraDoMapa} sem posição
            </button>
          </p>
        </div>
      )}

      {/* Nome próprio para um item novo, ou renomear um ponto. Flutua sob a barra. */}
      {editando && formEdicao && (
        <form
          className="absolute left-3 top-[calc(100%+6px)] z-30 flex w-[min(640px,calc(100%-24px))] flex-wrap items-center gap-2 rounded-cartao border border-line bg-surface p-3 shadow-popover animate-fade-up-rapido"
          onSubmit={(e) => {
            e.preventDefault();
            confirmarFormEdicao();
          }}
        >
          <span className="min-w-[220px] flex-1">
            <Input autoFocus aria-label="Nome do item" value={formEdicao.nome} onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })} placeholder="Ex.: Árvore baixa em cima do acesso" className="w-full" />
          </span>
          <span className="w-[200px]">
            <label htmlFor="edicao-categoria" className="sr-only">
              Categoria
            </label>
            <Select id="edicao-categoria" value={formEdicao.categoria} onValueChange={(v) => setFormEdicao({ ...formEdicao, categoria: v })} ordenarAlfabetico={false} opcoes={Object.entries(CATEGORIAS).map(([id, c]) => ({ value: id, label: c.rotulo }))} />
          </span>
          <Button type="submit" variant="primary" size="sm">
            {formEdicao.modo === "novo" ? "Escolher lugar no mapa" : "Salvar"}
          </Button>
          <Button size="sm" onClick={() => setFormEdicao(null)}>
            Cancelar
          </Button>
        </form>
      )}
    </div>
  );
}

/** Ações do ponto escolhido (editando): flutuam no canto do mapa (a legenda some ao editar) em vez de espremer a barra. */
export function AcoesPontoEdicao({
  ponto,
  pontoEditado,
  girar,
  setFormEdicao,
  excluirDoMapa,
}: {
  ponto: PontoArena;
  pontoEditado: PontoArena | null | undefined;
  girar: (delta: number) => void;
  setFormEdicao: (form: FormEdicao | null) => void;
  excluirDoMapa: (p: PontoArena) => void;
}) {
  return (
    <div role="toolbar" aria-label={`Ações de ${ponto.nome}`} className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-24px)] items-center gap-1.5 overflow-x-auto rounded-cartao border border-line-strong bg-surface px-2 py-1.5 shadow-popover">
      <span className="max-w-[180px] shrink truncate px-1 text-pequeno font-medium text-ink">{ponto.nome}</span>
      <Button size="xs" className="shrink-0" aria-label="Girar 15° no sentido anti-horário" title="Girar 15° no sentido anti-horário (Q)" aria-keyshortcuts="Q" onClick={() => girar(PASSO_GIRO)}>
        ↺ 15°
      </Button>
      <Button size="xs" className="shrink-0" aria-label="Girar 15° no sentido horário" title="Girar 15° no sentido horário (E)" aria-keyshortcuts="E" onClick={() => girar(-PASSO_GIRO)}>
        ↻ 15°
      </Button>
      <Button size="xs" className="shrink-0" onClick={() => setFormEdicao({ modo: "info", nome: ponto.nome, categoria: ponto.categoria })}>
        Renomear
      </Button>
      {pontoEditado && (
        <Button size="xs" className="shrink-0" variant="recusar" onClick={() => excluirDoMapa(pontoEditado)}>
          {pontoEditado.id.startsWith("novo:livre:") ? "Excluir" : pontoEditado.id.startsWith("novo:") ? "Tirar do mapa" : "Voltar ao lugar original"}
        </Button>
      )}
    </div>
  );
}
