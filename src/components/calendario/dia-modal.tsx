"use client";

import { useState } from "react";
import Link from "next/link";
import type { ItemCalendario } from "@/server/services/calendario";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Codigo } from "@/components/ui/numero";
import { IndicadorLink } from "@/components/ui/indicador-link";
import { diaMes, rotuloDia, semPrefixo, somarDias, TIPO } from "./tipos";

/**
 * O número do dia na grade abre um resumo do dia: cada compromisso com o nome inteiro (na grade o
 * texto é curto), e nos eventos de vários dias em que dia da faixa estamos e o período completo.
 */
export function DiaBotao({ dia, numero, hoje, doMes, itens }: { dia: string; numero: number; hoje: string; doMes: boolean; itens: ItemCalendario[] }) {
  const [aberto, setAberto] = useState(false);
  const ehHoje = dia === hoje;
  const n = itens.length;
  const resumo = n === 0 ? "nada marcado" : `${n} ${n === 1 ? "compromisso" : "compromissos"}`;
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Resumo de ${rotuloDia(dia)}${ehHoje ? ", hoje" : ""}: ${resumo}`}
        title="Ver o resumo do dia"
        className={cn(
          "numero inline-flex size-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-pequeno transition-colors",
          ehHoje ? "bg-accent font-semibold text-white hover:bg-accent-hover" : doMes ? "font-medium text-ink hover:bg-control" : "text-meta hover:bg-control",
        )}
      >
        {numero}
      </button>
      {aberto && (
        <DialogContent title={`${rotuloDia(dia)}${ehHoje ? " · hoje" : ""}`} description={resumo} size="md" className="max-sm:max-h-[calc(100dvh-24px)]">
          {n === 0 ? (
            <p className="m-0 py-2 text-corpo text-muted">Nenhum compromisso neste dia.</p>
          ) : (
            <ul className="-mx-5 -my-4 m-0 list-none divide-y divide-line-row p-0">
              {itens.map((it) => (
                <li key={it.chave}>
                  <Link href={it.href} className="flex items-start gap-3 px-5 py-3 no-underline hover:bg-subtle">
                    <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", TIPO[it.tipo].ponto)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-corpo font-medium text-ink">{it.tipo === "evento" ? it.titulo : semPrefixo(it.titulo)}</span>
                      <span className="mt-0.5 block text-pequeno text-muted">{descricao(it)}</span>
                      {it.tipo === "evento" && it.faixa && it.faixa.total > 1 && <Faixa it={it} />}
                    </span>
                    <IndicadorLink />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function descricao(it: ItemCalendario) {
  const partes = [TIPO[it.tipo].rotulo];
  if (it.hora) partes.push(it.hora);
  if (it.tipo === "evento") {
    partes.push(EVENTO_STATUS_LABEL[it.evento.status]);
    if (it.evento.local) partes.push(it.evento.local);
  } else {
    if (it.detalhe) partes.push(it.detalhe);
    if (it.tipo !== "prazo") partes.push(it.evento.codigo);
  }
  return partes.join(" · ");
}

/** "Dia 2 de 5 · 23/09 a 27/09" com a faixa dos dias do evento e o dia atual marcado. */
function Faixa({ it }: { it: ItemCalendario }) {
  const f = it.faixa!;
  const inicio = somarDias(it.dia, 1 - f.dia);
  const fim = somarDias(it.dia, f.total - f.dia);
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-pequeno text-ink-2">
      <span className="numero">
        Dia {f.dia} de {f.total} · {diaMes(inicio)} a {diaMes(fim)}
      </span>
      <span aria-hidden className="flex gap-0.5">
        {Array.from({ length: Math.min(f.total, 31) }, (_, i) => (
          <span key={i} className={cn("h-1.5 w-2.5 rounded-xs", i + 1 === f.dia ? "bg-accent" : "bg-line-strong")} />
        ))}
      </span>
      <Codigo>{it.evento.codigo}</Codigo>
    </span>
  );
}
