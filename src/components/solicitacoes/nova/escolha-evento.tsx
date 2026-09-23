"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";
import { Tag } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { Passo } from "./passo";
import type { EventoOpcao } from "./tipos";

/** Passo 1: área solicitante (só Administrador) e escolha do evento. */
export function EscolhaEvento({
  temRascunho,
  eventos,
  evento,
  eventoId,
  ehAlteracao,
  areas,
  areaId,
  setAreaId,
  trocandoEvento,
  setTrocandoEvento,
  tentouEnviar,
  slaHoras,
  escolherEvento,
}: {
  temRascunho: boolean;
  eventos: EventoOpcao[];
  evento: EventoOpcao | null;
  eventoId: string | null;
  ehAlteracao: boolean;
  areas: Array<{ id: string; nome: string }> | null;
  areaId: string | null;
  setAreaId: (v: string | null) => void;
  trocandoEvento: boolean;
  setTrocandoEvento: (v: boolean) => void;
  tentouEnviar: boolean;
  slaHoras: number;
  escolherEvento: (e: EventoOpcao) => void;
}) {
  const eventosAceitando = eventos.filter((e) => e.aceita).length;
  const mostrarSeletorEvento = !evento || trocandoEvento;

  return (
    <Passo
      n={1}
      titulo="Evento"
      feito={Boolean(evento) && (!areas || Boolean(areaId))}
      sub={evento && !trocandoEvento ? undefined : "Só aparecem eventos em preparação ou abertos a alterações."}
      acoes={
        evento && !temRascunho && eventosAceitando > 1 ? (
          trocandoEvento ? (
            <Button variant="link" size="sm" onClick={() => setTrocandoEvento(false)}>
              Manter este
            </Button>
          ) : (
            <Button variant="link" size="sm" onClick={() => setTrocandoEvento(true)}>
              Trocar evento
            </Button>
          )
        ) : undefined
      }
    >
      {areas && (
        <div className="border-b border-line-soft px-cartao py-3.5">
          <Field label="Área solicitante" htmlFor="area-solicitante" obrigatorio hint="Você está pedindo como administrador, em nome desta área." error={tentouEnviar && !areaId ? "Escolha a área que está pedindo." : null}>
            <Select id="area-solicitante" value={areaId ?? ""} disabled={temRascunho} onValueChange={(v) => setAreaId(v || null)} invalid={tentouEnviar && !areaId} placeholder="Selecione a área" className="sm:max-w-[320px]" opcoes={areas.map((a) => ({ value: a.id, label: a.nome }))} />
          </Field>
        </div>
      )}
      {eventos.length === 0 ? (
        <EmptyState compact title="Nenhum evento aceitando solicitações agora" description="Solicitações entram com o evento em preparação (antes da reunião) ou depois que a ata é fechada. Fale com a logística se o seu evento não aparece." />
      ) : (
        <div className="flex flex-col gap-3 px-cartao py-3.5">
          {mostrarSeletorEvento && (
            <Field label="Evento" htmlFor="evento" obrigatorio error={tentouEnviar && !evento ? "Escolha o evento para enviar. Os itens já adicionados continuam na lista." : null}>
              <ComboBox
                id="evento"
                value={eventoId}
                disabled={temRascunho}
                invalid={tentouEnviar && !evento}
                placeholder="Buscar evento por nome, código ou cliente"
                onChange={(id) => {
                  const e = eventos.find((x) => x.id === id);
                  if (e) escolherEvento(e);
                }}
                opcoes={eventos.map((e) => ({
                  value: e.id,
                  label: e.nome,
                  descricao: `${e.codigo} · ${e.cliente} · ${e.periodo} · ${e.marco}`,
                  selo: e.tipo === "PRE_REUNIAO" ? "até a reunião" : "alterações",
                  seloTom: e.tipo === "PRE_REUNIAO" ? "muted" : "warning",
                  disabled: !e.aceita && e.id !== eventoId,
                }))}
              />
            </Field>
          )}
          {evento && (
            <div className={cn("flex flex-wrap items-start gap-x-4 gap-y-2", trocandoEvento && "rounded-controle border border-line-soft bg-subtle px-3 py-2.5")}>
              <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-corpo font-medium text-ink">
                  {evento.nome}
                  <Tag tom={ehAlteracao ? "warning" : "muted"}>{ehAlteracao ? "alteração pós-ata" : "pré-reunião"}</Tag>
                </p>
                <p className="mb-0 mt-0.5 text-pequeno text-muted">
                  <Codigo>{evento.codigo}</Codigo> · {evento.cliente} · <span className="numero">{evento.periodo}</span> · <span className="numero">{evento.marco}</span>
                </p>
              </div>
              <p className="m-0 flex items-center gap-1.5 text-pequeno text-ink-2">
                <Icone nome="relogio" className="text-ink-3" />
                {ehAlteracao ? (
                  <span>
                    Resposta em até <span className="numero font-medium">{slaHoras}h</span> após o envio
                  </span>
                ) : (
                  "Pedidos até a reunião começar"
                )}
              </p>
              {temRascunho && <p className="m-0 basis-full text-pequeno text-meta">Para trocar de evento, exclua este rascunho e crie outro.</p>}
            </div>
          )}
        </div>
      )}
    </Passo>
  );
}
