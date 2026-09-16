"use client";

import { SETORES } from "@/domain/constantes";
import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useMemo, useState } from "react";
import { salvarProjetoAction } from "@/app/(app)/projetos/actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Button, ButtonLink, SubmitButton } from "@/components/ui/button";
import { Notice, Panel, TableWrap } from "@/components/ui/layout";
import { SETOR_LABEL } from "@/domain/os";
import { ESTADO_INICIAL } from "@/lib/action";
import type { Setor } from "@/server/db/schema";

export type PecaOpcao = { id: string; codigo: string; nome: string; setor: Setor; unidade: string; permiteEmProjeto: boolean };
type Linha = { pecaId: string; quantidade: number };

export function ProjetoForm({
  valores,
  pecas,
  cancelarHref,
  onCancelar,
  voltarPara,
}: {
  valores: { id?: string; nome?: string; categoria?: string; descricao?: string | null; itens: Linha[]; versaoAtual?: number };
  pecas: PecaOpcao[];
  cancelarHref: string;
  /** Dentro de um modal: cancelar fecha em vez de navegar. */
  onCancelar?: () => void;
  /** Para onde ir depois de salvar (padrão: página do projeto). */
  voltarPara?: string;
}) {
  const [state, action] = useActionState(salvarProjetoAction, ESTADO_INICIAL);
  const [itens, setItens] = useState<Linha[]>(valores.itens);
  const [novaPeca, setNovaPeca] = useState("");
  const [novaQtd, setNovaQtd] = useState(1);
  const c = !state.ok ? state.campos : undefined;
  const mapa = useMemo(() => new Map(pecas.map((p) => [p.id, p])), [pecas]);
  const disponiveis = pecas.filter((p) => p.permiteEmProjeto && !itens.some((i) => i.pecaId === p.id));
  const bomMudou = useMemo(() => {
    const k = (l: Linha[]) => l.map((i) => `${i.pecaId}:${i.quantidade}`).sort().join("|");
    return k(itens) !== k(valores.itens);
  }, [itens, valores.itens]);

  const adicionar = () => {
    if (!novaPeca || novaQtd <= 0) return;
    setItens((l) => [...l, { pecaId: novaPeca, quantidade: Math.floor(novaQtd) }]);
    setNovaPeca("");
    setNovaQtd(1);
  };

  return (
    <ActionForm action={action} noValidate className="space-y-4">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      {voltarPara && <input type="hidden" name="voltarPara" value={voltarPara} />}
      <input type="hidden" name="itens" value={JSON.stringify(itens)} />
      <Panel title="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="nome" error={c?.nome}>
            <Input id="nome" name="nome" defaultValue={valores.nome ?? ""} required autoFocus placeholder="Ex.: Pórtico boca 6,60m" />
          </Field>
          <Field label="Categoria" htmlFor="categoria" optional hint="Pórtico, Palco, Torre, Tenda, Balcão…">
            <Input id="categoria" name="categoria" defaultValue={valores.categoria ?? ""} list="categorias" />
            <datalist id="categorias">
              {["Pórtico", "Palco", "Torre", "Tenda", "Balcão", "Camarim", "Painel"].map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Descrição" htmlFor="descricao" optional className="sm:col-span-2">
            <Textarea id="descricao" name="descricao" defaultValue={valores.descricao ?? ""} placeholder="Dimensões, uso típico, observações de montagem." />
          </Field>
        </div>
      </Panel>

      <Panel title="Lista de peças (BOM)" description="Quantidade de cada peça para montar UMA unidade do projeto. Peças marcadas como “sempre avulsas” não aparecem aqui." padded={false}>
        {itens.length > 0 && (
          <TableWrap>
            <table className="w-full border-collapse text-[13px] [&_td]:border-t [&_td]:border-line-row [&_td]:px-3 [&_td]:py-2 [&_th]:bg-subtle [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-medium [&_th]:text-muted">
              <thead>
                <tr>
                  <th>Setor</th>
                  <th>Peça</th>
                  <th className="num w-32">Quantidade</th>
                  <th className="w-px"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i, idx) => {
                  const p = mapa.get(i.pecaId);
                  return (
                    <tr key={i.pecaId}>
                      <td className="text-muted">{p ? SETOR_LABEL[p.setor] : "—"}</td>
                      <td>
                        <span className="font-medium font-mono">{p?.codigo}</span> · {p?.nome}
                      </td>
                      <td className="num">
                        <Input type="number" min={1} value={i.quantidade} aria-label={`Quantidade de ${p?.nome}`} onChange={(e) => setItens((l) => l.map((x, j) => (j === idx ? { ...x, quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)))} className="h-8 w-24 text-right" />
                      </td>
                      <td>
                        <Button size="sm" variant="ghost" className="text-danger" aria-label={`Remover ${p?.nome}`} onClick={() => setItens((l) => l.filter((_, j) => j !== idx))}>
                          Remover
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
          <Field label="Adicionar peça" htmlFor="novaPeca" className="min-w-64 flex-1">
            <Select id="novaPeca" value={novaPeca} onChange={(e) => setNovaPeca(e.target.value)}>
              <option value="">Selecione uma peça</option>
              {SETORES.map((s) => (
                <optgroup key={s} label={SETOR_LABEL[s]}>
                  {disponiveis
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
          <Field label="Qtd." htmlFor="novaQtd" className="w-24">
            <Input id="novaQtd" type="number" min={1} value={novaQtd} onChange={(e) => setNovaQtd(Number(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }} />
          </Field>
          <Button onClick={adicionar} disabled={!novaPeca}>
            Adicionar
          </Button>
        </div>
        {c?.itens && <p className="px-[18px] pb-3 text-[12px] text-danger">{c.itens}</p>}
      </Panel>

      {valores.id && bomMudou && (
        <Panel title={`Nova versão (v${(valores.versaoAtual ?? 1) + 1})`} description="A lista de peças mudou. Eventos que já usam este projeto mantêm a versão anterior até a logística decidir atualizar.">
          <Field label="O que mudou" htmlFor="observacaoVersao" optional>
            <Input id="observacaoVersao" name="observacaoVersao" placeholder="Ex.: incluída sapata de base; parafusos ajustados para 140" />
          </Field>
        </Panel>
      )}
      {valores.id && !bomMudou && <Notice tone="info">Sem mudança na lista de peças: os dados serão atualizados sem criar nova versão.</Notice>}

      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton>{valores.id ? (bomMudou ? "Salvar como nova versão" : "Salvar") : "Criar projeto"}</SubmitButton>
        {onCancelar ? (
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        ) : (
          <ButtonLink href={cancelarHref} variant="ghost">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </ActionForm>
  );
}
