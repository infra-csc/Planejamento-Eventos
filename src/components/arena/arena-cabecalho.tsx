"use client";

import type { Arena } from "@/domain/arena/tipos";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meta, PageHeader } from "@/components/ui/layout";

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** Cabeçalho compacto (tamanho "sm"): lido uma vez, não pode roubar altura do mapa para sempre. */
export function CabecalhoArena({
  arena,
  totalDivergencias,
  conferenciaAtiva,
  onAlternarConferencia,
}: {
  arena: Arena;
  totalDivergencias: number;
  conferenciaAtiva: boolean;
  onAlternarConferencia: () => void;
}) {
  return (
    <PageHeader
      tamanho="sm"
      title={arena.evento.nome}
      eyebrow={<span className="font-mono">{arena.evento.sku}</span>}
      meta={
        <>
          {arena.evento.data && <Meta rotulo={arena.evento.largadas.length > 0 ? "Prova" : "Data"} valor={DATA.format(new Date(`${arena.evento.data}T12:00:00Z`))} mono />}
          {arena.evento.largadas.length > 0 && <Meta rotulo="Largadas" valor={arena.evento.largadas.map((l) => `${l.distancia} ${l.hora}`).join(" · ")} mono />}
          {arena.evento.largadas.length === 0 && arena.evento.local && <Meta rotulo="Local" valor={arena.evento.local} />}
          {arena.evento.publicoEsperado && <Meta rotulo="Público" valor={<span className="tabular-nums">{arena.evento.publicoEsperado.toLocaleString("pt-BR")}</span>} mono />}
          {arena.evento.diretorProva && <Meta rotulo="Direção" valor={arena.evento.diretorProva} />}
        </>
      }
      actions={
        totalDivergencias === 0 ? (
          arena.pontos.length > 0 && <Badge tom="success">Planta e ata conferidas</Badge>
        ) : (
          <Button variant="parcial" size="sm" aria-pressed={conferenciaAtiva} onClick={onAlternarConferencia} className="aria-pressed:border-warning aria-pressed:bg-warning aria-pressed:text-white">
            <span aria-hidden className={cn("block size-1.5 animate-pulse-dot rounded-full", conferenciaAtiva ? "bg-warning-bg" : "bg-danger")} />
            {totalDivergencias} {totalDivergencias === 1 ? "item a conferir" : "itens a conferir"}
          </Button>
        )
      }
    />
  );
}
