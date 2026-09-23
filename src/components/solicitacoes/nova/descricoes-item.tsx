"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ajustarDescricoes, descricoesEsperadas, TAMANHO_DESCRICAO } from "@/domain/descricoes-itens";
import { ErroCampo } from "./passo";
import type { ItemNovo } from "./tipos";

/** Acima disto, a lista de descrições começa recolhida (mostra as primeiras). */
const RECOLHER_ACIMA = 8;
const VISIVEIS_RECOLHIDO = 6;

/**
 * Descrição de cada unidade adicionada: 10 pedidas, 10 campos numerados (texto, arte, medida de cada uma).
 * Acima de 50 unidades, um campo só vale para todas. Obrigatório para enviar.
 */
export function DescricoesItem({ item, destacarVazias, onChange }: { item: ItemNovo; destacarVazias: boolean; onChange: (d: string[]) => void }) {
  const [expandido, setExpandido] = useState(false);
  const esperadas = descricoesEsperadas(item.operacao, item.quantidade);
  if (!esperadas) return null;
  const lista = ajustarDescricoes(item.descricoes, esperadas);
  const vazias = lista.filter((d) => !d.trim()).length;
  const unica = esperadas === 1;
  const definir = (n: number, v: string) => onChange(lista.map((d, k) => (k === n ? v : d)));
  const recolhivel = esperadas > RECOLHER_ACIMA;
  // Com erro de envio, nada que falta fica escondido.
  const aberto = !recolhivel || expandido || (destacarVazias && lista.slice(VISIVEIS_RECOLHIDO).some((d) => !d.trim()));
  const mostradas = aberto ? lista : lista.slice(0, VISIVEIS_RECOLHIDO);
  const idErro = `descricoes-${item.chave}-erro`;
  const comErro = destacarVazias && vazias > 0;

  return (
    <div id={`descricoes-${item.chave}`} tabIndex={-1} className={cn("mt-3 rounded-controle border bg-subtle px-3 pb-3 pt-2.5 focus:outline-none sm:ml-[76px]", comErro ? "border-danger-border" : "border-line-soft")}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-pequeno font-medium text-ink-2">
          {unica ? (item.quantidade > 1 ? "Descrição (vale para todas as unidades)" : "Descrição") : "Descrição de cada unidade"}
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        </span>
        {!unica && (
          <span className={cn("numero text-rotulo", vazias === 0 ? "text-success" : "text-muted")}>
            {esperadas - vazias} de {esperadas} descritas
          </span>
        )}
        {!unica && lista[0].trim() && vazias > 0 && (
          <Button variant="link" size="xs" className="ml-auto" onClick={() => onChange(lista.map((d) => (d.trim() ? d : lista[0])))}>
            Repetir a 1ª nas vazias
          </Button>
        )}
      </div>
      <ol className={cn("m-0 grid list-none gap-1.5 p-0", !unica && "sm:grid-cols-2")}>
        {mostradas.map((d, n) => (
          <li key={n} className="flex items-center gap-2">
            {!unica && (
              <span aria-hidden className="numero w-6 shrink-0 text-right text-rotulo text-meta">
                {n + 1}
              </span>
            )}
            <Input
              value={d}
              maxLength={TAMANHO_DESCRICAO}
              onChange={(e) => definir(n, e.target.value)}
              aria-label={unica ? `Descrição de ${item.rotulo}` : `Descrição da unidade ${n + 1} de ${item.rotulo}`}
              aria-invalid={destacarVazias && !d.trim() ? true : undefined}
              aria-describedby={comErro ? idErro : undefined}
              placeholder={unica ? "O que é, texto/arte, medida, cor…" : "Texto/arte, medida, cor…"}
              className="min-w-0 flex-1"
            />
          </li>
        ))}
      </ol>
      {recolhivel && !(destacarVazias && lista.slice(VISIVEIS_RECOLHIDO).some((d) => !d.trim())) && (
        <Button variant="link" size="xs" className="mt-2" aria-expanded={aberto} onClick={() => setExpandido((v) => !v)}>
          {aberto ? "Recolher" : `Mostrar as outras ${esperadas - VISIVEIS_RECOLHIDO}`}
        </Button>
      )}
      {comErro && (
        <ErroCampo id={idErro} className="mt-2">
          {vazias === 1 ? "Falta descrever 1 unidade." : `Faltam descrever ${vazias} unidades.`}
        </ErroCampo>
      )}
    </div>
  );
}
