"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useMemo, useRef, useState } from "react";
import { salvarProjetoAction } from "@/app/(app)/projetos/actions";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { ComboBox } from "@/components/ui/combobox";
import { Button, ButtonLink, SubmitButton } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Aviso, EmptyState, Section } from "@/components/ui/layout";
import { Codigo, Numero } from "@/components/ui/numero";
import { Stepper } from "@/components/ui/stepper";
import { SETOR_LABEL } from "@/domain/os";
import { ESTADO_INICIAL } from "@/lib/action";
import type { Setor } from "@/server/db/schema";

export type PecaOpcao = { id: string; codigo: string; nome: string; setor: Setor; familia?: string; unidade: string; permiteEmProjeto: boolean };
type Linha = { pecaId: string; quantidade: number };

/** Categorias que o catálogo real usa; as que já existem no banco entram junto (prop `categorias`). */
export const CATEGORIAS_PADRAO = ["Pórtico", "Quadro", "Estande", "Palco", "Ativação", "Obstáculo", "Tenda", "Percurso", "Estrutura", "Marcenaria"];
const ORDEM_SETOR: Record<Setor, number> = { ESTRUTURA: 0, TENDA: 1, ARENA: 2, MARCENARIA: 3 };
const SETOR_CURTO: Record<Setor, string> = { ESTRUTURA: "Estrutura", TENDA: "Tenda", MARCENARIA: "Marcenaria", ARENA: "Arena" };

