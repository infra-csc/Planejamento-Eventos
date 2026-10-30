"use client";

import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toastSucesso } from "@/components/ui/toast";
import { salvarPecaAction } from "@/app/(app)/catalogo/actions";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Aviso, Section } from "@/components/ui/layout";
import { Numero } from "@/components/ui/numero";
import { SETOR_LABEL } from "@/domain/os";
import { ESTADO_INICIAL, type ActionResult } from "@/lib/action";
import { LIMITES, SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";
import type { GrupoProjetoOpcao } from "@/components/projetos/grupo-projeto-field";
import { OrigemPecaField } from "./origem-peca-field";

export function PecaForm({
  valores,
  usos,
  grupos,
  cancelarHref,
}: {
  valores: { id?: string; codigo?: string; nome?: string; setor?: Setor; familia?: string; unidade?: string; descricao?: string | null; estoqueProprio?: number; permiteEmProjeto?: boolean; disponivelEmSolicitacoes?: boolean; prova?: string | null };
  usos?: Array<{ id: string; nome: string; quantidade: number }>;
  /** Provas já usadas na Biblioteca (grupos dos projetos), para a origem da peça. */
  grupos: readonly GrupoProjetoOpcao[];
  cancelarHref: string;
}) {
  const [state, action] = useActionState(salvarPecaAction, ESTADO_INICIAL as ActionResult<{ destino: string }>);
  const router = useRouter();
  // Salvou: toast e só então navega; antes só redirecionava, sem dizer que tinha salvado (auditoria 30/10, parte C N19).
  const visto = useRef(state);
  useEffect(() => {
    if (visto.current === state) return;
    visto.current = state;
    if (!state.ok || !state.dados?.destino) return;
    if (state.mensagem) toastSucesso(state.mensagem);
    router.push(state.dados.destino);
  }, [state, router]);
  const c = !state.ok ? state.campos : undefined;
  return (
    // Celular: o campo em foco não fica atrás da barra fixa do rodapé (auditoria 28/10, nº 30).
    <ActionForm action={action} noValidate className="flex flex-col gap-5 max-md:[&_:is(input,textarea,button)]:scroll-mb-28">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      {/* Para onde ir depois de salvar: a lista do jeito que a pessoa deixou (o mesmo do Cancelar). */}
      <input type="hidden" name="$volta" value={cancelarHref} />

      <Section titulo="Identificação" sub="Como a peça aparece no catálogo, nos projetos e nas OS.">
        <div className="grid gap-4 px-cartao py-4 sm:grid-cols-2">
          {/* Sem foco automático: pulava o cabeçalho e a trilha da página (auditoria 28/10, nº 141). */}
          <Field label="Código" htmlFor="codigo" error={c?.codigo} hint="Curto e único. Ex.: BOX-600, TND-MASTRO, MDF-15" obrigatorio>
            <Input id="codigo" name="codigo" defaultValue={valores.codigo ?? ""} required className="font-mono uppercase" maxLength={LIMITES.codigoPeca} />
          </Field>
          <Field label="Nome descritivo" htmlFor="nome" error={c?.nome} obrigatorio>
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required placeholder="Ex.: Box truss 600 mm (trecho 3 m)" />
          </Field>
          <Field label="Descrição" htmlFor="descricao" optional className="sm:col-span-2">
            <Textarea id="descricao" name="descricao" defaultValue={valores.descricao ?? ""} className="min-h-16" />
          </Field>
        </div>
      </Section>

      <Section titulo="Origem" sub="De onde a peça é: do acervo do galpão ou feita para uma prova.">
        <div className="px-cartao py-4">
          <OrigemPecaField grupos={grupos} valor={valores.prova} erro={c?.grupoEvento} />
        </div>
      </Section>

      <Section titulo="Classificação e estoque" sub="Onde a peça é executada e quanto a empresa tem.">
        <div className="grid gap-4 px-cartao py-4 sm:grid-cols-2">
          <Field label="Setor de execução" htmlFor="setor" error={c?.setor} hint="Define em qual OS a peça aparece." obrigatorio>
            <Select id="setor" name="setor" defaultValue={valores.setor ?? "ESTRUTURA"} ordenarAlfabetico={false} opcoes={SETORES.map((s) => ({ value: s, label: SETOR_LABEL[s] }))} />
          </Field>
          <Field label="Família" htmlFor="familia" optional hint="Box truss, Conexão, Fixação, Tenda, Chapa…">
            <Input id="familia" name="familia" defaultValue={valores.familia ?? ""} maxLength={LIMITES.categoria} />
          </Field>
          <Field label="Unidade" htmlFor="unidade" error={c?.unidade} hint="Ex.: un, m, m², par." obrigatorio>
            <Input id="unidade" name="unidade" defaultValue={valores.unidade ?? "un"} maxLength={LIMITES.unidade} />
          </Field>
          <Field label="Estoque próprio" htmlFor="estoqueProprio" error={c?.estoqueProprio} hint="Quantidade que a empresa tem. Por enquanto é só registro: nenhuma tela soma este número.">
            <Input id="estoqueProprio" name="estoqueProprio" type="number" min={0} defaultValue={valores.estoqueProprio ?? 0} className="numero" />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox id="permiteEmProjeto" name="permiteEmProjeto" label="Pode entrar na lista de peças de projetos padrão" description="Desmarque para peças sempre lançadas avulsas com destino, como fechamento de tenda." defaultChecked={valores.permiteEmProjeto ?? true} />
          </div>
          <div className="sm:col-span-2">
            {/* O campo oculto diz ao servidor que o formulário tem a opção (checkbox desmarcado não é enviado). */}
            <input type="hidden" name="temDisponivel" value="1" />
            <Checkbox id="disponivelEmSolicitacoes" name="disponivelEmSolicitacoes" label="Aparece nas solicitações" description="As áreas encontram a peça ao pedir. Desmarque para peças que só a cenografia e a logística usam." defaultChecked={valores.disponivelEmSolicitacoes ?? true} />
          </div>
        </div>
      </Section>

      {usos && usos.length > 0 && (
        <Aviso tom="info" titulo={`Usada em ${usos.length} ${usos.length === 1 ? "projeto ativo" : "projetos ativos"}`}>
          {/* Lista (não parágrafo corrido): nome do projeto e quantas desta peça vão em cada unidade dele. */}
          <ul className="m-0 mt-1 grid max-h-56 list-none gap-px overflow-y-auto p-0">
            {usos.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-3">
                {/* 24 px de alvo (40 no celular): os links tinham 17–20 px (auditoria 28/10, nº 60). */}
                <Link href={`/projetos/${u.id}`} className="inline-flex min-h-6 min-w-0 items-center text-ink-2 no-underline hover:text-accent hover:underline max-md:min-h-10">
                  {u.nome}
                </Link>
                <span className="numero shrink-0 text-ink-3">
                  <Numero valor={u.quantidade} /> por unidade
                </span>
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <FormError message={!state.ok ? state.erro : null} />
      {/* Celular: salvar fixo no rodapé, como nos formulários de evento e de projeto. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 max-md:sticky max-md:bottom-0 max-md:z-10 max-sm:-mx-4 sm:max-md:-mx-5 max-md:border-line max-md:bg-page/95 max-sm:px-4 sm:max-md:px-5 max-md:py-3 max-md:backdrop-blur-sm">
        <SubmitButton size="lg" className="max-md:flex-1">
          {valores.id ? "Salvar" : "Cadastrar peça"}
        </SubmitButton>
        <ButtonLink href={cancelarHref} variant="ghost" size="lg" className="no-underline">
          Cancelar
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
