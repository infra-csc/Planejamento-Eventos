"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { duplicarVeiculoCargaAction, excluirVeiculoCargaAction } from "@/app/(app)/carga-descarga/actions";
import { dataHoraCurta, TIPO_VEICULO_LABEL } from "@/domain/carga-descarga";
import type { EventoCargaView, VeiculoCargaView } from "@/server/services/carga-descarga";
import { IconeVeiculo, TagCargaChip } from "./base";

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-row py-1.5 last:border-b-0">
      <dt className="text-pequeno text-muted">{rotulo}</dt>
      <dd className={cn("numero m-0 text-right text-pequeno", destaque ? "font-semibold text-ink" : "text-ink-2", valor === "—" && "text-meta")}>{valor}</dd>
    </div>
  );
}

/** Ida e volta lado a lado (empilhadas no celular), como no cadastro. */
export function TrechosVeiculo({ v }: { v: VeiculoCargaView }) {
  const bloco = (titulo: string, ativo: boolean, tags: VeiculoCargaView["ida"]["tags"], carga: string, linhas: Array<[string, string, boolean?]>, obs: string) => (
    <section className={cn("rounded-controle border px-3 py-2.5", ativo ? "border-line-soft" : "border-dashed border-line-strong bg-subtle")}>
      <h4 className="m-0 text-pequeno font-semibold text-ink">{titulo}</h4>
      {!ativo ? (
        <p className="m-0 mt-1 text-pequeno text-muted">Descartada: não entra no calendário.</p>
      ) : (
        <>
          {(tags.length > 0 || carga) && (
            <p className="m-0 mt-1.5 flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <TagCargaChip key={t} tag={t} />
              ))}
              {carga && <span className="text-pequeno text-ink-2">{carga}</span>}
            </p>
          )}
          <dl className="m-0 mt-1.5">
            {linhas.map(([r, val, d]) => (
              <Linha key={r} rotulo={r} valor={val} destaque={d} />
            ))}
          </dl>
          {obs && <p className="m-0 mt-1.5 whitespace-pre-line break-words rounded-controle bg-subtle px-2.5 py-1.5 text-pequeno text-ink-2">{obs}</p>}
        </>
      )}
    </section>
  );
  const i = v.ida;
  const o = v.volta;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {bloco(
        "Ida · galpão → evento",
        i.ativo,
        i.tags,
        i.cargaTexto,
        [
          ["Início da carga", dataHoraCurta(i.inicioCarga)],
          ["Fim da carga", dataHoraCurta(i.fimCarga), true],
          ["Saída", dataHoraCurta(i.saida)],
          ["Destino", i.destino || "—"],
          ["Chegada no destino", dataHoraCurta(i.chegadaDestino)],
          ["Descarga no destino", dataHoraCurta(i.descarga)],
        ],
        i.obs,
      )}
      {bloco(
        "Volta · evento → galpão",
        o.ativo,
        o.tags,
        o.cargaTexto,
        [
          ["Início da carga", dataHoraCurta(o.inicioCarga)],
          ["Fim da carga", dataHoraCurta(o.fimCarga), true],
          ["Saída", dataHoraCurta(o.saida)],
          ["Destino", o.destino || "—"],
          ["Chegada no galpão", dataHoraCurta(o.chegadaGalpao)],
          ["Descarga no galpão", dataHoraCurta(o.descargaGalpao), true],
        ],
        o.obs,
      )}
    </div>
  );
}

/** A ida e a volta em uma linha cada, com os horários que contam (lista do cadastro). */
export function ResumoTrechos({ v }: { v: VeiculoCargaView }) {
  const i = v.ida;
  const o = v.volta;
  const ida = !i.ativo
    ? null
    : [
        i.inicioCarga && i.fimCarga ? `carga ${dataHoraCurta(i.inicioCarga)} → fim ${dataHoraCurta(i.fimCarga)}` : i.fimCarga ? `fim carga ${dataHoraCurta(i.fimCarga)}` : i.inicioCarga ? `carga ${dataHoraCurta(i.inicioCarga)}` : "",
        i.saida && `saída ${dataHoraCurta(i.saida)}`,
        i.destino,
        (i.descarga || i.chegadaDestino) && `descarga ${dataHoraCurta(i.descarga || i.chegadaDestino)}`,
      ].filter(Boolean);
  const volta = !o.ativo
    ? null
    : [
        o.fimCarga ? `fim carga ${dataHoraCurta(o.fimCarga)}` : o.inicioCarga ? `carga ${dataHoraCurta(o.inicioCarga)}` : "",
        o.saida && `saída ${dataHoraCurta(o.saida)}`,
        (o.descargaGalpao || o.chegadaGalpao) && `descarga galpão ${dataHoraCurta(o.descargaGalpao || o.chegadaGalpao)}`,
      ].filter(Boolean);
  const linha = (rotulo: string, partes: Array<string | false> | null) => (
    <p className={cn("numero m-0 text-pequeno", partes ? "text-ink-2" : "text-meta")}>
      <span className="font-medium text-ink-3">{rotulo}: </span>
      {partes ? partes.join(" · ") || "sem horários" : "descartada"}
    </p>
  );
  return (
    <div className="flex flex-col gap-0.5">
      {linha("Ida", ida)}
      {linha("Volta", volta)}
    </div>
  );
}

