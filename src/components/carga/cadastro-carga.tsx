"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/layout";
import { Codigo } from "@/components/ui/numero";
import { normalizarTexto, somarDias } from "@/domain/carga-descarga";
import type { EventoCargaView, VeiculoCargaView } from "@/server/services/carga-descarga";
import { ContagemVeiculos, diaCurto } from "./base";
import { CargaDoEvento } from "./carga-evento";
import { ImportarCarga } from "./importar-carga";

type EventoLista = EventoCargaView;

/**
 * Cadastro do galpão (logística e administrador): à esquerda os eventos com quantos veículos cada um
 * tem (os próximos primeiro; os que passaram há mais de uma semana ficam escondidos), à direita os
 * veículos do evento escolhido. Mostra de cara quais eventos ainda não têm caminhão.
 */
export function CadastroCarga({ eventos, veiculos, podeEditar, podeCriarEvento, hoje, eventoInicial }: { eventos: readonly EventoLista[]; veiculos: readonly VeiculoCargaView[]; podeEditar: boolean; podeCriarEvento: boolean; hoje: string; eventoInicial: string | null }) {
  const [selecionado, setSelecionado] = useState<string | null>(eventoInicial && eventos.some((e) => e.id === eventoInicial) ? eventoInicial : null);
  const [busca, setBusca] = useState("");
  const [passados, setPassados] = useState(false);
  const [semVeiculo, setSemVeiculo] = useState(false);

  const porEvento = useMemo(() => {
    const m = new Map<string, VeiculoCargaView[]>();
    for (const v of veiculos) m.set(v.eventoId, [...(m.get(v.eventoId) ?? []), v]);
    return m;
  }, [veiculos]);

  // A volta cai dias depois do evento: o evento da semana passada ainda conta como "próximo".
  const corte = somarDias(hoje, -7);
  const termo = normalizarTexto(busca);
  // Cancelado com veículo fica à vista mesmo passado: tem caminhão a liberar (auditoria 30/10, parte D N2).
  const lista = eventos
    .filter((e) => passados || e.data >= corte || e.id === selecionado || e.cancelado)
    .filter((e) => !semVeiculo || !porEvento.has(e.id))
    .filter((e) => !termo || normalizarTexto(`${e.nome} ${e.codigo} ${e.local ?? ""}`).includes(termo))
    .sort((a, b) => (passados ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data)) || a.nome.localeCompare(b.nome, "pt-BR"));
  const proximosSemVeiculo = eventos.filter((e) => e.ativo && e.data >= hoje && e.data <= somarDias(hoje, 30) && !porEvento.has(e.id)).length;

  // Link compartilhável sem recarregar a página. No celular é lista OU evento: escolher leva ao topo do painel.
  const escolher = (id: string | null) => {
    setSelecionado(id);
    window.history.replaceState(null, "", id ? `?evento=${id}` : window.location.pathname);
    window.scrollTo({ top: 0 });
  };

  const evento = selecionado ? eventos.find((e) => e.id === selecionado) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {podeEditar && (
        <div className={cn(selecionado && "max-md:hidden")}>
          <ImportarCarga />
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <section aria-label="Eventos" className={cn("overflow-hidden rounded-cartao border border-line bg-surface md:sticky md:top-[72px]", selecionado && "max-md:hidden")}>
          <header className="flex flex-col gap-2.5 border-b border-line-soft px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-corpo font-semibold">Eventos</h2>
              {podeCriarEvento && (
                <ButtonLink href="/eventos/novo" variant="secondary" size="sm">
                  <Icone nome="mais" />
                  Novo evento
                </ButtonLink>
              )}
            </div>
            <div className="relative">
              <Icone nome="busca" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input type="search" aria-label="Filtrar eventos" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setBusca("")} placeholder="Filtrar eventos" className="!pl-8" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-pequeno text-ink-2 max-md:min-h-10">
                <input type="checkbox" checked={semVeiculo} onChange={(e) => setSemVeiculo(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
                Só sem veículo
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-pequeno text-ink-2 max-md:min-h-10" title="Eventos de mais de uma semana atrás">
                <input type="checkbox" checked={passados} onChange={(e) => setPassados(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
                Mostrar eventos passados
              </label>
            </div>
            {proximosSemVeiculo > 0 && (
              <p className="m-0 flex items-center gap-1.5 text-pequeno text-warning">
                <Icone nome="alerta" className="size-4 shrink-0" />
                {proximosSemVeiculo} {proximosSemVeiculo === 1 ? "evento" : "eventos"} nos próximos 30 dias sem veículo
              </p>
            )}
          </header>
          {lista.length === 0 ? (
            <p className="m-0 px-3.5 py-6 text-center text-pequeno text-muted">{termo ? "Nenhum evento com esse nome." : semVeiculo ? "Todos os eventos da lista já têm veículo." : "Nenhum evento por vir."}</p>
          ) : (
            <ul className="m-0 max-h-[min(70vh,640px)] list-none overflow-y-auto p-1.5">
              {lista.map((e) => {
                const vs = porEvento.get(e.id) ?? [];
                const ativo = e.id === selecionado;
                const passou = e.data < hoje;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-current={ativo ? "true" : undefined}
                      onClick={() => escolher(e.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 rounded-controle border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                        ativo ? "border-accent-border bg-selected" : "border-transparent bg-transparent hover:bg-subtle",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-pequeno font-semibold leading-snug", passou ? "text-ink-2" : "text-ink")}>{e.nome}</span>
                        <span className="numero mt-0.5 block text-rotulo text-muted">
                          {diaCurto(e.data)} · {e.codigo}
                          {!e.ativo && !e.cancelado && " · encerrado"}
                        </span>
                        {e.cancelado && <span className="mt-0.5 block text-rotulo font-medium text-danger">Cancelado · libere o caminhão</span>}
                      </span>
                      {vs.length ? (
                        <ContagemVeiculos tipos={vs.map((v) => v.tipo)} className="shrink-0 justify-end pt-0.5" />
                      ) : (
                        <span className={cn("shrink-0 pt-0.5 text-rotulo", e.ativo && !passou ? "font-medium text-warning" : "text-meta")}>sem veículo</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className={cn("min-w-0", !selecionado && "max-md:hidden")}>
          {evento && (
            <Button variant="ghost" size="sm" className="mb-2 md:hidden" onClick={() => escolher(null)}>
              <Icone nome="chevron-esquerda" />
              Todos os eventos
            </Button>
          )}
          {evento ? (
            <CargaDoEvento
              key={evento.id}
              compacto
              evento={evento}
              eventos={eventos}
              veiculos={porEvento.get(evento.id) ?? []}
              podeEditar={podeEditar}
              cabecalho={
                <h2 className="m-0 flex flex-wrap items-baseline gap-x-2 text-secao font-semibold tracking-[-0.01em]">
                  {evento.nome}
                  <span className="numero text-pequeno font-normal text-muted">
                    <Codigo>{evento.codigo}</Codigo> · evento {diaCurto(evento.data).toLowerCase()}
                  </span>
                </h2>
              }
            />
          ) : (
            <section className="rounded-cartao border border-line bg-surface">
              <EmptyState icone="caminhao" title="Escolha um evento" description="Selecione um evento na lista para ver e cadastrar os veículos de ida e volta. Os que ainda não têm caminhão aparecem como “sem veículo”." />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
