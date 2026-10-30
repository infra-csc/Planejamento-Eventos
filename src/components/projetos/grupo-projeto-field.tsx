"use client";

import { useMemo, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

export type GrupoProjetoOpcao = { id: string; nome: string };

/** A reusable free-named library group; deliberately unrelated to registered events. */
export function GrupoProjetoField({
  grupos,
  valor,
  erro,
}: {
  grupos: GrupoProjetoOpcao[];
  valor?: string | null;
  /** "Criar grupo…" sem nome (auditoria 30/10, parte C N18). */
  erro?: string | null;
}) {
  const existing = useMemo(() => grupos.find((g) => g.nome === valor), [grupos, valor]);
  const [selection, setSelection] = useState(existing?.id ?? (valor ? "__novo__" : ""));
  const [nome, setNome] = useState(existing ? "" : valor ?? "");
  const opcoes = [
    { value: "", label: "Padrão", descricao: "Sem grupo" },
    ...grupos.map((g) => ({ value: g.id, label: g.nome })),
    { value: "__novo__", label: "Criar grupo…", descricao: "Use um nome reutilizável" },
  ];
  const submittedName = selection === "__novo__" ? nome : grupos.find((g) => g.id === selection)?.nome ?? "";

  return (
    <div className="sm:col-span-2">
      <Field label="Grupo da biblioteca" htmlFor="grupoEscolhido" optional hint="Nome livre para organizar projetos — não vincula o projeto a um evento nem altera sua disponibilidade.">
        <Select
          id="grupoEscolhido"
          value={selection}
          opcoes={opcoes}
          ordenarAlfabetico={false}
          onValueChange={(value) => {
            setSelection(value);
            if (value === "__novo__") setNome("");
          }}
        />
      </Field>
      {selection === "__novo__" && (
        <div className="mt-3 max-w-xl">
          <Field label="Nome do grupo" htmlFor="grupoNome" obrigatorio error={erro} hint="Até 120 caracteres. Um nome já existente será reutilizado.">
            <Input id="grupoNome" value={nome} maxLength={120} required onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Feira de Inverno 2025" autoComplete="off" />
          </Field>
        </div>
      )}
      <input type="hidden" name="grupoEvento" value={submittedName} />
      {selection === "__novo__" && <input type="hidden" name="grupoNovo" value="1" />}
    </div>
  );
}
