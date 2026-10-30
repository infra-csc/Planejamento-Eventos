"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { CATEGORIAS_ESTOQUE } from "@/domain/estoque";
import Link from "next/link";
import { ajustarQuantidadeEstoqueAction, salvarItemEstoqueAction } from "@/app/(app)/ativacao/actions";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ComboBox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Icone } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Numero } from "@/components/ui/numero";
import { EmptyState } from "@/components/ui/layout";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { CaptionOculta } from "@/components/ui/tabela";
import { BotaoPedidosItem } from "./pedidos-item";
import { aoPedirNovoItem } from "./novo-item-estoque";

export type ItemEstoqueTela = {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  comprar: number | null;
  observacao: string | null;
  pecaId: string | null;
  pecaCodigo: string | null;
  pecaNome: string | null;
  ativo: boolean;
  atualizadoEm: string;
  /** Saiu com a OS de um evento (montagem já passou) e ainda não voltou. */
  emEvento: number;
  /** Vai sair com a OS de um evento que ainda não montou. */
  reservado: number;
  emReforma: number;
  capaId: string | null;
  /** Eventos que levam o item e ainda não devolveram: pedido (ata aberta), na OS (vai sair) ou fora (saiu, falta o retorno). */
  eventos: Array<{ eventoId: string; codigo: string; nome: string; quantidade: number; situacao: "pedido" | "na OS" | "fora" }>;
};

type Filtro = "todos" | "sem" | "comprar" | "ligados" | "evento" | "reforma" | "inativos";

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * Estoque da Ativação: busca, categoria e filtros rápidos (sem estoque, a comprar, ligados ao catálogo);
 * a quantidade muda direto na linha (salva sozinha); o resto num diálogo (nome, categoria, comprar,
 * observação e a peça do catálogo que faz a solicitação mostrar "quanto ainda tem").
 */
