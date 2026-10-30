"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { ComboBox } from "@/components/ui/combobox";
import { Icone } from "@/components/ui/icons";
import { toastSucesso } from "@/components/ui/toast";
import { salvarVeiculoCargaAction } from "@/app/(app)/carga-descarga/actions";
import {
  idaVazia,
  normalizarVeiculo,
  TAG_CARGA_DICA,
  TAG_CARGA_LABEL,
  TAGS_CARGA,
  TIPO_VEICULO_LABEL,
  TIPOS_VEICULO,
  validarVeiculo,
  voltaVazia,
  type DadosVeiculo,
  type EventoCarga,
  type TagCarga,
  type TrechoIda,
  type TrechoVolta,
} from "@/domain/carga-descarga";
import { COR_TAG, IconeVeiculo } from "./base";

/** "18/10" a partir de "AAAA-MM-DD". */
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * Eventos na ordem em que a logística procura: os próximos (desde a semana passada) por data, depois os
 * mais antigos, do mais recente para trás.
 */
function eventosNaOrdem<T extends EventoCarga>(eventos: readonly T[]): T[] {
  const corte = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const proximos = eventos.filter((e) => e.data >= corte).sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, "pt-BR"));
  const antigos = eventos.filter((e) => e.data < corte).sort((a, b) => b.data.localeCompare(a.data));
  return [...proximos, ...antigos];
}

