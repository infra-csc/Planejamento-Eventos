"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combobox";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Label, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { RodapeTabela } from "@/components/ui/layout";
import { Stepper } from "@/components/ui/stepper";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { toast } from "@/components/ui/toast";
import { ajustarPecaDoProjetoAction } from "@/app/(app)/eventos/actions";

export type PecaDoProjeto = { pecaId: string; codigo: string; nome: string; unidade: string; porUnidade: number; total: number };

type Edicao = { pecaId: string | null; codigo: string; nome: string; porUnidade: number };

/**
 * Peças de um projeto na ata/OS, editáveis uma a uma (quantidade por unidade, tirar ou incluir peça),
 * sempre com motivo. A lista original do projeto padrão não muda: só esta linha do evento.
 */
export function PecasProjeto({
  eventoId,
  linhaId,
  quantidadeProjeto,
  pecas,
  editavel,
  opcoesPecas,
  depoisDaAta,
}: {
  eventoId: string;
  linhaId: string;
  quantidadeProjeto: number;
  pecas: PecaDoProjeto[];
  editavel: boolean;
  opcoesPecas: Array<{ id: string; codigo: string; nome: string }>;
  /** Ata fechada: o ajuste gera nova versão da OS e avisa a área. */
  depoisDaAta: boolean;
}) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [qtd, setQtd] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const abrir = (e: Edicao) => {
    setEdicao(e);
    setQtd(e.pecaId ? e.porUnidade : 1);
    setMotivo("");
    setErro(null);
  };

  const salvar = () => {
    if (!edicao?.pecaId) return setErro("Escolha a peça.");
    if (!motivo.trim()) return setErro("Informe o motivo. Ele fica no histórico.");
    const pecaId = edicao.pecaId;
    iniciar(async () => {
      const r = await ajustarPecaDoProjetoAction(eventoId, linhaId, pecaId, qtd, motivo);
      if (!r.ok) return setErro(r.erro);
      toast(qtd === 0 ? `${edicao.nome} retirada do projeto` : `${edicao.nome}: ${qtd} por unidade`);
      setEdicao(null);
    });
  };

  const naLista = new Set(pecas.map((p) => p.pecaId));
  const totalUnidades = pecas.reduce((a, p) => a + p.total, 0);

  return (
    <>
      {/* Rolagem própria no celular: sem ela, colunas como Total ficavam cortadas pelo cartão. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-corpo">
          <CaptionOculta>Peças do projeto nesta linha</CaptionOculta>
          <thead>
            <tr className="bg-subtle">
              <Th largura={120}>Código</Th>
              <Th>Peça</Th>
              <Th largura={90} alinhar="right">
                Por un.
              </Th>
              <Th largura={96} alinhar="right">
                Total
              </Th>
              {editavel && (
                <Th largura={52}>
                  <span className="sr-only">Ações</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {pecas.map((p) => (
              <tr key={p.pecaId} className="border-b border-line-row last:border-b-0 hover:bg-subtle">
                <td className="py-2 pl-cartao pr-2 text-pequeno text-ink-2">
                  <Codigo>{p.codigo}</Codigo>
                </td>
                <td className="px-2 py-2 text-ink">{p.nome}</td>
                <td className="numero px-2 py-2 text-right text-ink-2">{p.porUnidade}</td>
                <td className="numero px-2 py-2 text-right font-medium text-ink">
                  {p.total} <span className="text-rotulo font-normal text-muted">{p.unidade}</span>
                </td>
                {editavel && (
                  <td className="py-1 pr-cartao text-right">
                    <IconButton label={`Ajustar ${p.nome}`} onClick={() => abrir({ pecaId: p.pecaId, codigo: p.codigo, nome: p.nome, porUnidade: p.porUnidade })}>
                      <Icone nome="lapis" />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RodapeTabela
        direita={
          editavel && (
            <Button variant="link" size="sm" onClick={() => abrir({ pecaId: null, codigo: "", nome: "", porUnidade: 0 })}>
              <Icone nome="mais" />
              Incluir peça
            </Button>
          )
        }
      >
        {pecas.length} {pecas.length === 1 ? "tipo de peça" : "tipos de peça"} · <span className="numero">{totalUnidades.toLocaleString("pt-BR")}</span> unidades para <span className="numero">× {quantidadeProjeto}</span>
      </RodapeTabela>

      {edicao && (
        <Dialog open onOpenChange={(o) => !o && setEdicao(null)}>
          <DialogContent
            title={edicao.codigo ? `Ajustar ${edicao.codigo}` : "Incluir peça no projeto"}
            description={depoisDaAta ? "A ata já foi fechada: o ajuste gera nova versão da OS e avisa a área." : "Ajuste só deste projeto neste evento. Fica no histórico com seu nome e o motivo."}
            width={460}
          >
            <div className="flex flex-col gap-3.5">
              {!edicao.codigo && (
                <div>
                  <Label>Peça do catálogo</Label>
                  <ComboBox
                    value={edicao.pecaId}
                    onChange={(id) => {
                      const p = opcoesPecas.find((x) => x.id === id);
                      if (p) setEdicao({ pecaId: p.id, codigo: "", nome: p.nome, porUnidade: 0 });
                    }}
                    placeholder="Buscar por código ou nome"
                    opcoes={opcoesPecas.filter((p) => !naLista.has(p.id)).map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo }))}
                  />
                </div>
              )}
              {edicao.codigo && <p className="m-0 text-corpo text-ink-2">{edicao.nome}</p>}
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Por unidade do projeto" htmlFor="qtd-peca">
                  <Stepper id="qtd-peca" valor={qtd} onChange={setQtd} min={0} />
                </Field>
                <p className="m-0 pb-2 text-pequeno text-muted">
                  × {quantidadeProjeto} = <span className="numero font-medium text-ink">{qtd * quantidadeProjeto}</span>
                  {edicao.codigo ? ` (era ${edicao.porUnidade * quantidadeProjeto})` : ""}
                  {qtd === 0 && edicao.codigo ? " · retira a peça" : ""}
                </p>
              </div>
              <Field label="Motivo" htmlFor="motivo-peca" obrigatorio>
                <Textarea id="motivo-peca" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: só 2 tramos disponíveis; o cliente pediu vão menor" className="min-h-[72px]" />
              </Field>
              <FormError message={erro} />
            </div>
            <DialogFooter>
              <Button variant="primary" size="lg" onClick={salvar} loading={pendente}>
                Salvar
              </Button>
              <DialogClose asChild>
                <Button variant="secondary" size="lg" disabled={pendente}>
                  Cancelar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
