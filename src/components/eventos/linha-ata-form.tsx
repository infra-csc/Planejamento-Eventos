"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useState } from "react";
import { incluirLinhaAtaAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Button, SubmitButton } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";
import { SETOR_LABEL } from "@/domain/os";
import type { Setor } from "@/server/db/schema";

export type OpcoesReferencia = {
  projetos: Array<{ id: string; codigo: string; nome: string; categoria: string }>;
  pecas: Array<{ id: string; codigo: string; nome: string; setor: Setor; unidade: string }>;
};

export function ReferenciaCampos({ opcoes, tipo, setTipo, campos, defaults }: { opcoes: OpcoesReferencia; tipo: "PROJETO" | "PECA" | "AVULSO"; setTipo: (t: "PROJETO" | "PECA" | "AVULSO") => void; campos?: Record<string, string>; defaults?: { projetoId?: string | null; pecaId?: string | null; descricaoLivre?: string | null } }) {
  return (
    <>
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-medium text-ink-secondary">O que está sendo incluído</legend>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-line p-1 text-[13px]">
          {(["PROJETO", "PECA", "AVULSO"] as const).map((t) => (
            <label key={t} className={`cursor-pointer rounded-sm px-2 py-1.5 text-center ${tipo === t ? "bg-brand text-white font-medium" : "text-ink-secondary hover:bg-black/5"}`}>
              <input type="radio" name="referenciaTipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              {t === "PROJETO" ? "Projeto padrão" : t === "PECA" ? "Peça do catálogo" : "Item avulso"}
            </label>
          ))}
        </div>
      </fieldset>
      {tipo === "PROJETO" && (
        <Field label="Projeto padrão" htmlFor="projetoId" error={campos?.projetoId} hint="A OS soma a lista de peças do projeto × quantidade.">
          <Select id="projetoId" name="projetoId" defaultValue={defaults?.projetoId ?? ""} required>
            <option value="" disabled>
              Selecione
            </option>
            {opcoes.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.codigo}){p.categoria ? ` · ${p.categoria}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {tipo === "PECA" && (
        <Field label="Peça" htmlFor="pecaId" error={campos?.pecaId}>
          <Select id="pecaId" name="pecaId" defaultValue={defaults?.pecaId ?? ""} required>
            <option value="" disabled>
              Selecione
            </option>
            {(["ESTRUTURA", "TENDA", "MARCENARIA"] as const).map((s) => (
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
        <Field label="Descrição do item" htmlFor="descricaoLivre" error={campos?.descricaoLivre} hint="Ex.: “Fechamento de tenda”. Itens avulsos não entram no cálculo por peça; aparecem listados na OS.">
          <Input id="descricaoLivre" name="descricaoLivre" defaultValue={defaults?.descricaoLivre ?? ""} required maxLength={160} />
        </Field>
      )}
    </>
  );
}

export function LinhaAtaForm({ eventoId, opcoes, areas, exigeJustificativa, onDone }: { eventoId: string; opcoes: OpcoesReferencia; areas: Array<{ id: string; nome: string }>; exigeJustificativa: boolean; onDone: () => void }) {
  const [state, action] = useActionState(incluirLinhaAtaAction, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<"PROJETO" | "PECA" | "AVULSO">("PROJETO");
  useActionFeedback(state, onDone);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="eventoId" value={eventoId} />
      <ReferenciaCampos opcoes={opcoes} tipo={tipo} setTipo={setTipo} campos={campos} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantidade" htmlFor="quantidade" error={campos?.quantidade}>
          <Input id="quantidade" name="quantidade" type="number" min={1} defaultValue={1} required />
        </Field>
        <Field label="Destino / local" htmlFor="destino" optional hint="Ex.: GV, palco principal">
          <Input id="destino" name="destino" maxLength={60} />
        </Field>
        <Field label="Área solicitante" htmlFor="areaId" optional className="sm:col-span-2">
          <Select id="areaId" name="areaId" defaultValue="">
            <option value="">Logística (sem área)</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {exigeJustificativa && (
        <Field label="Justificativa" htmlFor="justificativa" error={campos?.justificativa}>
          <Textarea id="justificativa" name="justificativa" required placeholder="Por que esta linha entra fora do fluxo de solicitação? Fica no histórico e a área é notificada." />
        </Field>
      )}
      <FormError message={!state.ok && !campos ? state.erro : !state.ok && campos ? state.erro : null} />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton>Incluir</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}