/** Tags de carga como botões liga/desliga (múltipla escolha). */
function EscolhaTags({ valor, onChange, id }: { valor: readonly TagCarga[]; onChange: (t: TagCarga[]) => void; id: string }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
      {TAGS_CARGA.map((t) => {
        const ligada = valor.includes(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ligada}
            title={TAG_CARGA_DICA[t]}
            onClick={() => onChange(ligada ? valor.filter((x) => x !== t) : [...valor, t])}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-controle border px-2.5 text-pequeno transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:h-10",
              ligada ? "border-ink-3 bg-selected font-medium text-ink" : "border-line-control bg-surface text-ink-2 hover:border-line-strong",
            )}
          >
            <span aria-hidden className="size-2 rounded-full" style={{ background: COR_TAG[t] }} />
            {TAG_CARGA_LABEL[t]}
            {ligada && <Icone nome="check" className="size-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

/** Campo de data e hora local (texto "AAAA-MM-DDTHH:mm", o mesmo que o calendário lê). */
function DataHora({ id, label, valor, onChange, hint, destaque, erro }: { id: string; label: string; valor: string; onChange: (v: string) => void; hint?: string; destaque?: boolean; erro?: string | null }) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={erro}>
      <Input id={id} type="datetime-local" value={valor} onChange={(e) => onChange(e.target.value)} className={cn("numero", destaque && !erro && "border-info-border")} />
    </Field>
  );
}

function Trecho({ titulo, sub, ativo, onAtivo, rotuloDescartar, children }: { titulo: string; sub: string; ativo: boolean; onAtivo: (v: boolean) => void; rotuloDescartar: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-cartao border bg-surface", ativo ? "border-line" : "border-dashed border-line-strong bg-subtle")}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3.5 py-2.5">
        <div className="min-w-0">
          <h3 className="m-0 text-corpo font-semibold text-ink">{titulo}</h3>
          <p className="m-0 text-rotulo text-muted">{sub}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-pequeno text-ink-2">
          <input type="checkbox" checked={!ativo} onChange={(e) => onAtivo(!e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          {rotuloDescartar}
        </label>
      </header>
      {ativo ? <div className="flex flex-col gap-3 px-3.5 py-3">{children}</div> : <p className="m-0 px-3.5 py-3 text-pequeno text-muted">Este trecho não entra no calendário.</p>}
    </section>
  );
}

/**
 * Cadastro (e edição) de um veículo de carga: tipo, identificação, ida e volta. As regras do protótipo
 * validado valem antes de salvar (e de novo no servidor). Dentro de um evento, o evento vem fixo.
 */
export function FormVeiculo({
  eventos,
  eventoFixo,
  inicial,
  onFechar,
}: {
  eventos: ReadonlyArray<EventoCarga & { ativo: boolean }>;
  /** Na aba do evento: o evento já vem escolhido e não muda. */
  eventoFixo?: string;
  /** Edição: o veículo como está (com id). */
  inicial?: (DadosVeiculo & { id: string; eventoId: string }) | null;
  onFechar: () => void;
}) {
  const [eventoId, setEventoId] = useState<string | null>(inicial?.eventoId ?? eventoFixo ?? null);
  const evento = eventos.find((e) => e.id === eventoId) ?? null;
  const [tipo, setTipo] = useState(inicial?.tipo ?? "truck");
  const [ident, setIdent] = useState(inicial?.ident ?? "");
  const [ida, setIda] = useState<TrechoIda>(inicial?.ida ?? idaVazia(evento?.local ?? ""));
  const [volta, setVolta] = useState<TrechoVolta>(inicial?.volta ?? voltaVazia());
  const [erro, setErro] = useState<string | null>(null);
  // Campo apontado pela validação ("ida.fimCarga"): fica com a borda de erro até ser mexido.
  const [campoErro, setCampoErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const limparErro = () => {
    setErro(null);
    setCampoErro(null);
  };
  const mudaIda = (p: Partial<TrechoIda>) => {
    limparErro();
    setIda((x) => ({ ...x, ...p }));
  };
  const mudaVolta = (p: Partial<TrechoVolta>) => {
    limparErro();
    setVolta((x) => ({ ...x, ...p }));
  };
  /** A mensagem vai embaixo do campo que a validação apontou; sem campo, no rodapé do formulário. */
  const erroDo = (campo: string) => (campoErro === campo ? erro : null);
  const erroSolto = erro && !(campoErro === "evento" || campoErro?.startsWith("ida.") || campoErro?.startsWith("volta.")) ? erro : null;

  const escolherEvento = (id: string) => {
    limparErro();
    setEventoId(id);
    // Destino da ida: o local do evento, enquanto ninguém digitou outro. Trocar de evento troca também o destino que
    // veio do evento anterior (antes ficava: o veículo do SUV Aurora saía com o endereço da corrida; auditoria 30/10, D N1).
    const e = eventos.find((x) => x.id === id);
    const anterior = eventos.find((x) => x.id === eventoId)?.local?.trim() ?? "";
    const destinoAtual = ida.destino.trim();
    if (!destinoAtual || (anterior && destinoAtual === anterior)) mudaIda({ destino: e?.local ?? "" });
  };

  const salvar = () => {
    limparErro();
    if (!eventoId) {
      setCampoErro("evento");
      return setErro("Escolha o evento.");
    }
    const dados = normalizarVeiculo({ tipo, ident, ida, volta });
    const problema = validarVeiculo(dados);
    if (problema) {
      setErro(problema.mensagem);
      setCampoErro(problema.campo);
      document.getElementById(`vc-${problema.campo.replace(".", "-")}`)?.focus();
      return;
    }
    iniciar(async () => {
      const r = await salvarVeiculoCargaAction({ id: inicial?.id ?? null, eventoId, veiculo: dados });
      if (!r.ok) return setErro(r.erro);
      toastSucesso(`${TIPO_VEICULO_LABEL[tipo]}${ident.trim() ? ` (${ident.trim()})` : ""} ${inicial ? "atualizado" : "cadastrado"} em ${evento?.nome ?? "evento"}`);
      onFechar();
    });
  };

  return (
    <DialogContent
      title={inicial ? "Editar veículo" : "Novo veículo"}
      description={evento ? `${evento.codigo} · ${evento.nome} · evento ${dm(evento.data)}` : "Escolha o evento, o tipo do veículo e os horários da ida e da volta."}
      width={880}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)]">
          {eventoFixo ? null : (
            <Field label="Evento" htmlFor="vc-evento" obrigatorio error={erroDo("evento")}>
              <ComboBox
                id="vc-evento"
                invalid={Boolean(erroDo("evento"))}
                value={eventoId}
                onChange={escolherEvento}
                placeholder="Buscar evento por nome ou código"
                ordenarAlfabetico={false}
                opcoes={eventosNaOrdem(eventos.filter((e) => e.ativo || e.id === eventoId)).map((e) => ({ value: e.id, label: e.nome, descricao: [e.codigo, dm(e.data), e.local].filter(Boolean).join(" · ") }))}
              />
            </Field>
          )}
          <div>
            <p id="vc-tipo-rotulo" className="m-0 mb-1.5 text-pequeno font-medium text-ink-2">
              Tipo <span className="text-danger" aria-hidden>*</span>
            </p>
            <div role="radiogroup" aria-labelledby="vc-tipo-rotulo" className="inline-flex rounded-controle border border-line-control bg-surface p-0.5">
              {TIPOS_VEICULO.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  id={t === "carreta" ? "vc-tipo" : undefined}
                  aria-checked={tipo === t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] border-0 px-2.5 text-pequeno transition-colors focus-visible:outline-2 focus-visible:outline-accent max-md:h-10",
                    tipo === t ? "bg-selected font-medium text-ink shadow-pill" : "bg-transparent text-ink-3 hover:text-ink",
                  )}
                >
                  <IconeVeiculo tipo={t} />
                  {TIPO_VEICULO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <Field label="Identificação" htmlFor="vc-ident" optional hint="Placa, motorista ou transportadora.">
            <Input id="vc-ident" value={ident} onChange={(e) => setIdent(e.target.value)} maxLength={120} placeholder="Ex.: ABC-1234 / Zaqueu" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Trecho titulo="Ida" sub="Galpão → evento" ativo={ida.ativo} onAtivo={(v) => mudaIda({ ativo: v })} rotuloDescartar="Descartar ida">
            <div>
              <p id="vc-ida-tags" className="m-0 mb-1.5 text-pequeno font-medium text-ink-2">
                Tipo de carga
              </p>
              <EscolhaTags id="vc-ida-tags" valor={ida.tags} onChange={(tags) => mudaIda({ tags })} />
            </div>
            <Field label="O que vai" htmlFor="vc-ida-cargaTexto" optional>
              <Input id="vc-ida-cargaTexto" value={ida.cargaTexto} onChange={(e) => mudaIda({ cargaTexto: e.target.value })} maxLength={500} placeholder="Ex.: box, pórtico, tendas" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DataHora id="vc-ida-inicioCarga" erro={erroDo("ida.inicioCarga")} label="Início da carga" valor={ida.inicioCarga} onChange={(v) => mudaIda({ inicioCarga: v })} hint="no galpão" />
              <DataHora id="vc-ida-fimCarga" erro={erroDo("ida.fimCarga")} label="Fim da carga" valor={ida.fimCarga} onChange={(v) => mudaIda({ fimCarga: v })} hint="aparece no calendário" destaque />
              <DataHora id="vc-ida-saida" erro={erroDo("ida.saida")} label="Saída do caminhão" valor={ida.saida} onChange={(v) => mudaIda({ saida: v })} />
              <Field label="Destino" htmlFor="vc-ida-destino" optional>
                <Input id="vc-ida-destino" value={ida.destino} onChange={(e) => mudaIda({ destino: e.target.value })} maxLength={160} placeholder="Local do evento" />
              </Field>
              <DataHora id="vc-ida-chegadaDestino" erro={erroDo("ida.chegadaDestino")} label="Chegada no destino" valor={ida.chegadaDestino} onChange={(v) => mudaIda({ chegadaDestino: v })} />
              <DataHora id="vc-ida-descarga" erro={erroDo("ida.descarga")} label="Descarga no destino" valor={ida.descarga} onChange={(v) => mudaIda({ descarga: v })} />
            </div>
            <Field label="Observações" htmlFor="vc-ida-obs" optional>
              <Textarea id="vc-ida-obs" value={ida.obs} onChange={(e) => mudaIda({ obs: e.target.value })} maxLength={2000} className="min-h-[56px]" />
            </Field>
          </Trecho>

          <Trecho titulo="Volta" sub="Evento → galpão" ativo={volta.ativo} onAtivo={(v) => mudaVolta({ ativo: v })} rotuloDescartar="Descartar volta">
            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <p id="vc-volta-tags" className="m-0 text-pequeno font-medium text-ink-2">
                  Tipo de carga
                </p>
                <Button variant="link" size="xs" disabled={!ida.ativo || (!ida.tags.length && !ida.cargaTexto.trim())} motivoDesabilitado="A ida não tem carga para copiar" onClick={() => mudaVolta({ tags: [...ida.tags], cargaTexto: ida.cargaTexto })}>
                  <Icone nome="copiar" />
                  Copiar carga da ida
                </Button>
              </div>
              <EscolhaTags id="vc-volta-tags" valor={volta.tags} onChange={(tags) => mudaVolta({ tags })} />
            </div>
            <Field label="O que volta" htmlFor="vc-volta-cargaTexto" optional>
              <Input id="vc-volta-cargaTexto" value={volta.cargaTexto} onChange={(e) => mudaVolta({ cargaTexto: e.target.value })} maxLength={500} placeholder="Ex.: box, pórtico, tendas" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DataHora id="vc-volta-inicioCarga" erro={erroDo("volta.inicioCarga")} label="Início da carga" valor={volta.inicioCarga} onChange={(v) => mudaVolta({ inicioCarga: v })} hint="no evento" />
              <DataHora id="vc-volta-fimCarga" erro={erroDo("volta.fimCarga")} label="Fim da carga" valor={volta.fimCarga} onChange={(v) => mudaVolta({ fimCarga: v })} hint="aparece no calendário" destaque />
              <DataHora id="vc-volta-saida" erro={erroDo("volta.saida")} label="Saída do caminhão" valor={volta.saida} onChange={(v) => mudaVolta({ saida: v })} />
              <Field label="Destino" htmlFor="vc-volta-destino" optional>
                <Input id="vc-volta-destino" value={volta.destino} onChange={(e) => mudaVolta({ destino: e.target.value })} maxLength={160} placeholder="Galpão" />
              </Field>
              <DataHora id="vc-volta-chegadaGalpao" erro={erroDo("volta.chegadaGalpao")} label="Chegada no galpão" valor={volta.chegadaGalpao} onChange={(v) => mudaVolta({ chegadaGalpao: v })} />
              <DataHora id="vc-volta-descargaGalpao" erro={erroDo("volta.descargaGalpao")} label="Descarga no galpão" valor={volta.descargaGalpao} onChange={(v) => mudaVolta({ descargaGalpao: v })} hint="aparece no calendário" destaque />
            </div>
            <Field label="Observações" htmlFor="vc-volta-obs" optional>
              <Textarea id="vc-volta-obs" value={volta.obs} onChange={(e) => mudaVolta({ obs: e.target.value })} maxLength={2000} className="min-h-[56px]" />
            </Field>
          </Trecho>
        </div>
        <FormError message={erroSolto} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" size="lg" disabled={pendente}>
            Cancelar
          </Button>
        </DialogClose>
        <Button variant="primary" size="lg" loading={pendente} onClick={salvar}>
          {inicial ? "Salvar alterações" : "Cadastrar veículo"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