export function EstoqueTela({ itens, catalogo }: { itens: ItemEstoqueTela[]; catalogo: Array<{ id: string; codigo: string; nome: string }> }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>("Todas");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [editando, setEditando] = useState<ItemEstoqueTela | "novo" | null>(null);
  const abas = useRef<HTMLDivElement>(null);
  // "Novo item" mora no cabeçalho da página (layout das abas), como nas outras listas (auditoria 28/10, nº 54).
  useEffect(() => aoPedirNovoItem(() => setEditando("novo")), []);

  const categorias = useMemo(() => [...new Set([...CATEGORIAS_ESTOQUE, ...itens.map((i) => i.categoria)])], [itens]);
  const ativos = itens.filter((i) => i.ativo);
  const visiveis = useMemo(() => {
    const t = semAcento(busca.trim());
    return itens.filter((i) => {
      if (filtro === "inativos" ? i.ativo : !i.ativo) return false;
      if (categoria !== "Todas" && i.categoria !== categoria) return false;
      if (filtro === "sem" && i.quantidade > 0) return false;
      if (filtro === "comprar" && !i.comprar) return false;
      if (filtro === "ligados" && !i.pecaId) return false;
      if (filtro === "evento" && !i.eventos.length) return false;
      if (filtro === "reforma" && !i.emReforma) return false;
      return !t || semAcento(`${i.nome} ${i.observacao ?? ""} ${i.pecaCodigo ?? ""}`).includes(t);
    });
  }, [itens, busca, categoria, filtro]);

  const contar = (f: Filtro) => (f === "inativos" ? itens.filter((i) => !i.ativo).length : ativos.filter((i) => (f === "sem" ? i.quantidade === 0 : f === "comprar" ? Boolean(i.comprar) : f === "ligados" ? Boolean(i.pecaId) : f === "evento" ? i.eventos.length > 0 : f === "reforma" ? Boolean(i.emReforma) : true)).length);
  const FILTROS: Array<[Filtro, string]> = [
    ["todos", "Todos"],
    ["sem", "Sem estoque"],
    ["comprar", "A comprar"],
    ["ligados", "Vinculados ao catálogo"],
    ["evento", "Em eventos"],
    ["reforma", "Em reforma"],
    ["inativos", "Inativos"],
  ];
  // Celular: as abas com 0 somem (a ativa fica), em vez de 7 abas em 4 linhas empurrando a lista (nº 43).
  const visivelNoCelular = (f: Filtro) => f === "todos" || f === filtro || contar(f) > 0;
  // Setas, Home e End andam entre as abas; só a ativa fica no Tab (padrão de abas, auditoria 28/10, nº 66).
  const teclaAbas = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const botoes = [...(abas.current?.querySelectorAll<HTMLButtonElement>("[role=tab]") ?? [])].filter((b) => b.offsetParent !== null);
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (atual < 0) return;
    const proximo = e.key === "ArrowRight" ? atual + 1 : e.key === "ArrowLeft" ? atual - 1 : e.key === "Home" ? 0 : e.key === "End" ? botoes.length - 1 : null;
    if (proximo === null) return;
    e.preventDefault();
    const alvo = botoes[(proximo + botoes.length) % botoes.length];
    alvo.focus();
    alvo.click();
  };
  const inativos = filtro === "inativos";

  return (
    <>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-[300px]">
          <Icone nome="busca" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item ou observação" aria-label="Buscar item do estoque" className="pl-9" />
        </div>
        <div className="w-full sm:w-[180px]">
          <Select value={categoria} onValueChange={setCategoria} aria-label="Categoria" ordenarAlfabetico={false} opcoes={[{ value: "Todas", label: "Todas as categorias" }, ...categorias.map((c) => ({ value: c, label: c }))]} />
        </div>
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div ref={abas} role="tablist" aria-label="Filtro do estoque" onKeyDown={teclaAbas} className="flex flex-wrap gap-1 border-b border-line-soft px-2 pt-1">
          {FILTROS.map(([f, rotulo]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filtro === f}
              tabIndex={filtro === f ? 0 : -1}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn("-mb-px inline-flex cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-3 py-2.5 text-pequeno max-md:min-h-10", filtro === f ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink", !visivelNoCelular(f) && "max-sm:hidden")}
            >
              {rotulo}
              <span className="numero rounded-chip bg-control px-1.5 text-rotulo text-ink-3">{contar(f)}</span>
            </button>
          ))}
        </div>
        {visiveis.length === 0 ? (
          <EmptyState compact title={busca ? `Nada encontrado para “${busca}”` : "Nenhum item neste filtro"} description="Troque o filtro ou inclua um item novo." />
        ) : (
          <div className="overflow-x-auto">
            {/* Celular: item, quantidade e editar cabem em 375 px (sem data-responsiva a tabela ganhava 640 px e o
                stepper, que é a ação da tela, ficava fora da vista, só rolando a tabela de lado). */}
            <table data-responsiva className="w-full border-collapse max-sm:table-fixed max-sm:[overflow-wrap:anywhere] sm:min-w-[640px] xl:min-w-[820px]">
              {/* Legenda para o leitor de tela (auditoria 28/10, nº 140). */}
              <CaptionOculta>{`Estoque da Ativação: ${FILTROS.find(([f]) => f === filtro)?.[1] ?? "Todos"}`}</CaptionOculta>
              <thead>
                <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2.5 pl-cartao">Item</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Categoria</th>
                  <th className="px-3 py-2.5 text-center max-sm:w-[134px] max-sm:px-1" title="Em bom estado, no galpão ou em evento">Em posse</th>
                  <th className="hidden px-3 py-2.5 text-right xl:table-cell" title="Saiu com a OS e ainda não voltou (entre parênteses, reservado para eventos que ainda vão montar)">Em evento</th>
                  <th className="hidden px-3 py-2.5 text-right xl:table-cell">Em reforma</th>
                  <th className="hidden px-3 py-2.5 text-right sm:table-cell" title="Em posse menos o que está fora em evento">Disponível</th>
                  <th className="hidden px-3 py-2.5 text-right sm:table-cell">Comprar</th>
                  {/* relative: o rótulo sr-only (absoluto) fica preso à célula; sem isso escapava da rolagem da
                      tabela e alargava a página no celular (559 px numa tela de 375). */}
                  <th className="relative w-14 px-3 py-2.5 pr-cartao max-sm:w-12 max-sm:px-1">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* A chave leva a quantidade salva: depois de "Editar item" (ou de outro salvamento), a linha recomeça com o
                    número novo. Antes o stepper guardava o antigo e o próximo "+" gravava por cima (auditoria 30/10). */}
                {visiveis.map((i) => (
                  <LinhaEstoque key={`${i.id}:${i.quantidade}`} item={i} onEditar={() => setEditando(i)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Contagem viva: quem usa leitor de tela ouve quantos itens ficaram ao buscar ou trocar de aba (nº 137). Na aba
            Inativos, conta os inativos (antes dizia "1 de 245 itens ativos" mostrando um inativo; parte C N23). */}
        <p aria-live="polite" aria-atomic="true" className="m-0 border-t border-line-soft px-cartao py-2.5 text-rotulo text-muted">
          {inativos ? (
            <>
              <Numero valor={visiveis.length} /> de <Numero valor={contar("inativos")} /> {contar("inativos") === 1 ? "item inativo" : "itens inativos"}
            </>
          ) : (
            <>
          <Numero valor={visiveis.length} /> de <Numero valor={ativos.length} /> {ativos.length === 1 ? "item ativo" : "itens ativos"} · <Numero valor={ativos.reduce((t, i) => t + i.quantidade, 0)} /> unidades em posse
          {ativos.some((i) => i.emEvento) && (
            <>
              {" · "}
              <Numero valor={ativos.reduce((t, i) => t + i.emEvento, 0)} /> em evento
            </>
          )}
          {ativos.some((i) => i.emReforma) && (
            <>
              {" · "}
              <Numero valor={ativos.reduce((t, i) => t + i.emReforma, 0)} /> em reforma
            </>
          )}
            </>
          )}
        </p>
      </div>

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        {editando !== null && <FormItem key={editando === "novo" ? "novo" : editando.id} item={editando === "novo" ? null : editando} categorias={categorias} catalogo={catalogo} categoriaPadrao={categoria !== "Todas" ? categoria : "Ativação"} onFechar={() => setEditando(null)} />}
      </Dialog>
    </>
  );
}

/** Quantidade muda na própria linha: salva 0,7 s depois do último clique (vários "+" seguidos viram um salvamento). */
function LinhaEstoque({ item, onEditar }: { item: ItemEstoqueTela; onEditar: () => void }) {
  const router = useRouter();
  const [valor, setValor] = useState(item.quantidade);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<number | null>(null);
  // O último número que o servidor confirmou: vai junto como "esperado", e o servidor recusa se o estoque mudou nesse
  // meio-tempo (outra pessoa, outra aba, um retorno) em vez de gravar por cima (auditoria 28/10, nº 98).
  const base = useRef(item.quantidade);
  // Gravou: toast com "Desfazer" (com Ctrl+Z), porque o "+/−" grava sozinho e um toque perdido ao rolar no celular
  // mudava o estoque sem volta (auditoria 28/10, nº 42). Um toast por item: o seguinte substitui o anterior.
  const avisarGravado = (de: number, para: number) =>
    toastSucesso(`${item.nome}: ${de} → ${para}`, {
      grupo: `estoque-${item.id}`,
      desfazer: async () => {
        const r = await ajustarQuantidadeEstoqueAction(item.id, de, para);
        if (!r.ok) toastErro(r.erro);
        router.refresh();
      },
    });
  // Se a linha sai da tela (aba, busca, recarga da lista) com um "+" ainda esperando os 0,7 s, grava na hora.
  // Antes a limpeza só cancelava e o número se perdia sem aviso (auditoria 30/10, parte C N4).
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pendente.current === null) return;
    const de = base.current;
    const para = pendente.current;
    void ajustarQuantidadeEstoqueAction(item.id, para, de).then((r) => {
      if (r.ok) {
        if (de !== para) avisarGravado(de, para);
        router.refresh();
      } else toastErro(`${item.nome}: ${r.erro}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na saída da linha; avisarGravado depende das mesmas chaves
  }, [item.id, item.nome, router]);
  const mudar = (v: number) => {
    setValor(v);
    pendente.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      pendente.current = null;
      const de = base.current;
      setEstado("salvando");
      const r = await ajustarQuantidadeEstoqueAction(item.id, v, de);
      if (!r.ok) {
        toastErro(r.erro);
        setValor(base.current);
        setEstado("");
        // O número mudou fora daqui: a lista volta com o valor de agora.
        router.refresh();
        return;
      }
      base.current = v;
      setEstado("salvo");
      if (de !== v) avisarGravado(de, v);
      router.refresh();
    }, 700);
  };
  return (
    <tr className={cn("border-b border-line-row last:border-b-0", !item.ativo && "text-meta")}>
      <td className="px-3 py-2.5 pl-cartao align-middle">
        {/* Sem coluna de miniatura: quase nenhum item tem foto e a coluna era uma caixa cinza (ou um recuo) em toda
            linha. A foto, quando existe, vai pequena ao lado do nome. "sem estoque" saiu do nome: a coluna Disponível já
            mostra 0 (em atenção). */}
        <span className="block min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {/* No celular o nome é o alvo de toque da linha: 40 px de altura em vez de 20 (auditoria 28/10, nº 59). */}
          <Link href={`/ativacao/itens/${item.id}`} className="text-corpo font-medium text-ink no-underline hover:underline max-md:inline-flex max-md:min-h-10 max-md:items-center">
            {item.nome}
          </Link>
          {/* Inativo também em texto, não só pela cor cinza (nº 138). */}
          {!item.ativo && <Tag tom="neutral">inativo</Tag>}
          {item.capaId && (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura já reduzida pela rota de anexos
            <img src={`/api/ativacao/anexos/${item.capaId}?w=160`} alt="" loading="lazy" decoding="async" className="size-6 shrink-0 rounded-chip border border-line bg-white object-cover max-sm:hidden" />
          )}
          {item.pecaCodigo && (
            <Tag tom="neutral" className="text-rotulo max-sm:whitespace-normal">
              na solicitação: {item.pecaCodigo}
            </Tag>
          )}
        </span>
        {item.observacao && <span className="mt-0.5 block text-pequeno text-muted">{item.observacao}</span>}
        {/* Item ligado ao catálogo: pedidos em andamento (destaque) e histórico do que já voltou, numa janela. */}
        {item.pecaId && <BotaoPedidosItem itemId={item.id} nome={item.nome} emUso={item.eventos.length} unidades={item.eventos.reduce((a, e) => a + e.quantidade, 0)} />}
        <span className="block text-rotulo text-meta md:hidden">{item.categoria}</span>
        {/* Abaixo de 1280 px as colunas "em evento" e "em reforma" somem: o número vai para baixo do nome. */}
        {(item.emEvento > 0 || item.reservado > 0 || item.emReforma > 0) && (
          <span className="block text-rotulo text-ink-3 xl:hidden">
            {[item.emEvento ? `${item.emEvento} em evento` : null, item.reservado ? `${item.reservado} ${item.reservado === 1 ? "reservado" : "reservados"}` : null, item.emReforma ? `${item.emReforma} em reforma` : null].filter(Boolean).join(" · ")}
          </span>
        )}
        </span>
      </td>
      <td className="hidden px-3 py-2.5 align-middle text-pequeno text-ink-2 md:table-cell">{item.categoria}</td>
      <td className="px-3 py-2.5 align-middle max-sm:px-1">
        <div className="relative flex justify-center">
          <Stepper tamanho="sm" valor={valor} min={0} onChange={mudar} label={`Quantidade de ${item.nome}`} disabled={!item.ativo} />
          <span className="pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap text-rotulo text-meta" aria-live="polite">
            {estado === "salvando" ? "salvando…" : estado === "salvo" ? "salvo" : ""}
          </span>
        </div>
      </td>
      <td className="numero hidden px-3 py-2.5 text-right align-middle text-pequeno xl:table-cell">
        {item.emEvento ? <span className="font-medium text-info">{item.emEvento}</span> : <span className="text-meta">—</span>}
        {item.reservado > 0 && <span className="block text-rotulo text-meta" title="Reservado para eventos que ainda vão montar">+{item.reservado} {item.reservado === 1 ? "reservado" : "reservados"}</span>}
      </td>
      <td className="numero hidden px-3 py-2.5 text-right align-middle text-pequeno xl:table-cell">{item.emReforma ? <span className="font-medium text-warning">{item.emReforma}</span> : <span className="text-meta">—</span>}</td>
      <td className={cn("numero hidden px-3 py-2.5 text-right align-middle text-corpo font-semibold sm:table-cell", valor - item.emEvento <= 0 && "text-warning")}>{Math.max(0, valor - item.emEvento)}</td>
      <td className="numero hidden px-3 py-2.5 text-right align-middle text-pequeno sm:table-cell">{item.comprar ? <span className="font-medium text-warning">{item.comprar}</span> : <span className="text-meta">—</span>}</td>
      <td className="px-3 py-2.5 pr-cartao text-right align-middle max-sm:pl-0 max-sm:pr-2">
        {/* Só o lápis, como nas outras listas: "Editar" escrito em 244 linhas. */}
        <IconButton label={`Editar ${item.nome}`} onClick={onEditar}>
          <Icone nome="lapis" />
        </IconButton>
      </td>
    </tr>
  );
}

/** O que o formulário de edição lê do item (a página do item não tem as contagens da lista). */
type ItemEditavel = Pick<ItemEstoqueTela, "id" | "nome" | "categoria" | "quantidade" | "comprar" | "observacao" | "pecaId" | "ativo">;

/**
 * Na página do item: o mesmo diálogo do "Editar" da lista. Antes a página mandava ir a "Estoque › Editar"
 * para ligar o item a uma peça do catálogo, sem botão ali.
 */
export function BotaoEditarItemEstoque({ item, catalogo }: { item: ItemEditavel; catalogo: Array<{ id: string; codigo: string; nome: string }> }) {
  const [aberto, setAberto] = useState(false);
  const categorias = [...new Set([...CATEGORIAS_ESTOQUE, item.categoria])];
  return (
    <>
      <Button abreDialogo variant="secondary" onClick={() => setAberto(true)}>
        <Icone nome="lapis" />
        Editar item
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && <FormItem item={item} categorias={categorias} catalogo={catalogo} categoriaPadrao={item.categoria} onFechar={() => setAberto(false)} />}
      </Dialog>
    </>
  );
}

function FormItem({ item, categorias, catalogo, categoriaPadrao, onFechar }: { item: ItemEditavel | null; categorias: string[]; catalogo: Array<{ id: string; codigo: string; nome: string }>; categoriaPadrao: string; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(item?.nome ?? "");
  const [cat, setCat] = useState(item?.categoria ?? categoriaPadrao);
  const [quantidade, setQuantidade] = useState(item?.quantidade ?? 0);
  const [comprar, setComprar] = useState(item?.comprar ?? 0);
  const [observacao, setObservacao] = useState(item?.observacao ?? "");
  const [pecaId, setPecaId] = useState<string | null>(item?.pecaId ?? null);
  const [ativo, setAtivo] = useState(item?.ativo ?? true);
  const [erros, setErros] = useState<Record<string, string>>({});

  const salvar = () =>
    iniciar(async () => {
      const r = await salvarItemEstoqueAction({ id: item?.id ?? null, nome, categoria: cat, quantidade, comprar: comprar || null, observacao: observacao || null, pecaId, ativo });
      if (!r.ok) {
        setErros(r.campos ?? {});
        toastErro(r.erro);
        return;
      }
      toastSucesso(item ? `${nome} atualizado` : `${nome} incluído no estoque`);
      onFechar();
      router.refresh();
    });

  return (
    <DialogContent title={item ? `Editar ${item.nome}` : "Novo item no estoque"} description="Vinculado a uma peça do catálogo, o item aparece na solicitação com quanto ainda tem no período do evento." width={520}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome" htmlFor="estoque-nome" obrigatorio error={erros.nome}>
          <Input id="estoque-nome" value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Capa de puff - Preta" autoFocus />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Categoria" htmlFor="estoque-categoria">
            <Select id="estoque-categoria" value={cat} onValueChange={setCat} ordenarAlfabetico={false} opcoes={categorias.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Em posse" htmlFor="estoque-quantidade" error={erros.quantidade}>
            <Stepper id="estoque-quantidade" valor={quantidade} min={0} onChange={setQuantidade} label="Quantidade" />
          </Field>
          <Field label="Comprar" htmlFor="estoque-comprar" optional>
            <Stepper id="estoque-comprar" valor={comprar} min={0} onChange={setComprar} label="Quantidade a comprar" />
          </Field>
        </div>
        <Field label="Observação" htmlFor="estoque-obs" optional hint="Ex.: 1 quebrada · 4 sem cabo de recarga">
          <Textarea id="estoque-obs" value={observacao} maxLength={1000} onChange={(e) => setObservacao(e.target.value)} className="min-h-[64px]" />
        </Field>
        <Field label="Peça do catálogo" htmlFor="estoque-peca" optional error={erros.pecaId} hint="A peça que a Ativação pede na solicitação (ex.: Puff Cubo → PUFF). Ao pedir, aparece quanto ainda tem; a OS do evento leva o item e o retorno traz de volta.">
          <div className="flex items-center gap-2">
            <ComboBox id="estoque-peca" value={pecaId} onChange={(v) => setPecaId(v || null)} placeholder="Nenhuma — só no estoque" className="min-w-0 flex-1" opcoes={catalogo.map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo }))} />
            {pecaId && (
              <Button variant="link" size="sm" onClick={() => setPecaId(null)}>
                Tirar a peça
              </Button>
            )}
          </div>
        </Field>
        {item && <Checkbox id="estoque-ativo" label="Ativo" description="Desmarque para tirar da lista sem apagar (fica em Inativos)." checked={ativo} onChange={setAtivo} />}
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={salvar} loading={pendente}>
          {item ? "Salvar" : "Incluir no estoque"}
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
