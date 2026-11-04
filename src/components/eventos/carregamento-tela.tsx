"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarCarregamentoAction } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Tag } from "@/components/ui/badge";
import { ComboBox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Icone } from "@/components/ui/icons";
import { EmptyState, Section } from "@/components/ui/layout";
import { Codigo } from "@/components/ui/numero";
import { Pills } from "@/components/ui/pills";
import { Stepper } from "@/components/ui/stepper";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import type { LinhaCarregamento } from "@/domain/carregamento";
import { cn } from "@/lib/cn";

export type GrupoCarregamento = { chave: string; rotulo: string; linhas: LinhaCarregamento[] };
type Edicao = { carregado: number; motivo: string };

const fmt = (n: number) => n.toLocaleString("pt-BR");
const celula = "border-b border-line-row py-2 align-middle";

function Diferenca({ pedido, carregado }: { pedido: number; carregado: number }) {
  const d = carregado - pedido;
  if (d === 0) return <span className="text-meta">—</span>;
  return <span className={cn("numero font-semibold", d > 0 ? "text-info" : "text-danger")}>{d > 0 ? `+${fmt(d)}` : `−${fmt(-d)}`}</span>;
}

/**
 * Aba Carregamento: o que foi de fato no caminhão, ao lado do que foi pedido. A logística altera o número, com observação opcional;
 * quem pediu é avisado e vê aqui o que mudou. A OS não muda.
 */
