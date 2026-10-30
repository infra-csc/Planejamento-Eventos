"use client";

import { LIMITES } from "@/domain/constantes";
import { useActionState, useRef, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { incluirLinhaAtaAction, kitTendaDoProjetoAction } from "@/app/(app)/eventos/actions";
import { Field, FormError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Button, SubmitButton } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Pills } from "@/components/ui/pills";
import { ComboBox } from "@/components/ui/combobox";
import { Stepper } from "@/components/ui/stepper";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";
import { SETOR_LABEL } from "@/domain/os";
import type { Setor } from "@/server/db/schema";

export type OpcoesReferencia = {
  projetos: Array<{ id: string; codigo: string; nome: string; categoria: string; versaoAtual?: number }>;
  pecas: Array<{ id: string; codigo: string; nome: string; setor: Setor; unidade: string }>;
};

type Tipo = "PROJETO" | "PECA" | "AVULSO";
// Rótulos curtos: os três cabem numa linha a 375 px (antes quebravam em duas; auditoria 28/10, nº 133). "Fora do
// catálogo", como no resto do app (antes "Item avulso"; nº 75). O campo abaixo diz o resto ("Projeto padrão", "Peça").
const TIPOS: Array<[Tipo, string]> = [
  ["PROJETO", "Projeto"],
  ["PECA", "Peça"],
  ["AVULSO", "Fora do catálogo"],
];

/** "1 fechamento", "2 calhas": o rótulo da coluna é plural ("Fechamentos"); a frase segue o número (auditoria 30/10, B-13). */
const porTendaTexto = (n: number, rotulo: string) => `${n} ${(n === 1 ? rotulo.replace(/s$/, "") : rotulo).toLowerCase()} por tenda`;