/**
 * Ações de um veículo: excluir (com confirmação no próprio rodapé), duplicar e editar. Duplicar cria um veículo
 * novo, então só em evento ativo; editar não vale em evento cancelado (o servidor recusa). Excluir fica sempre: é
 * como a logística libera o caminhão de um evento cancelado (auditoria 30/10, parte D N3).
 */
export function AcoesVeiculo({ v, podeEditar, evento, onEditar, onFeito, nomeEvento, tamanho = "md" }: { v: VeiculoCargaView; podeEditar: boolean; evento?: Pick<EventoCargaView, "ativo" | "cancelado">; onEditar: () => void; onFeito: () => void; nomeEvento: string; tamanho?: "sm" | "md" }) {
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (!podeEditar) return null;
  const rotulo = `${TIPO_VEICULO_LABEL[v.tipo]}${v.ident ? ` (${v.ident})` : ""}`;
  return confirmar ? (
    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-pequeno text-danger">Excluir {rotulo} de {nomeEvento}?</span>
      <Button variant="secondary" size={tamanho} disabled={pendente} onClick={() => setConfirmar(false)}>
        Não
      </Button>
      <Button
        variant="danger"
        size={tamanho}
        loading={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await excluirVeiculoCargaAction(v.id, v.eventoId);
            if (!r.ok) return toastErro(r.erro);
            toastSucesso(`${rotulo} excluído de ${nomeEvento}`);
            onFeito();
          })
        }
      >
        Excluir
      </Button>
    </div>
  ) : (
    // Ordem Editar, Duplicar, Excluir: no rodapé do diálogo (do primário ao destrutivo) e no celular, em que o primeiro
    // botão fica no topo — antes era o "Excluir" (auditoria 30/10, parte D N21).
    <>
      {!evento?.cancelado && (
        <Button variant="primary" size={tamanho} onClick={onEditar}>
          <Icone nome="lapis" />
          Editar
        </Button>
      )}
      {evento?.ativo !== false && (
        <Button
          variant="secondary"
          size={tamanho}
          loading={pendente}
          title="Cria uma cópia com o mesmo cadastro (ida e volta)"
          onClick={() =>
            iniciar(async () => {
              const r = await duplicarVeiculoCargaAction(v.id, v.eventoId);
              if (!r.ok) return toastErro(r.erro);
              toastSucesso(`${rotulo} duplicado em ${nomeEvento}`);
              onFeito();
            })
          }
        >
          <Icone nome="copiar" />
          Duplicar
        </Button>
      )}
      <Button variant="dangerOutline" size={tamanho} onClick={() => setConfirmar(true)} className="sm:mr-auto">
        <Icone nome="lixeira" />
        Excluir
      </Button>
    </>
  );
}

/** Modal de um veículo: ida e volta completas e as ações. */
export function DetalheVeiculo({ v, evento, podeEditar, onEditar, onFechar }: { v: VeiculoCargaView; evento: EventoCargaView | undefined; podeEditar: boolean; onEditar: () => void; onFechar: () => void }) {
  return (
    <DialogContent title={`${TIPO_VEICULO_LABEL[v.tipo]}${v.ident ? ` · ${v.ident}` : ""}`} description={evento ? `${evento.nome} · evento ${dm(evento.data)}` : undefined} width={760}>
      {evento && (
        <p className="-mt-1 mb-3 flex flex-wrap items-center gap-2 text-pequeno text-muted">
          <IconeVeiculo tipo={v.tipo} className="text-ink-3" />
          <Link href={`/eventos/${evento.id}/carga`} className="link">
            <Codigo>{evento.codigo}</Codigo> · todos os veículos do evento
          </Link>
        </p>
      )}
      {/* O caminhão segue reservado até alguém excluir o veículo (auditoria 30/10, parte D N2). */}
      {evento?.cancelado && <p className="m-0 mb-3 rounded-controle bg-danger-bg px-3 py-2 text-pequeno text-danger">Evento cancelado: este veículo não vai sair. Exclua para liberar o caminhão.</p>}
      <TrechosVeiculo v={v} />
      <p className="m-0 mt-3 text-rotulo text-muted">
        {v.atualizadoPor ? `Alterado por ${v.atualizadoPor}` : v.criadoPor ? `Cadastrado por ${v.criadoPor}` : ""}
        {v.atualizadoEm ? ` · ${dataHoraCurta(v.atualizadoEm.slice(0, 16))}` : ""}
      </p>
      {podeEditar && (
        <DialogFooter>
          <AcoesVeiculo v={v} podeEditar={podeEditar} evento={evento} onEditar={onEditar} onFeito={onFechar} nomeEvento={evento?.nome ?? "evento"} />
        </DialogFooter>
      )}
    </DialogContent>
  );
}
