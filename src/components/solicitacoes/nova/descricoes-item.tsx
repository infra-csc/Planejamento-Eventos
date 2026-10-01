"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { ajustarDescricoes, descricoesEsperadas, TAMANHO_DESCRICAO } from "@/domain/descricoes-itens";
import { ErroCampo } from "./passo";
import type { ItemNovo } from "./tipos";

/** Acima disto, a lista de unidades começa recolhida (mostra as primeiras). */
const RECOLHER_ACIMA = 8;
const VISIVEIS_RECOLHIDO = 6;

/**
 * Cada unidade adicionada tem a descrição (texto, arte, medida): 10 pedidas, 10 linhas numeradas.
 * Acima de 50 unidades, uma linha só vale para todas. A descrição é obrigatória para enviar.
 * Nem todo item precisa disso (20 grades iguais): quem pede marca "não precisa descrever cada unidade".
 * O "onde vai ficar" saiu da tela a pedido do time (o local das tendas vem do quadro de tendas).
 */
export function DescricoesItem({ item, destacarVazias, onChange }: { item: ItemNovo; destacarVazias: boolean; onChange: (patch: { descricoes?: string[]; locais?: string[]; semDescricao?: boolean }) => void }) {
  const [expandido, setExpandido] = useState(false);
  const esperadasComDescricao = descricoesEsperadas(item.operacao, item.quantidade);
  if (!esperadasComDescricao) return null;
  const idDispensa = `sem-descricao-${item.chave}`;
  const dispensa = (
    <Checkbox
      id={idDispensa}
      label="Não precisa descrever cada unidade"
      checked={Boolean(item.semDescricao)}
      onChange={(marcado) =>
        onChange(marcado ? { semDescricao: true, locais: [item.locais[0] ?? ""] } : { semDescricao: false, locais: Array.from({ length: esperadasComDescricao }, () => item.locais[0] ?? "") })
      }
    />
  );
  if (item.semDescricao) {
    return (
      <div id={`descricoes-${item.chave}`} tabIndex={-1} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-controle border border-line-soft bg-subtle px-3 py-2.5 focus:outline-none sm:ml-[76px]">
        {dispensa}
      </div>
    );
  }
  const esperadas = esperadasComDescricao;
  const lista = ajustarDescricoes(item.descricoes, esperadas);
  const locais = ajustarDescricoes(item.locais, esperadas);
  const vazias = lista.filter((d) => !d.trim()).length;
  const unica = esperadas === 1;
  const definir = (n: number, v: string) => onChange({ descricoes: lista.map((d, k) => (k === n ? v : d)) });
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
        {dispensa}
        {!unica && (
          <span className={cn("numero text-rotulo", vazias === 0 ? "text-success" : "text-muted")}>
            {esperadas - vazias} de {esperadas} descritas
          </span>
        )}
        {!unica && lista[0].trim() && vazias > 0 ? (
          <Button
            variant="link"
            size="xs"
            className="ml-auto"
            onClick={() => onChange({ descricoes: lista.map((d) => (d.trim() ? d : lista[0])) })}
          >
            Repetir a 1ª nas vazias
          </Button>
        ) : null}
      </div>
      <ol className="m-0 grid list-none gap-1.5 p-0">
        {mostradas.map((d, n) => (
          <li key={n} className="flex flex-wrap items-center gap-2">
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
              className="min-w-[200px] flex-1"
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
