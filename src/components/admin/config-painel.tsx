"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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
        toast(r.erro);
        return;
      }
      setErros({});
      toast(r.mensagem ?? "Configurações salvas");
    });

  return (
    <div className="max-w-[780px] overflow-hidden rounded-[10px] border border-line bg-surface">
      {LINHAS.map((l) => (
        <div key={l.chave} className="flex items-center gap-6 border-b border-line-row px-[18px] py-4">
          <label htmlFor={l.chave} className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-ink">{l.titulo}</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">{l.descricao}</span>
            {erros[l.chave] && <span className="mt-1 block text-[12px] text-danger">{erros[l.chave]}</span>}
          </label>
          <span className="flex shrink-0 items-center gap-2">
            <input
              id={l.chave}
              type="number"
              min={l.min}
              max={l.max}
              value={v[l.chave] ?? ""}
              onChange={(e) => setV({ ...v, [l.chave]: e.target.value })}
              className="h-9 w-[84px] rounded-lg border border-line-control bg-surface px-2.5 text-right font-mono text-[13.5px] focus:border-accent focus:outline-none"
            />
            <span className="w-8 text-[12.5px] text-muted">{l.unidade}</span>
          </span>
        </div>
      ))}
      <div className="flex items-center gap-6 border-b border-line-row px-[18px] py-4">
        <label htmlFor="bloquear" className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink">Bloquear encerramento com solicitações abertas</span>
          <span className="mt-0.5 block text-[12.5px] text-muted">Recomendado. Desmarcado, a logística encerra mesmo com itens sem resposta.</span>
        </label>
        <input id="bloquear" type="checkbox" checked={v.bloquear_encerramento_com_pendentes === "true"} onChange={(e) => setV({ ...v, bloquear_encerramento_com_pendentes: String(e.target.checked) })} className="size-[17px] accent-accent" />
      </div>
      <div className="flex items-center gap-6 border-b border-line-row px-[18px] py-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink">Reabertura de evento</span>
          <span className="mt-0.5 block text-[12.5px] text-muted">Só a Gestão reabre um evento encerrado, com justificativa registrada no histórico.</span>
        </span>
        <span className="rounded-[5px] bg-neutral-bg px-2 py-0.5 text-[12px] font-medium text-ink-3">restrita</span>
      </div>
      <div className="flex items-center justify-end gap-3 bg-subtle px-[18px] py-3">
        {mudou && <span className="text-[12px] text-muted">alterações não salvas</span>}
        <Button variant="primary" size="md" loading={pendente} disabled={!mudou} onClick={salvar}>
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
