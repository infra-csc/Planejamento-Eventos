"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input } from "@/components/ui/field";
import { toast, toastErro } from "@/components/ui/toast";
import { salvarConfigAction } from "@/app/(app)/admin/actions";

type Valores = Record<string, string>;

const LINHAS: Array<{ chave: string; titulo: string; descricao: string; unidade: string; min: number; max: number }> = [
  { chave: "sla_resposta_horas", titulo: "Prazo padrão de resposta", descricao: "Tempo para a logística responder uma alteração pós-ata, contado a partir do envio.", unidade: "h", min: 1, max: 720 },
  { chave: "aviso_prazo_horas", titulo: "Aviso de prazo próximo", descricao: "A logística é avisada quando faltar este tempo para vencer.", unidade: "h", min: 0, max: 168 },
  { chave: "antecedencia_reuniao_horas", titulo: "Antecedência da reunião de OS", descricao: "Envios pré-reunião encerram este tempo antes da reunião. 0 = até a reunião começar.", unidade: "h", min: 0, max: 168 },
  { chave: "lembrete_reuniao_dias", titulo: "Lembrete de reunião", descricao: "Áreas sem envio são lembradas este número de dias antes.", unidade: "dias", min: 0, max: 30 },
];

export function ConfigPainel({ valores }: { valores: Valores }) {
  const [v, setV] = useState<Valores>(valores);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const mudou = JSON.stringify(v) !== JSON.stringify(valores);

  const salvar = () =>
    iniciar(async () => {
      const r = await salvarConfigAction({ ...Object.fromEntries(LINHAS.map((l) => [l.chave, Number(v[l.chave])])), bloquear_encerramento_com_pendentes: v.bloquear_encerramento_com_pendentes === "true" });
      if (!r.ok) {
        setErros(r.campos ?? {});
        toastErro(r.erro);
        return;
      }
      setErros({});
      toast(r.mensagem ?? "Configurações salvas");
    });

  return (
    <div className="max-w-3xl overflow-hidden rounded-cartao border border-line bg-surface">
      {LINHAS.map((l) => (
        <div key={l.chave} className="flex items-center gap-6 border-b border-line-row px-cartao py-4">
          <label htmlFor={l.chave} className="min-w-0 flex-1">
            <span className="block text-corpo font-medium text-ink">{l.titulo}</span>
            <span className="mt-0.5 block text-pequeno text-muted">{l.descricao}</span>
            {erros[l.chave] && (
              <span id={`${l.chave}-erro`} className="mt-1 block text-pequeno text-danger">
                {erros[l.chave]}
              </span>
            )}
          </label>
          <span className="flex shrink-0 items-center gap-2">
            <Input id={l.chave} type="number" min={l.min} max={l.max} value={v[l.chave] ?? ""} aria-invalid={Boolean(erros[l.chave])} aria-describedby={erros[l.chave] ? `${l.chave}-erro` : undefined} onChange={(e) => setV({ ...v, [l.chave]: e.target.value })} className="numero w-[84px] px-2.5 text-right" />
            <span className="w-8 text-pequeno text-muted">{l.unidade}</span>
          </span>
        </div>
      ))}
      <div className="border-b border-line-row px-cartao py-4">
        <Checkbox id="bloquear" label="Bloquear encerramento com solicitações abertas" description="Recomendado. Desmarcado, a logística encerra mesmo com itens sem resposta." checked={v.bloquear_encerramento_com_pendentes === "true"} onChange={(marcado) => setV({ ...v, bloquear_encerramento_com_pendentes: String(marcado) })} />
      </div>
      <div className="flex items-center gap-6 border-b border-line-row px-cartao py-4">
        <span className="min-w-0 flex-1">
          <span className="block text-corpo font-medium text-ink">Reabertura de evento</span>
          <span className="mt-0.5 block text-pequeno text-muted">Só a Gestão reabre um evento encerrado, com justificativa registrada no histórico.</span>
        </span>
        <Badge tom="rascunho">Restrita</Badge>
      </div>
      <div className="flex items-center justify-end gap-3 bg-subtle px-cartao py-3">
        {mudou && <span className="text-pequeno text-muted">alterações não salvas</span>}
        <Button variant="primary" size="md" loading={pendente} disabled={!mudou} onClick={salvar}>
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
