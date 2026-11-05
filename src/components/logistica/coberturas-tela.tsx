"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ComboBox, type OpcaoCombo } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone, IconeLapis } from "@/components/ui/icons";
import { EmptyState, Section } from "@/components/ui/layout";
import { toastSucesso } from "@/components/ui/toast";
import { removerCoberturaAction, salvarCoberturaAction } from "@/app/(app)/projecao/actions";
import { COBERTURA_LABEL } from "@/domain/logistica";
import { hojeISO, diaMesISO } from "@/lib/format";
import type { TipoCobertura } from "@/server/db/schema";

export type Previsao = { id: string; tipo: TipoCobertura; pecaId: string; peca: string; almoxarifadoId: string; almoxarifado: string; quantidade: number; locadorId: string | null; locador: string | null; dataEntrada: string; dataDevolucao: string | null; eventoId: string | null; evento: string | null; observacao: string | null };
type Opcao = { value: string; label: string };

function Modal({ previsao, almoxarifados, locadores, pecas, eventos, principalId, onFechar }: { previsao: Previsao | null; almoxarifados: Opcao[]; locadores: Opcao[]; pecas: OpcaoCombo[]; eventos: OpcaoCombo[]; principalId: string | null; onFechar: () => void }) {
  const [tipo, setTipo] = useState<TipoCobertura>(previsao?.tipo ?? "LOCACAO");
  const [pecaId, setPecaId] = useState(previsao?.pecaId ?? "");
  const [almoxarifadoId, setAlmoxarifadoId] = useState(previsao?.almoxarifadoId ?? principalId ?? "");
  const [quantidade, setQuantidade] = useState(previsao ? String(previsao.quantidade) : "");
  const [locadorId, setLocadorId] = useState(previsao?.locadorId ?? "");
  const [dataEntrada, setDataEntrada] = useState(previsao?.dataEntrada ?? hojeISO());
  const [dataDevolucao, setDataDevolucao] = useState(previsao?.dataDevolucao ?? "");
  const [eventoId, setEventoId] = useState(previsao?.eventoId ?? "");
  const [observacao, setObservacao] = useState(previsao?.observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      setErro(null);
      setCampos({});
      const r = await salvarCoberturaAction({ id: previsao?.id ?? null, tipo, pecaId, almoxarifadoId, quantidade: Number(quantidade), locadorId: locadorId || null, dataEntrada, dataDevolucao: dataDevolucao || null, eventoId: eventoId || null, observacao: observacao || null });
      if (!r.ok) {
        setErro(r.erro);
        setCampos((r.campos as Record<string, string>) ?? {});
        return;
      }
      toastSucesso(r.mensagem ?? "Previsão salva");
      onFechar();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={previsao ? "Editar previsão" : "Nova previsão"} width={560}>
        <form
          noValidate
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Tipo" htmlFor="c-tipo" obrigatorio>
              <Select id="c-tipo" value={tipo} onValueChange={(v) => setTipo(v as TipoCobertura)} opcoes={[{ value: "LOCACAO", label: "Locação" }, { value: "COMPRA", label: "Compra" }]} />
            </Field>
            <Field label="Almoxarifado" htmlFor="c-alm" obrigatorio>
              <Select id="c-alm" value={almoxarifadoId} onValueChange={setAlmoxarifadoId} opcoes={almoxarifados} />
            </Field>
          </div>
          <Field label="Peça" htmlFor="c-peca" obrigatorio>
            <ComboBox id="c-peca" value={pecaId || null} onChange={setPecaId} opcoes={pecas} placeholder="Buscar peça" />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Quantidade" htmlFor="c-qtd" error={campos.quantidade} obrigatorio>
              <Input id="c-qtd" type="number" min={1} className="numero" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </Field>
            <Field label="Entrada" htmlFor="c-entrada" obrigatorio>
              <Input id="c-entrada" type="date" className="numero" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
            </Field>
            {tipo === "LOCACAO" && (
              <Field label="Devolução" htmlFor="c-devolucao" error={campos.dataDevolucao} obrigatorio>
                <Input id="c-devolucao" type="date" className="numero" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
              </Field>
            )}
          </div>
          {tipo === "LOCACAO" && (
            <Field label="Locador" htmlFor="c-locador" error={campos.locadorId} obrigatorio hint={locadores.length === 0 ? "Nenhum locador cadastrado. Cadastre em Cadastros logísticos." : undefined}>
              <Select id="c-locador" value={locadorId} onValueChange={setLocadorId} opcoes={locadores} placeholder="Escolha o locador" />
            </Field>
          )}
          <Field label="Evento" htmlFor="c-evento" optional hint="Para qual evento é esta previsão, se for de um só.">
            <ComboBox id="c-evento" value={eventoId || null} onChange={setEventoId} opcoes={eventos} placeholder="Buscar evento" />
          </Field>
          <Field label="Observação" htmlFor="c-obs" optional>
            <Textarea id="c-obs" className="min-h-14" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Field>
          <FormError message={erro} />
          <DialogFooter>
            <Button type="submit" variant="primary" size="lg" loading={pendente}>
              Salvar
            </Button>
            <Button variant="secondary" size="lg" onClick={onFechar}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CoberturasTela({ podeEditar, lista, almoxarifados, locadores, pecas, eventos, principalId }: { podeEditar: boolean; lista: Previsao[]; almoxarifados: Opcao[]; locadores: Opcao[]; pecas: OpcaoCombo[]; eventos: OpcaoCombo[]; principalId: string | null }) {
  const [modal, setModal] = useState<Previsao | "nova" | null>(null);
  const [remover, setRemover] = useState<Previsao | null>(null);
  return (
    <Section
      titulo="Previsões"
      acoes={
        podeEditar ? (
          <Button abreDialogo variant="secondary" size="md" onClick={() => setModal("nova")}>
            <Icone nome="mais" />
            Nova previsão
          </Button>
        ) : undefined
      }
    >
      {lista.length === 0 ? (
        <EmptyState compact icone="caixa" title="Nenhuma locação ou compra prevista" description={podeEditar ? "Veja as faltas na Projeção e registre aqui o que vai cobri-las." : "Quando a logística registrar, aparece aqui."} action={<Link href="/projecao" className="link text-corpo">Ver a Projeção</Link>} />
      ) : (
        <div className="overflow-x-auto">
          <table data-responsiva className="w-full border-collapse sm:min-w-[720px]">
            <caption className="sr-only">Locações e compras previstas</caption>
            <thead>
              <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                <th scope="col" className="px-cartao py-2.5">Peça</th>
                <th scope="col" className="px-3 py-2.5 text-right">Qtd.</th>
                <th scope="col" className="px-3 py-2.5">Tipo</th>
                <th scope="col" className="px-3 py-2.5">Período</th>
                <th scope="col" className="px-3 py-2.5">Almoxarifado</th>
                {podeEditar && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-line-row align-top">
                  <th scope="row" className="px-cartao py-2 text-left text-corpo font-normal text-ink">
                    {c.peca}
                    {c.evento && <span className="block text-rotulo text-ink-3">{c.evento}</span>}
                    {c.observacao && <span className="block text-rotulo text-ink-3">{c.observacao}</span>}
                  </th>
                  <td className="numero px-3 py-2 text-right text-corpo font-semibold">{c.quantidade.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-pequeno text-ink-2">{COBERTURA_LABEL[c.tipo]}{c.locador ? ` · ${c.locador}` : ""}</td>
                  <td className="numero whitespace-nowrap px-3 py-2 text-pequeno text-ink-2">{diaMesISO(c.dataEntrada)}{c.dataDevolucao ? ` a ${diaMesISO(c.dataDevolucao)}` : " em diante"}</td>
                  <td className="px-3 py-2 text-pequeno text-ink-2">{c.almoxarifado}</td>
                  {podeEditar && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <IconButton abreDialogo label={`Editar previsão de ${c.peca}`} onClick={() => setModal(c)}>
                        <IconeLapis />
                      </IconButton>
                      <IconButton abreDialogo label={`Remover previsão de ${c.peca}`} onClick={() => setRemover(c)} className="hover:text-danger">
                        <Icone nome="lixeira" />
                      </IconButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <Modal key={modal === "nova" ? "nova" : modal.id} previsao={modal === "nova" ? null : modal} almoxarifados={almoxarifados} locadores={locadores} pecas={pecas} eventos={eventos} principalId={principalId} onFechar={() => setModal(null)} />}
      {remover && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemover(null)}
          title="Remover esta previsão?"
          description={`${remover.peca} × ${remover.quantidade}. A falta que ela cobria volta a aparecer na Projeção.`}
          confirmLabel="Remover"
          danger
          action={async () => removerCoberturaAction(remover.id)}
        />
      )}
    </Section>
  );
}
