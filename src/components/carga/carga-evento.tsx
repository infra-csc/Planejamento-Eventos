"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/layout";
import { Icone } from "@/components/ui/icons";
import { TIPO_VEICULO_LABEL } from "@/domain/carga-descarga";
import type { EventoCargaView, VeiculoCargaView } from "@/server/services/carga-descarga";
import { ContagemVeiculos, IconeVeiculo, TagCargaChip } from "./base";
import { AcoesVeiculo, DetalheVeiculo, ResumoTrechos, TrechosVeiculo } from "./detalhe-veiculo";
import { FormVeiculo } from "./form-veiculo";
import { useFocoDeVolta } from "./use-foco-de-volta";

/** Quem mexeu por último: "alterado por" só depois do cadastro. */
const autoria = (v: VeiculoCargaView) => (v.atualizadoPor ? `alterado por ${v.atualizadoPor}` : v.criadoPor ? `cadastrado por ${v.criadoPor}` : "");

/**
 * Veículos de um evento com o cadastro, a edição, a duplicação e a exclusão. Na aba "Carga" do evento
 * mostra a ida e a volta completas; no cadastro do galpão (`compacto`) cada veículo vira duas linhas de
 * resumo, com "Ver" para o detalhe, como no protótipo validado.
 */
export function CargaDoEvento({
  evento,
  eventos,
  veiculos,
  podeEditar,
  compacto,
  cabecalho,
}: {
  evento: EventoCargaView;
  eventos: readonly EventoCargaView[];
  veiculos: readonly VeiculoCargaView[];
  podeEditar: boolean;
  compacto?: boolean;
  /** Substitui o título "Veículos de carga" (o cadastro mostra o nome e a data do evento). */
  cabecalho?: React.ReactNode;
}) {
  const [modal, setModalBruto] = useState<{ tipo: "form"; id?: string } | { tipo: "ver"; id: string } | null>(null);
  const foco = useFocoDeVolta();
  const setModal = (m: typeof modal) => {
    if (m) foco.guardar();
    else foco.devolver();
    setModalBruto(m);
  };
  const doModal = modal && "id" in modal && modal.id ? veiculos.find((v) => v.id === modal.id) : undefined;
  const podeCadastrar = podeEditar && evento.ativo;
  const novo = () => setModal({ tipo: "form" });

  return (
    <section className="overflow-hidden rounded-cartao border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-cartao py-3.5">
        <div className="min-w-0 flex-1 max-sm:basis-full">
          {cabecalho ?? <h2 className="m-0 text-secao font-semibold tracking-[-0.01em]">Veículos de carga</h2>}
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
        {compacto ? (
          <Link href={`/eventos/${evento.id}`} className="link text-pequeno">
            Abrir o evento
          </Link>
        ) : (
          <Link href="/carga-descarga" className="link text-pequeno">
            Ver no calendário do galpão
          </Link>
        )}
        {podeCadastrar && (
          <Button variant="primary" size="md" onClick={novo}>
            <Icone nome="mais" />
            {/* Um nome só para a mesma ação, aqui e no calendário (auditoria 28/10, nº 163). */}
            Novo veículo
          </Button>
        )}
      </header>
      {/* Cancelado com veículo: o caminhão segue reservado até alguém excluir (auditoria 30/10, parte D N2). */}
      {evento.cancelado && veiculos.length > 0 ? (
        <p className="m-0 border-b border-line-soft bg-danger-bg px-cartao py-2 text-pequeno text-danger">
          Evento cancelado: {veiculos.length === 1 ? "este veículo não vai sair. Exclua para liberar o caminhão." : "estes veículos não vão sair. Exclua cada um para liberar os caminhões."}
        </p>
      ) : (
        !evento.ativo && <p className="m-0 border-b border-line-soft bg-subtle px-cartao py-2 text-pequeno text-muted">Evento {evento.cancelado ? "cancelado" : "encerrado"}: não recebe veículos novos.</p>
      )}
      {veiculos.length === 0 ? (
        <EmptyState
          compact
          icone="caminhao"
          title="Nenhum veículo cadastrado"
          // Sem botão aqui: o do cabeçalho do cartão, logo acima, é o mesmo (antes eram dois "Novo veículo" juntos).
          description={podeCadastrar ? `Cadastre cada caminhão em “Novo veículo”, com a ida (carga no galpão) e a volta (descarga no galpão). Eles aparecem no calendário de carga e descarga.` : "Os veículos deste evento aparecem aqui quando a logística cadastrar."}
        />
      ) : compacto ? (
        <ul className="m-0 list-none p-0">
          {veiculos.map((v) => {
            const tags = [...new Set([...(v.ida.ativo ? v.ida.tags : []), ...(v.volta.ativo ? v.volta.tags : [])])];
            return (
              <li key={v.id} className="border-b border-line-row px-cartao py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <IconeVeiculo tipo={v.tipo} className="h-5 w-10 text-ink-2" />
                  <p className="m-0 flex min-w-0 flex-1 basis-48 flex-wrap items-center gap-1.5">
                    <span className="text-corpo font-semibold text-ink">{TIPO_VEICULO_LABEL[v.tipo]}</span>
                    {v.ident && <span className="break-words text-pequeno text-ink-2">· {v.ident}</span>}
                    {tags.map((t) => (
                      <TagCargaChip key={t} tag={t} />
                    ))}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button abreDialogo variant="secondary" size="sm" onClick={() => setModal({ tipo: "ver", id: v.id })}>
                      Ver
                    </Button>
                    {podeEditar && <AcoesVeiculo v={v} podeEditar evento={evento} tamanho="sm" onEditar={() => setModal({ tipo: "form", id: v.id })} onFeito={() => undefined} nomeEvento={evento.nome} />}
                  </div>
                </div>
                <div className="mt-1.5 sm:pl-[50px]">
                  <ResumoTrechos v={v} />
                  <p className="m-0 mt-1 text-rotulo text-meta">{autoria(v)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ol className="m-0 list-none p-0">
          {veiculos.map((v, i) => (
            <li key={v.id} className="border-b border-line-row px-cartao py-3.5 last:border-b-0">
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="numero grid size-6 place-items-center rounded-full bg-control text-rotulo font-semibold text-ink-2">{i + 1}</span>
                <IconeVeiculo tipo={v.tipo} className="text-ink-3" />
                <span className="text-corpo font-semibold text-ink">{TIPO_VEICULO_LABEL[v.tipo]}</span>
                {v.ident && <span className="text-pequeno text-ink-3">· {v.ident}</span>}
                <span className="ml-auto text-rotulo text-meta">{autoria(v)}</span>
              </div>
              <TrechosVeiculo v={v} />
              {podeEditar && (
                <div className="mt-2.5 flex flex-row-reverse flex-wrap items-center justify-start gap-2">
                  <AcoesVeiculo v={v} podeEditar={podeEditar} evento={evento} onEditar={() => setModal({ tipo: "form", id: v.id })} onFeito={() => undefined} nomeEvento={evento.nome} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        {modal?.tipo === "form" &&
          (modal.id ? doModal && <FormVeiculo eventos={eventos} eventoFixo={evento.id} inicial={doModal} onFechar={() => setModal(null)} /> : <FormVeiculo eventos={eventos} eventoFixo={evento.id} onFechar={() => setModal(null)} />)}
        {modal?.tipo === "ver" && doModal && <DetalheVeiculo v={doModal} evento={evento} podeEditar={podeEditar} onEditar={() => setModal({ tipo: "form", id: doModal.id })} onFechar={() => setModal(null)} />}
      </Dialog>
    </section>
  );
}
