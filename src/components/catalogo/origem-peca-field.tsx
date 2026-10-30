"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { GrupoProjetoOpcao } from "@/components/projetos/grupo-projeto-field";

const NOVA = "__nova__";

/**
 * Origem da peça: do galpão (acervo de uso geral) ou feita para uma prova. As provas são os mesmos
 * grupos da biblioteca de projetos, então peça e projeto de uma prova ficam com o mesmo nome.
 * Envia `grupoEvento` (nome da prova; vazio = galpão).
 */
export function OrigemPecaField({ grupos, valor, erro }: { grupos: readonly GrupoProjetoOpcao[]; valor?: string | null; erro?: string | null }) {
  const existente = useMemo(() => grupos.find((g) => g.nome === valor), [grupos, valor]);
  const [deProva, setDeProva] = useState(Boolean(valor));
  const [escolha, setEscolha] = useState(existente?.id ?? (valor ? NOVA : ""));
  const [nome, setNome] = useState(existente ? "" : (valor ?? ""));
  const enviado = !deProva ? "" : escolha === NOVA ? nome : (grupos.find((g) => g.id === escolha)?.nome ?? "");

  const opcao = (ativo: boolean, titulo: string, sub: string, onClick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      tabIndex={ativo ? 0 : -1}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-controle border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        ativo ? "border-accent bg-selected" : "border-line-control bg-surface hover:border-ink-3",
      )}
    >
      <span aria-hidden className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", ativo ? "border-accent" : "border-line-strong")}>
        {ativo && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0">
        <span className="block text-corpo font-medium text-ink">{titulo}</span>
        <span className="block text-pequeno text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Setas trocam a opção e só a escolhida fica no Tab, como um grupo de rádio (auditoria 28/10, nº 66). */}
      <div
        role="radiogroup"
        aria-label="Origem da peça"
        className="flex flex-col gap-2 sm:flex-row"
        onKeyDown={(e) => {
          if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
          e.preventDefault();
          setDeProva((v) => !v);
          const botoes = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
          requestAnimationFrame(() => botoes[deProva ? 0 : 1]?.focus());
        }}
      >
        {opcao(!deProva, "Do galpão", "Acervo de uso geral, serve para qualquer evento.", () => setDeProva(false))}
        {/* Um nome para o agrupamento: "grupo da biblioteca", com a prova como exemplo (auditoria 28/10, nº 79). */}
        {opcao(deProva, "De um grupo (prova)", "Feita para um evento específico (ex.: com a marca da prova).", () => setDeProva(true))}
      </div>
      {deProva && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grupo da biblioteca" htmlFor="provaEscolhida" obrigatorio error={escolha === NOVA ? null : erro} hint="Os mesmos grupos dos projetos da Biblioteca (ex.: a prova).">
            <Select
              id="provaEscolhida"
              value={escolha}
              placeholder="Escolha o grupo"
              opcoes={[...grupos.map((g) => ({ value: g.id, label: g.nome })), { value: NOVA, label: "Criar grupo…", descricao: "Escreva o nome do grupo (ex.: a prova)" }]}
              onValueChange={(v) => {
                setEscolha(v);
                if (v === NOVA) setNome("");
              }}
            />
          </Field>
          {escolha === NOVA && (
            <Field label="Nome do grupo" htmlFor="provaNome" obrigatorio error={erro} hint="Um nome que já existe é reaproveitado.">
              <Input id="provaNome" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bota Pra Correr RJ" autoComplete="off" />
            </Field>
          )}
        </div>
      )}
      <input type="hidden" name="grupoEvento" value={enviado} />
      {deProva && <input type="hidden" name="deProva" value="1" />}
    </div>
  );
}
