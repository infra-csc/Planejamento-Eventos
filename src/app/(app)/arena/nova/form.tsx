"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combobox";
import { Field, FormError, Input } from "@/components/ui/field";
import { EmptyState, Section } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { ESTADO_INICIAL } from "@/lib/action";
import { criarArenaAction } from "../arenas-actions";

type EventoOpcao = { id: string; codigo: string; nome: string; descricao: string; status: string };
type ArenaOpcao = { slug: string; nome: string; pontos: number; evento: string | null };

const LIMITE_PLANTA = 8 * 1024 * 1024;

export function NovaArenaForm({ eventos, arenas, eventoInicial }: { eventos: EventoOpcao[]; arenas: ArenaOpcao[]; eventoInicial: string | null }) {
  const [state, action] = useActionState(criarArenaAction, ESTADO_INICIAL);
  const campos = !state.ok ? state.campos : undefined;
  const [eventoId, setEventoId] = useState<string | null>(eventoInicial);
  const nomeDoEvento = (id: string | null) => eventos.find((e) => e.id === id)?.nome ?? "";
  const [nome, setNome] = useState(() => nomeDoEvento(eventoInicial));
  // Enquanto a pessoa não mexe no nome, ele acompanha o evento escolhido.
  const [nomeEditado, setNomeEditado] = useState(false);
  const [partida, setPartida] = useState<"branco" | "copiar">("branco");
  const [origemSlug, setOrigemSlug] = useState<string | null>(arenas[0]?.slug ?? null);
  const [erroPlanta, setErroPlanta] = useState<string | null>(null);

  if (eventos.length === 0) {
    return (
      <Section>
        <EmptyState
          title="Todos os eventos já têm arena."
          description="Cada evento tem um mapa só. Abra a arena do evento pelo índice ou crie um evento novo antes."
          action={
            <ButtonLink href="/arena" variant="secondary" size="md" className="no-underline">
              Voltar às arenas
            </ButtonLink>
          }
        />
      </Section>
    );
  }

  return (
    <ActionForm action={action} className="flex flex-col gap-5">
      <Section titulo="Evento" sub="Cada evento tem uma arena. A ata dele aparece no mapa, sempre na versão vigente.">
        <div className="grid gap-4 px-[18px] py-4">
          <Field label="Evento" htmlFor="eventoId" error={campos?.eventoId} obrigatorio>
            <ComboBox
              id="eventoId"
              value={eventoId}
              onChange={(v) => {
                setEventoId(v);
                if (!nomeEditado) setNome(nomeDoEvento(v));
              }}
              opcoes={eventos.map((e) => ({ value: e.id, label: `${e.codigo} · ${e.nome}`, descricao: e.descricao, selo: e.status }))}
              placeholder="Buscar pelo código ou nome do evento…"
              invalid={Boolean(campos?.eventoId)}
              ordenarAlfabetico={false}
            />
          </Field>
          <input type="hidden" name="eventoId" value={eventoId ?? ""} />
          <Field label="Nome da arena" htmlFor="nome" error={campos?.nome} hint="Vira o endereço do mapa (sem acentos, com hífens)." obrigatorio>
            <Input
              id="nome"
              name="nome"
              value={nome}
              maxLength={120}
              required
              onChange={(e) => {
                setNome(e.target.value);
                setNomeEditado(true);
              }}
            />
          </Field>
        </div>
      </Section>

      <Section titulo="Ponto de partida" sub="Zonas, vias, percurso e pontos podem ser ajustados depois, no próprio mapa.">
        <div className="grid gap-4 px-[18px] py-4">
          <div role="radiogroup" aria-label="Ponto de partida" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { valor: "branco", titulo: "Área em branco", texto: "Um retângulo vazio do tamanho da área da planta." },
                { valor: "copiar", titulo: "Copiar layout de outra arena", texto: "Zonas, vias, edificações, percurso e pontos. A ata não é copiada." },
              ] as const
            ).map((o) => (
              <label
                key={o.valor}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-cartao border px-3.5 py-3",
                  partida === o.valor ? "border-accent bg-accent-bg" : "border-line bg-surface hover:bg-subtle",
                  o.valor === "copiar" && arenas.length === 0 && "cursor-not-allowed opacity-60",
                )}
              >
                <input type="radio" name="partida" value={o.valor} checked={partida === o.valor} disabled={o.valor === "copiar" && arenas.length === 0} onChange={() => setPartida(o.valor)} className="mt-[3px] accent-accent" />
                <span>
                  <span className="block text-corpo font-medium text-ink">{o.titulo}</span>
                  <span className="block text-pequeno text-muted">{o.texto}</span>
                </span>
              </label>
            ))}
          </div>

          {partida === "branco" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Largura (m)" htmlFor="largura" error={campos?.largura} hint="Leste–oeste, de 20 a 5.000 m.">
                <Input id="largura" name="largura" type="number" inputMode="decimal" min={20} max={5000} step="any" defaultValue={300} required />
              </Field>
              <Field label="Profundidade (m)" htmlFor="profundidade" error={campos?.profundidade} hint="Norte–sul, de 20 a 5.000 m.">
                <Input id="profundidade" name="profundidade" type="number" inputMode="decimal" min={20} max={5000} step="any" defaultValue={200} required />
              </Field>
            </div>
          ) : (
            <>
              <Field label="Arena de origem" htmlFor="origemSlug" error={campos?.origemSlug} obrigatorio>
                <ComboBox
                  id="origemSlug"
                  value={origemSlug}
                  onChange={setOrigemSlug}
                  opcoes={arenas.map((a) => ({ value: a.slug, label: a.nome, descricao: a.evento ?? "Arena fixa", selo: `${a.pontos} ${a.pontos === 1 ? "ponto" : "pontos"}` }))}
                  placeholder="Buscar arena…"
                  invalid={Boolean(campos?.origemSlug)}
                />
              </Field>
              <input type="hidden" name="origemSlug" value={origemSlug ?? ""} />
            </>
          )}
        </div>
      </Section>

      <Section titulo="Planta" sub="Opcional. A imagem fica como fundo do plano 2D; dá para enviar ou trocar depois, no índice das arenas.">
        <div className="px-[18px] py-4">
          <Field label="Imagem da planta" htmlFor="planta" error={erroPlanta ?? campos?.planta} hint="PNG, JPG ou WebP · até 8 MB." optional>
            <input
              id="planta"
              type="file"
              name="planta"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full text-pequeno text-ink-2 file:mr-3 file:cursor-pointer file:rounded-controle file:border file:border-line-control file:bg-surface file:px-3 file:py-1.5 file:text-pequeno file:text-ink"
              onChange={(e) => {
                const f = e.target.files?.[0];
                const grande = Boolean(f && f.size > LIMITE_PLANTA);
                setErroPlanta(grande ? "Arquivo acima de 8 MB. Reduza a imagem e escolha de novo." : null);
                if (grande) e.target.value = "";
              }}
            />
          </Field>
        </div>
      </Section>

      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton size="lg" disabled={!eventoId}>
          Criar arena
        </SubmitButton>
        <ButtonLink href="/arena" variant="secondary" size="lg" className="no-underline">
          Cancelar
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
