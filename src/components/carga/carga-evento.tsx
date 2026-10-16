"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/layout";
import { Icone } from "@/components/ui/icons";
import { TIPO_VEICULO_LABEL, type EventoCarga } from "@/domain/carga-descarga";
import type { VeiculoCargaView } from "@/server/services/carga-descarga";
import { ContagemVeiculos, IconeVeiculo } from "./base";
import { AcoesVeiculo, TrechosVeiculo } from "./detalhe-veiculo";
import { FormVeiculo } from "./form-veiculo";

/**
 * Aba "Carga" do evento (logística e administrador): os veículos deste evento com a ida e a volta à
 * vista, e o cadastro, a edição, a duplicação e a exclusão. O calendário geral fica em Carga e descarga.
 */
export function CargaDoEvento({ evento, eventos, veiculos, podeEditar }: { evento: EventoCarga & { ativo: boolean }; eventos: ReadonlyArray<EventoCarga & { ativo: boolean }>; veiculos: readonly VeiculoCargaView[]; podeEditar: boolean }) {
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const editando = form?.id ? veiculos.find((v) => v.id === form.id) : undefined;
  const podeCadastrar = podeEditar && evento.ativo;

  return (
    <section className="overflow-hidden rounded-cartao border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-cartao py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-secao font-semibold tracking-[-0.01em]">Veículos de carga</h2>
          <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 text-pequeno text-muted">
            {veiculos.length ? (
              <>
                <span>
                  {veiculos.length} {veiculos.length === 1 ? "veículo" : "veículos"}
                </span>
                <ContagemVeiculos tipos={veiculos.map((v) => v.tipo)} />
              </>
            ) : (
              "Caminhões que levam o material do galpão e trazem de volta."
            )}
          </p>
        </div>
        <Link href="/carga-descarga" className="link text-pequeno">
          Ver no calendário do galpão
        </Link>
        {podeCadastrar && (
          <Button variant="primary" size="md" onClick={() => setForm({})}>
            <Icone nome="mais" />
            Novo veículo
          </Button>
        )}
      </header>
      {veiculos.length === 0 ? (
        <EmptyState
          compact
          icone="caminhao"
          title="Nenhum veículo cadastrado"
          description={podeCadastrar ? "Cadastre cada caminhão com a ida (carga no galpão) e a volta (descarga no galpão). Eles aparecem no calendário de carga e descarga." : "Os veículos deste evento aparecem aqui quando a logística cadastrar."}
          action={
            podeCadastrar ? (
              <Button variant="secondary" size="md" onClick={() => setForm({})}>
                <Icone nome="mais" />
                Novo veículo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ol className="m-0 list-none p-0">
          {veiculos.map((v, i) => (
            <li key={v.id} className="border-b border-line-row px-cartao py-3.5 last:border-b-0">
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="numero grid size-6 place-items-center rounded-full bg-control text-rotulo font-semibold text-ink-2">{i + 1}</span>
                <IconeVeiculo tipo={v.tipo} className="text-ink-3" />
                <span className="text-corpo font-semibold text-ink">{TIPO_VEICULO_LABEL[v.tipo]}</span>
                {v.ident && <span className="text-pequeno text-ink-3">· {v.ident}</span>}
                <span className="ml-auto text-rotulo text-meta">{v.atualizadoPor ? `alterado por ${v.atualizadoPor}` : v.criadoPor ? `cadastrado por ${v.criadoPor}` : ""}</span>
              </div>
              <TrechosVeiculo v={v} />
              {podeEditar && (
                <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                  <AcoesVeiculo v={v} podeEditar={podeEditar} onEditar={() => setForm({ id: v.id })} onFeito={() => undefined} nomeEvento={evento.nome} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        {form && (form.id ? editando && <FormVeiculo eventos={eventos} eventoFixo={evento.id} inicial={editando} onFechar={() => setForm(null)} /> : <FormVeiculo eventos={eventos} eventoFixo={evento.id} onFechar={() => setForm(null)} />)}
      </Dialog>
    </section>
  );
}