export function CarregamentoTela({
  eventoId,
  grupos,
  mudancas,
  podeEditar,
  podeExportar,
  opcoesPecas,
}: {
  eventoId: string;
  grupos: GrupoCarregamento[];
  mudancas: LinhaCarregamento[];
  podeEditar: boolean;
  podeExportar: boolean;
  opcoesPecas: Array<{ value: string; label: string; descricao?: string }>;
}) {
  const router = useRouter();
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({});
  const [soMudou, setSoMudou] = useState(false);
  const [aMais, setAMais] = useState(false);
  const [peca, setPeca] = useState<string | null>(null);
  const [qtd, setQtd] = useState(1);
  const [motivoMais, setMotivoMais] = useState("");
  const [pendente, iniciar] = useTransition();

  const todas = useMemo(() => grupos.flatMap((g) => g.linhas), [grupos]);
  const alteradas = todas.filter((l) => edicoes[l.chave] && edicoes[l.chave].carregado !== l.carregado);

  const mudar = (l: LinhaCarregamento, parcial: Partial<Edicao>) =>
    setEdicoes((e) => ({ ...e, [l.chave]: { carregado: e[l.chave]?.carregado ?? l.carregado, motivo: e[l.chave]?.motivo ?? l.ajuste?.motivo ?? "", ...parcial } }));

  const enviar = (dados: Array<{ chave?: string; pecaId?: string; carregado: number; motivo: string }>, depois: () => void) =>
    iniciar(async () => {
      const r = await salvarCarregamentoAction(eventoId, dados);
      if (!r.ok) return toastErro(r.erro);
      depois();
      toastSucesso("Carregamento salvo. Quem pediu foi avisado.");
      router.refresh();
    });

  const salvar = () =>
    enviar(
      alteradas.map((l) => ({ chave: l.chave, carregado: edicoes[l.chave].carregado, motivo: edicoes[l.chave].motivo })),
      () => setEdicoes({}),
    );
  const incluir = () =>
    enviar([{ pecaId: peca!, carregado: qtd, motivo: motivoMais }], () => {
      setAMais(false);
      setPeca(null);
      setQtd(1);
      setMotivoMais("");
    });

  return (
    <div className="flex flex-col gap-4">
      <Section
        titulo="O que mudou no carregamento"
        sub="Diferenças em relação ao que foi pedido. A OS continua igual."
        acoes={
          podeExportar && (
            <>
              {/* <a> comum: o Link do Next pré-carregaria o arquivo inteiro a cada visita à aba. */}
              <a href={`/api/os/${eventoId}/estrutura`} className={buttonClasses({ variant: "secondary", size: "sm", className: "no-underline" })}>
                <Icone nome="download" />
                Folha de estrutura
              </a>
              <a href={`/impressao/os/${eventoId}`} className={buttonClasses({ variant: "ghost", size: "sm", className: "no-underline" })}>
                <Icone nome="imprimir" />
                Imprimir
              </a>
            </>
          )
        }
      >
        {mudancas.length === 0 ? (
          <EmptyState compact title="Nada mudou: o carregamento está igual ao pedido." />
        ) : (
          <ul className="m-0 list-none p-0">
            {mudancas.map((l) => (
              <li key={l.chave} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-row px-cartao py-2.5 last:border-b-0">
                <span className="min-w-0 flex-1 basis-64 text-corpo text-ink">
                  {l.nome}
                  {l.pedido === 0 && (
                    <Tag tom="info" className="ml-2">
                      a mais
                    </Tag>
                  )}
                  <span className="mt-0.5 block text-pequeno text-muted">
                    {[l.ajuste?.motivo, l.ajuste?.porNome].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="numero whitespace-nowrap text-corpo text-ink-2">
                  {fmt(l.pedido)} → <strong className="font-semibold text-ink">{fmt(l.carregado)}</strong> <span className="text-rotulo text-muted">{l.unidade}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills
          rotulo="O que mostrar"
          itens={[
            { label: "Tudo", n: todas.length, ativo: !soMudou, onSelect: () => setSoMudou(false) },
            { label: "Só o que mudou", n: mudancas.length, ativo: soMudou, onSelect: () => setSoMudou(true) },
          ]}
        />
        {podeEditar && (
          <Button variant="secondary" size="md" abreDialogo onClick={() => setAMais(true)}>
            <Icone nome="mais" />
            Incluir item a mais
          </Button>
        )}
      </div>

      {grupos.map((g) => {
        const linhas = soMudou ? g.linhas.filter((l) => l.carregado !== l.pedido || edicoes[l.chave]) : g.linhas;
        if (linhas.length === 0) return null;
        return (
          <Section key={g.chave} titulo={g.rotulo}>
            <div className="overflow-x-auto">
              <table data-responsiva className="w-full border-collapse">
                <CaptionOculta>{`Carregamento · ${g.rotulo}`}</CaptionOculta>
                <thead>
                  <tr>
                    <Th>Peça</Th>
                    <Th largura={90} alinhar="right">
                      Pedido
                    </Th>
                    <Th largura={podeEditar ? 150 : 100} alinhar="right">
                      Carregado
                    </Th>
                    <Th className="max-sm:hidden" largura={90} alinhar="right">
                      Diferença
                    </Th>
                    {podeEditar && <Th className="max-md:hidden md:w-[32%]">Observação</Th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const e = edicoes[l.chave];
                    const carregado = e?.carregado ?? l.carregado;
                    const motivo = e?.motivo ?? l.ajuste?.motivo ?? "";
                    const pedeMotivo = carregado !== l.pedido;
                    const campoObservacao = podeEditar && pedeMotivo && (
                      <Input value={motivo} maxLength={300} aria-label={`Observação sobre ${l.nome} (opcional)`} placeholder="Observação (opcional)" onChange={(ev) => mudar(l, { motivo: ev.target.value })} />
                    );
                    return (
                      <tr key={l.chave} className={cn(pedeMotivo && "bg-selected")}>
                        <th scope="row" className={cn(celula, "pl-cartao pr-3 text-left text-corpo font-normal text-ink")}>
                          {l.nome}
                          {l.ajuste && l.ajuste.pedidoNaHora !== l.pedido && (
                            <Tag tom="warning" className="ml-2">
                              pedido mudou depois
                            </Tag>
                          )}
                          {l.codigo && <Codigo className="mt-0.5 block text-rotulo text-muted">{l.codigo}</Codigo>}
                          {campoObservacao && <span className="mt-1.5 block md:hidden">{campoObservacao}</span>}
                          {!podeEditar && pedeMotivo && l.ajuste?.motivo && <span className="mt-0.5 block text-pequeno text-muted">{l.ajuste.motivo}</span>}
                        </th>
                        <td className={cn(celula, "numero px-3 text-right text-corpo text-ink-2")}>{fmt(l.pedido)}</td>
                        <td className={cn(celula, "px-3 text-right text-corpo font-semibold text-ink last:pr-cartao", !podeEditar && "numero")}>
                          {podeEditar ? <Stepper tamanho="sm" valor={carregado} onChange={(v) => mudar(l, { carregado: v })} label={`Carregado de ${l.nome}`} disabled={pendente} className="ml-auto" /> : fmt(carregado)}
                        </td>
                        <td className={cn(celula, "px-3 text-right text-corpo last:pr-cartao max-sm:hidden")}>
                          <Diferenca pedido={l.pedido} carregado={carregado} />
                        </td>
                        {podeEditar && <td className={cn(celula, "pl-3 pr-cartao max-md:hidden")}>{campoObservacao}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        );
      })}

      {alteradas.length > 0 && (
        <div role="region" aria-label="Salvar carregamento" className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-cartao border border-line-strong bg-surface px-cartao py-3 shadow-popover">
          <p className="m-0 min-w-0 flex-1 text-corpo text-ink-2">
            <strong className="numero font-semibold text-ink">{alteradas.length}</strong> {alteradas.length === 1 ? "alteração" : "alterações"}
          </p>
          <Button variant="ghost" size="lg" disabled={pendente} onClick={() => setEdicoes({})}>
            Descartar
          </Button>
          <Button variant="primary" size="lg" loading={pendente} onClick={salvar}>
            Salvar e avisar quem pediu
          </Button>
        </div>
      )}

      <Dialog open={aMais} onOpenChange={setAMais}>
        <DialogContent title="Incluir item a mais" description="Algo que foi no caminhão e não estava na OS. A OS não muda; quem pediu no evento é avisado.">
          <div className="flex flex-col gap-3">
            <Field label="Peça" htmlFor="carregamento-peca" obrigatorio>
              <ComboBox id="carregamento-peca" value={peca} onChange={setPeca} opcoes={opcoesPecas} placeholder="Buscar peça por nome ou código" />
            </Field>
            <Field label="Quantidade carregada" htmlFor="carregamento-qtd" obrigatorio>
              <Stepper id="carregamento-qtd" valor={qtd} min={1} onChange={setQtd} label="Quantidade carregada" />
            </Field>
            <Field label="Observação" htmlFor="carregamento-motivo" optional>
              <Input id="carregamento-motivo" value={motivoMais} maxLength={300} onChange={(ev) => setMotivoMais(ev.target.value)} placeholder="Ex.: pedido de última hora" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="primary" size="lg" loading={pendente} disabled={!peca || qtd < 1} onClick={incluir}>
              Incluir e avisar
            </Button>
            <Button variant="secondary" size="lg" disabled={pendente} onClick={() => setAMais(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