/** `rotuloEnviar`: depois da ata o item entra na OS (a ata não muda) e o botão diz isso. */
export function LinhaAtaForm({ eventoId, opcoes, areas, exigeJustificativa, onDone, rotuloEnviar = "Incluir na ata" }: { eventoId: string; opcoes: OpcoesReferencia; areas: Array<{ id: string; nome: string }>; exigeJustificativa: boolean; onDone: () => void; rotuloEnviar?: string }) {
  const rotuloTipo = exigeJustificativa ? "O que entra na OS" : "O que entra na ata";
  const [state, action] = useActionState(incluirLinhaAtaAction, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<Tipo>("PROJETO");
  const [projetoId, setProjetoId] = useState("");
  const [pecaId, setPecaId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  // Projeto de tenda: fechamentos e calhas do local, como no quadro de tendas (o padrão segue a quantidade até alguém mudar).
  const [kit, setKit] = useState<Awaited<ReturnType<typeof kitTendaDoProjetoAction>>>(null);
  const [totaisTenda, setTotaisTenda] = useState<Record<string, number>>({});
  const ultimoProjeto = useRef("");
  const escolherProjeto = (id: string) => {
    setProjetoId(id);
    setKit(null);
    setTotaisTenda({});
    ultimoProjeto.current = id;
    // Resposta de um projeto escolhido antes (a pessoa trocou rápido) é ignorada.
    if (id) void kitTendaDoProjetoAction(id).then((k) => ultimoProjeto.current === id && setKit(k)).catch(() => undefined);
  };
  const totalTenda = (p: { papel: string; porTenda: number }) => totaisTenda[p.papel] ?? p.porTenda * quantidade;
  const tendaAjustada = Boolean(kit?.papeis.some((p) => totalTenda(p) !== p.porTenda * quantidade));
  useActionFeedback(state, onDone);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="flex flex-col gap-3.5" noValidate>
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="referenciaTipo" value={tipo} />
      <div>
        <Label>{rotuloTipo}</Label>
        <Pills rotulo={rotuloTipo} className="!flex-nowrap" itens={TIPOS.map(([t, label]) => ({ label, ativo: tipo === t, onSelect: () => setTipo(t) }))} />
      </div>

      {tipo === "PROJETO" && (
        <Field label="Projeto padrão" htmlFor="projetoId" error={campos?.projetoId} hint="A OS soma a lista de peças do projeto × quantidade.">
          <input type="hidden" name="projetoId" value={projetoId} />
          <ComboBox id="projetoId" value={projetoId} onChange={escolherProjeto} placeholder="Digite o nome ou o código do projeto" invalid={Boolean(campos?.projetoId)} opcoes={opcoes.projetos.map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo}${p.versaoAtual ? ` · v${p.versaoAtual}` : ""}` }))} />
        </Field>
      )}
      {tipo === "PECA" && (
        <Field label="Peça" htmlFor="pecaId" error={campos?.pecaId}>
          <input type="hidden" name="pecaId" value={pecaId} />
          <ComboBox id="pecaId" value={pecaId} onChange={setPecaId} placeholder="Digite o nome ou o código da peça" invalid={Boolean(campos?.pecaId)} opcoes={opcoes.pecas.map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo, selo: SETOR_LABEL[p.setor], seloTom: "muted" as const }))} />
        </Field>
      )}
      {tipo === "AVULSO" && (
        <Field label="Descrição do item" htmlFor="descricaoLivre" error={campos?.descricaoLivre} hint="Itens fora do catálogo não entram na soma por peça; aparecem listados na OS até a logística vinculá-los.">
          <Input id="descricaoLivre" name="descricaoLivre" required maxLength={LIMITES.descricaoLivre} placeholder="Ex.: Fechamento lateral de tenda" />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
        <Field label="Quantidade" htmlFor="quantidade" error={campos?.quantidade}>
          {/* O mesmo − e + do resto da conferência; o valor vai no campo escondido. */}
          <Stepper id="quantidade" valor={quantidade} min={1} max={10_000} onChange={setQuantidade} />
        </Field>
        <Field label="Destino" htmlFor="destino" optional>
          <Input id="destino" name="destino" maxLength={LIMITES.destino} placeholder="Ex.: Palco principal" />
        </Field>
      </div>
      <input type="hidden" name="quantidade" value={quantidade} />
      {kit && tipo === "PROJETO" && (
        <div className="rounded-controle border border-line-soft bg-subtle p-3">
          <p className="m-0 mb-2 text-pequeno font-medium text-ink">
            Tenda {kit.tamanho} · totais do local
            <span className="ml-1 font-normal text-ink-3">(padrão: {kit.papeis.map((p) => porTendaTexto(p.porTenda, p.rotulo)).join(", ")})</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kit.papeis.map((p) => (
              <Field key={p.papel} label={p.rotulo} htmlFor={`tenda-${p.papel}`} hint={totaisTenda[p.papel] === undefined ? "padrão × tendas" : "ajustado"}>
                <Stepper id={`tenda-${p.papel}`} valor={totalTenda(p)} min={0} max={10_000} onChange={(v) => setTotaisTenda((t) => ({ ...t, [p.papel]: v }))} label={`${p.rotulo} no local`} />
                {/* Só vai para o servidor quando algo muda do padrão, e aí vão todos os totais (o quadro zera o que não vier). */}
                {tendaAjustada && <input type="hidden" name={`tenda_${p.papel}`} value={totalTenda(p)} />}
              </Field>
            ))}
          </div>
        </div>
      )}
      <Field label="Área" htmlFor="areaId" optional>
        <Select id="areaId" name="areaId" defaultValue="" opcoes={[{ value: "", label: "Logística (sem área)" }, ...areas.map((a) => ({ value: a.id, label: a.nome }))]} />
      </Field>
      {exigeJustificativa && (
        // Obrigatória no servidor: o "*" como nos outros diálogos depois da ata (auditoria 30/10, B-32).
        <Field label="Justificativa" htmlFor="justificativa" error={campos?.justificativa} obrigatorio>
          <Textarea id="justificativa" name="justificativa" required placeholder="Por que esta linha entra fora de uma solicitação. Fica no histórico e a área é avisada." />
        </Field>
      )}
      <FormError message={!state.ok ? state.erro : null} />
      <DialogFooter>
        <SubmitButton size="lg">{rotuloEnviar}</SubmitButton>
        <Button variant="secondary" size="lg" onClick={onDone}>
          Cancelar
        </Button>
      </DialogFooter>
    </ActionForm>
  );
}
