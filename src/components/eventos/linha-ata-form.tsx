"use client";

import { SETORES } from "@/domain/constantes";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { incluirLinhaAtaAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Button, SubmitButton } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Pills } from "@/components/ui/pills";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";
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
      <input type="hidden" name="referenciaTipo" value={tipo} />
      <div>
        <Label>O que entra na ata</Label>
        <Pills rotulo="O que entra na ata" itens={TIPOS.map(([t, label]) => ({ label, ativo: tipo === t, onSelect: () => setTipo(t) }))} />
      </div>

      {tipo === "PROJETO" && (
        <Field label="Projeto padrão" htmlFor="projetoId" error={campos?.projetoId} hint="A OS soma a lista de peças do projeto × quantidade.">
          <Select id="projetoId" name="projetoId" defaultValue="" placeholder="Selecione o projeto" invalid={Boolean(campos?.projetoId)} opcoes={opcoes.projetos.map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo}${p.versaoAtual ? ` · v${p.versaoAtual}` : ""}` }))} />
        </Field>
      )}
      {tipo === "PECA" && (
        <Field label="Peça" htmlFor="pecaId" error={campos?.pecaId}>
          <Select
            id="pecaId"
            name="pecaId"
            defaultValue=""
            placeholder="Selecione a peça"
            invalid={Boolean(campos?.pecaId)}
            grupos={SETORES.map((s) => ({ label: SETOR_LABEL[s], opcoes: opcoes.pecas.filter((p) => p.setor === s).map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo })) }))}
          />
        </Field>
      )}
      {tipo === "AVULSO" && (
        <Field label="Descrição do item" htmlFor="descricaoLivre" error={campos?.descricaoLivre} hint="Itens fora do catálogo não entram na soma por peça; aparecem listados na OS até a logística vinculá-los.">
          <Input id="descricaoLivre" name="descricaoLivre" required maxLength={160} placeholder="Ex.: Fechamento lateral de tenda" />
        </Field>
      )}

      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Quantidade" htmlFor="quantidade" error={campos?.quantidade}>
          <Input id="quantidade" name="quantidade" type="number" min={1} defaultValue={1} required className="numero" />
        </Field>
        <Field label="Destino" htmlFor="destino" optional>
          <Input id="destino" name="destino" maxLength={60} placeholder="Ex.: Palco principal" />
        </Field>
      </div>
      <Field label="Área" htmlFor="areaId" optional>
        <Select id="areaId" name="areaId" defaultValue="" opcoes={[{ value: "", label: "Logística (sem área)" }, ...areas.map((a) => ({ value: a.id, label: a.nome }))]} />
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
