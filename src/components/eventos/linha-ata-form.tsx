"use client";

import { SETORES } from "@/domain/constantes";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { incluirLinhaAtaAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Button, SubmitButton } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";
import { cn } from "@/lib/cn";
import { SETOR_LABEL } from "@/domain/os";
import type { Setor } from "@/server/db/schema";

export type OpcoesReferencia = {
  projetos: Array<{ id: string; codigo: string; nome: string; categoria: string; versaoAtual?: number }>;
  pecas: Array<{ id: string; codigo: string; nome: string; setor: Setor; unidade: string }>;
};

type Tipo = "PROJETO" | "PECA" | "AVULSO";
const TIPOS: Array<[Tipo, string]> = [
  ["PROJETO", "Projeto padrão"],
  ["PECA", "Peça do catálogo"],
  ["AVULSO", "Item avulso"],
];

export function LinhaAtaForm({ eventoId, opcoes, areas, exigeJustificativa, onDone }: { eventoId: string; opcoes: OpcoesReferencia; areas: Array<{ id: string; nome: string }>; exigeJustificativa: boolean; onDone: () => void }) {
  const [state, action] = useActionState(incluirLinhaAtaAction, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<Tipo>("PROJETO");
  useActionFeedback(state, onDone);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="flex flex-col gap-3.5" noValidate>
      <input type="hidden" name="eventoId" value={eventoId} />
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">O que entra na ata</legend>
        <div className="flex w-fit gap-1 rounded-lg bg-control p-[3px]">
          {TIPOS.map(([t, label]) => (
            <label key={t} className={cn("cursor-pointer rounded-[7px] px-3 py-1.5 text-[12.5px]", tipo === t ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(42,20,24,.08)]" : "text-ink-3")}>
              <input type="radio" name="referenciaTipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {tipo === "PROJETO" && (
        <Field label="Projeto padrão" htmlFor="projetoId" error={campos?.projetoId} hint="A OS soma a lista de peças do projeto × quantidade.">
          <Select id="projetoId" name="projetoId" defaultValue="" required>
            <option value="" disabled>
              Selecione
            </option>
            {opcoes.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.codigo}
                {p.versaoAtual ? ` · v${p.versaoAtual}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {tipo === "PECA" && (
        <Field label="Peça" htmlFor="pecaId" error={campos?.pecaId}>
          <Select id="pecaId" name="pecaId" defaultValue="" required>
            <option value="" disabled>
              Selecione
            </option>
            {SETORES.map((s) => (
              <optgroup key={s} label={SETOR_LABEL[s]}>
                {opcoes.pecas
                  .filter((p) => p.setor === s)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} · {p.nome}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      )}
      {tipo === "AVULSO" && (
        <Field label="Descrição do item" htmlFor="descricaoLivre" error={campos?.descricaoLivre} hint="Itens avulsos não entram na soma por peça; aparecem listados na OS.">
          <Input id="descricaoLivre" name="descricaoLivre" required maxLength={160} placeholder="Ex.: Fechamento lateral de tenda" />
        </Field>
      )}

      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Quantidade" htmlFor="quantidade" error={campos?.quantidade}>
          <Input id="quantidade" name="quantidade" type="number" min={1} defaultValue={1} required className="font-mono" />
        </Field>
        <Field label="Destino" htmlFor="destino" optional>
          <Input id="destino" name="destino" maxLength={60} placeholder="Ex.: Palco principal" />
        </Field>
      </div>
      <Field label="Área" htmlFor="areaId" optional>
        <Select id="areaId" name="areaId" defaultValue="">
          <option value="">Logística (sem área)</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>
      </Field>
      {exigeJustificativa && (
        <Field label="Justificativa" htmlFor="justificativa" error={campos?.justificativa}>
          <Textarea id="justificativa" name="justificativa" required placeholder="Por que esta linha entra fora de uma solicitação. Fica no histórico e a área é avisada." />
        </Field>
      )}
      <FormError message={!state.ok ? state.erro : null} />
      <DialogFooter>
        <SubmitButton>Incluir na ata</SubmitButton>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </DialogFooter>
    </ActionForm>
  );
}