export function ProjetoForm({
  valores,
  pecas,
  categorias = [],
  cancelarHref,
  onCancelar,
  voltarPara,
}: {
  valores: {
    id?: string;
    nome?: string;
    categoria?: string;
    descricao?: string | null;
    itens: Linha[];
    versaoAtual?: number;
    disponivelEmSolicitacoes?: boolean;
    /** Duplicando outro projeto: de onde veio a lista (só informativo). */
    origem?: { codigo: string; nome: string } | null;
  };
  pecas: PecaOpcao[];
  /** Categorias já usadas por outros projetos, para sugerir junto das padrão. */
  categorias?: string[];
  cancelarHref: string;
  /** Dentro de um modal: cancelar fecha em vez de navegar. */
  onCancelar?: () => void;
  /** Para onde ir depois de salvar (padrão: página do projeto). */
  voltarPara?: string;
}) {
  const [state, action] = useActionState(salvarProjetoAction, ESTADO_INICIAL);
  const [itens, setItens] = useState<Linha[]>(valores.itens);
  const [novaPeca, setNovaPeca] = useState<string | null>(null);
  const [novaQtd, setNovaQtd] = useState(1);
  const qtdRef = useRef<HTMLInputElement>(null);
  const c = !state.ok ? state.campos : undefined;
  const mapa = useMemo(() => new Map(pecas.map((p) => [p.id, p])), [pecas]);
  const disponiveis = useMemo(() => pecas.filter((p) => p.permiteEmProjeto && !itens.some((i) => i.pecaId === p.id)), [pecas, itens]);
  // Busca por nome, código e família; o setor aparece como selo (a treliça Q30 e a Q15 têm nomes parecidos).
  // Ordem: estrutura primeiro e por código, para "3000" trazer o trecho Q30 antes do Q15.
  const opcoes = useMemo(
    () =>
      [...disponiveis]
        .sort((a, b) => ORDEM_SETOR[a.setor] - ORDEM_SETOR[b.setor] || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }))
        .map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo}${p.familia ? ` · ${p.familia}` : ""}`, selo: SETOR_CURTO[p.setor], seloTom: (p.setor === "MARCENARIA" ? "warning" : p.setor === "ESTRUTURA" ? "accent" : "muted") as "accent" | "warning" | "muted" })),
    [disponiveis],
  );
  const listaCategorias = useMemo(() => [...new Set([...CATEGORIAS_PADRAO, ...categorias.map((x) => x.trim()).filter(Boolean)])], [categorias]);
  const bomMudou = useMemo(() => {
    const k = (l: Linha[]) => l.map((i) => `${i.pecaId}:${i.quantidade}`).sort().join("|");
    return k(itens) !== k(valores.itens);
  }, [itens, valores.itens]);
  const totalUnidades = itens.reduce((a, i) => a + i.quantidade, 0);

  const adicionar = () => {
    if (!novaPeca || novaQtd <= 0) return;
    setItens((l) => [...l, { pecaId: novaPeca, quantidade: Math.max(1, Math.floor(novaQtd)) }]);
    setNovaPeca(null);
    setNovaQtd(1);
    // Volta para a busca: a próxima peça entra sem tirar a mão do teclado.
    requestAnimationFrame(() => document.getElementById("novaPeca")?.focus());
  };

  return (
    <ActionForm action={action} noValidate className="flex flex-col gap-5">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      {voltarPara && <input type="hidden" name="voltarPara" value={voltarPara} />}
      <input type="hidden" name="itens" value={JSON.stringify(itens)} />

      {valores.origem && (
        <Aviso tom="info" titulo={`Copiado de ${valores.origem.codigo} · ${valores.origem.nome}`}>
          A lista de peças veio do projeto original. Dê um nome que diga o que muda (ex.: “— com aplique”, “— pés 0,60 m”) e ajuste as quantidades.
        </Aviso>
      )}

      <Section titulo="Identificação" sub="Nome e categoria aparecem na biblioteca e na escolha de projetos das solicitações.">
        <div className="grid gap-4 px-cartao py-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="nome" error={c?.nome} obrigatorio hint="Único na biblioteca. Variação de um projeto: mesmo nome + o que muda.">
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required autoFocus placeholder="Ex.: Pórtico boca de 6 m com orelha" />
          </Field>
          <Field label="Categoria" htmlFor="categoria" optional hint="Agrupa na biblioteca e na busca da solicitação.">
            <Input id="categoria" name="categoria" defaultValue={valores.categoria ?? ""} list="categorias" placeholder="Ex.: Pórtico" />
          </Field>
          <datalist id="categorias">
            {listaCategorias.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <Field label="Descrição" htmlFor="descricao" optional hint="Aparece para quem pede: medidas, para que serve, o que vai junto (lona, LED, contrapeso)." className="sm:col-span-2">
            <Textarea id="descricao" name="descricao" defaultValue={valores.descricao ?? ""} rows={3} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              id="disponivel"
              name="disponivel"
              label="Disponível nas solicitações"
              defaultChecked={valores.disponivelEmSolicitacoes ?? true}
              description="Desmarcado, o projeto fica só na biblioteca (como a marcenaria hoje) e não aparece para quem pede."
            />
          </div>
        </div>
      </Section>

      <Section
        titulo="Lista de peças"
        sub="Quantidade de cada peça para montar UMA unidade do projeto. Peças marcadas como “só fora de projeto” não aparecem aqui."
        acoes={itens.length > 0 ? <span className="text-pequeno text-muted"><Numero valor={itens.length} /> {itens.length === 1 ? "tipo" : "tipos"} · <Numero valor={totalUnidades} /> {totalUnidades === 1 ? "peça" : "peças"}</span> : undefined}
      >
        <div className="flex flex-col gap-3 border-b border-line-soft bg-subtle px-cartao py-3.5 sm:flex-row sm:items-end">
          <Field label="Adicionar peça" htmlFor="novaPeca" className="sm:flex-1" hint="Digite parte do nome, do código ou da família (ex.: “3000”, “cubo”, “Q15”, “saia”).">
            <ComboBox
              id="novaPeca"
              value={novaPeca}
              onChange={(v) => {
                setNovaPeca(v);
                requestAnimationFrame(() => {
                  qtdRef.current?.focus();
                  qtdRef.current?.select();
                });
              }}
              opcoes={opcoes}
              placeholder="Buscar peça no catálogo…"
              ordenarAlfabetico={false}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Field label="Qtd." htmlFor="novaQtd" className="w-24">
              <Input
                ref={qtdRef}
                id="novaQtd"
                type="number"
                min={1}
                value={novaQtd}
                className="numero"
                onChange={(e) => setNovaQtd(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionar();
                  }
                }}
              />
            </Field>
            <Button variant="secondary" onClick={adicionar} disabled={!novaPeca} motivoDesabilitado="Escolha uma peça para adicionar" className="max-sm:flex-1">
              <Icone nome="mais" />
              Adicionar
            </Button>
          </div>
        </div>
        {itens.length === 0 ? (
          <EmptyState compact title="Nenhuma peça na lista" description="Busque uma peça acima, informe a quantidade e pressione Enter (ou “Adicionar”)." />
        ) : (
          <>
            {/* Cabeçalho visual das colunas a partir de md; no celular cada linha quebra em duas. */}
            <div aria-hidden className="hidden items-center gap-3 border-b border-line-soft px-cartao py-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted md:flex">
              <span className="flex-1">Peça</span>
              <span className="w-[108px] text-center">Quantidade</span>
              <span className="w-7" />
            </div>
            <ul aria-label="Peças do projeto" aria-describedby={c?.itens ? "itens-erro" : undefined} className="m-0 list-none p-0">
              {itens.map((i, idx) => {
                const p = mapa.get(i.pecaId);
                return (
                  <li key={i.pecaId} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-row px-cartao py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1 basis-[220px]">
                      <span className="block text-corpo text-ink">
                        {p?.codigo && <Codigo className="mr-2 text-pequeno font-medium text-ink-2">{p.codigo}</Codigo>}
                        {p?.nome ?? "Peça fora do catálogo"}
                      </span>
                      <span className="block text-pequeno text-muted">{p ? `${SETOR_LABEL[p.setor]}${p.familia ? ` · ${p.familia}` : ""}` : "—"}</span>
                    </span>
                    <Stepper tamanho="sm" min={1} valor={i.quantidade} label={`Quantidade de ${p?.nome ?? "peça"}`} onChange={(v) => setItens((l) => l.map((x, j) => (j === idx ? { ...x, quantidade: v } : x)))} />
                    <IconButton label={`Remover ${p?.nome ?? "peça"}`} className="hover:text-danger" onClick={() => setItens((l) => l.filter((_, j) => j !== idx))}>
                      <Icone nome="lixeira" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {c?.itens && (
          <p id="itens-erro" className="m-0 flex items-start gap-1 border-t border-line-soft px-cartao py-2.5 text-pequeno text-danger">
            <Icone nome="erro" className="mt-px size-4" />
            {c.itens}
          </p>
        )}
      </Section>

      {valores.id && bomMudou && (
        <Section titulo={`Nova versão (v${(valores.versaoAtual ?? 1) + 1})`} sub="A lista de peças mudou. Eventos que já usam este projeto mantêm a versão anterior até a logística decidir atualizar.">
          <div className="px-cartao py-4">
            <Field label="O que mudou" htmlFor="observacaoVersao" optional hint="Aparece no histórico de versões e na ata dos eventos que usam o projeto.">
              <Input id="observacaoVersao" name="observacaoVersao" placeholder="Ex.: incluída sapata de base; parafusos ajustados para 140" />
            </Field>
          </div>
        </Section>
      )}
      {valores.id && !bomMudou && <Aviso tom="info">Sem mudança na lista de peças: os dados serão atualizados sem criar nova versão.</Aviso>}
      {!valores.id && <Aviso tom="info">Fotos e desenhos (render, modulação, PDF) são anexados na página do projeto, logo depois de criar.</Aviso>}

      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
        <SubmitButton size="lg" className="max-sm:w-full">
          {valores.id ? (bomMudou ? "Salvar como nova versão" : "Salvar") : "Criar projeto"}
        </SubmitButton>
        {onCancelar ? (
          <Button variant="secondary" size="lg" className="max-sm:w-full" onClick={onCancelar}>
            Cancelar
          </Button>
        ) : (
          <ButtonLink href={cancelarHref} variant="secondary" size="lg" className="no-underline max-sm:w-full">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </ActionForm>
  );
}
