"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Field, Input, Textarea } from "@/components/ui/field";
import { RotuloGrupo } from "@/components/ui/layout";
import { salvarDadosReuniaoAutoAction } from "@/app/(app)/eventos/actions";

export type DadosReuniaoValores = {
  reuniaoPresentes: string | null;
  publicoEsperado: number | null;
  caminhaoCarrega: string | null;
  caminhaoSai: string | null;
  arenaDescarrega: string | null;
  kitDescarrega: string | null;
};

type Estado = "ocioso" | "salvando" | "salvo" | "erro";
type Textos = Record<keyof DadosReuniaoValores, string>;

const paraTextos = (v: DadosReuniaoValores): Textos => ({
  reuniaoPresentes: v.reuniaoPresentes ?? "",
  publicoEsperado: v.publicoEsperado == null ? "" : String(v.publicoEsperado),
  caminhaoCarrega: v.caminhaoCarrega ?? "",
  caminhaoSai: v.caminhaoSai ?? "",
  arenaDescarrega: v.arenaDescarrega ?? "",
  kitDescarrega: v.kitDescarrega ?? "",
});

/**
 * Campos da ata que a logística preenche na reunião (os mesmos da planilha de ata):
 * presentes, público esperado e a logística de carga/descarga. Congelam no fechamento.
 * Salvam sozinhos ao digitar, como as observações: ninguém fica bloqueado no fechamento
 * por ter digitado os presentes e não ter clicado em "salvar".
 */
export function DadosReuniaoForm({ eventoId, valores, editavel, onSalvo }: { eventoId: string; valores: DadosReuniaoValores; editavel: boolean; onSalvo?: (v: Textos) => void }) {
  const [t, setT] = useState<Textos>(() => paraTextos(valores));
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Partial<Record<keyof Textos, string>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoSalvo = useRef(JSON.stringify(paraTextos(valores)));
  const ultimoPedido = useRef(0);

  const salvar = async (atual: Textos) => {
    const chave = JSON.stringify(atual);
    if (chave === ultimoSalvo.current) {
      setEstado("salvo");
      return;
    }
    const n = ++ultimoPedido.current;
    setEstado("salvando");
    const r = await salvarDadosReuniaoAutoAction(eventoId, atual);
    if (n !== ultimoPedido.current) return; // já houve outra gravação depois desta
    if (r.ok) {
      ultimoSalvo.current = chave;
      setEstado("salvo");
      setErro(null);
      setCampos({});
      onSalvo?.(atual);
    } else {
      setEstado("erro");
      setErro(r.erro);
      setCampos(r.campos ?? {});
    }
  };

  const mudar = (nome: keyof Textos, valor: string) => {
    const prox = { ...t, [nome]: valor };
    setT(prox);
    setEstado("ocioso");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvar(prox), 900);
  };
  const aoSair = () => {
    if (timer.current) clearTimeout(timer.current);
    void salvar(t);
  };

  const campo = (nome: keyof Textos, label: string, placeholder: string, hint?: string) => (
    <Field label={label} htmlFor={nome} error={campos[nome]} hint={hint}>
      <Input id={nome} name={nome} value={t[nome]} onChange={(e) => mudar(nome, e.target.value)} onBlur={aoSair} placeholder={placeholder} disabled={!editavel} />
    </Field>
  );

  return (
    <div className="space-y-3.5 px-cartao py-3.5">
      <Field label="Pessoas presentes" htmlFor="reuniaoPresentes" error={campos.reuniaoPresentes} hint="Obrigatório para fechar a ata. Nome e área, separados por vírgula." obrigatorio>
        <Textarea id="reuniaoPresentes" name="reuniaoPresentes" value={t.reuniaoPresentes} onChange={(e) => mudar("reuniaoPresentes", e.target.value)} onBlur={aoSair} disabled={!editavel} placeholder="Ex.: Marina (Logística), Paulo (Produção), Júlia (Ativação)" className="min-h-[72px]" />
      </Field>
      <RotuloGrupo className="!mb-0">Carga e público · opcionais</RotuloGrupo>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        {campo("publicoEsperado", "Público esperado", "Ex.: 11000")}
        {campo("caminhaoCarrega", "Caminhão carrega", "Ex.: 08/06 às 14h")}
        {campo("caminhaoSai", "Caminhão sai", "Ex.: 09/06 às 6h")}
        {campo("arenaDescarrega", "Arena descarrega", "Ex.: 09/06 às 22h")}
        {campo("kitDescarrega", "Kit descarrega", "Ex.: 10/06 às 8h", "Kit = material de consumo")}
      </div>
      {editavel && (
        <p className={cn("mb-0 mt-1 text-rotulo", estado === "erro" ? "text-danger" : "text-muted")} aria-live="polite">
          {estado === "salvando" ? "salvando…" : estado === "erro" ? `não foi possível salvar — ${erro}` : estado === "salvo" ? "salvo automaticamente" : "salvo automaticamente ao digitar"}
        </p>
      )}
    </div>
  );
}
