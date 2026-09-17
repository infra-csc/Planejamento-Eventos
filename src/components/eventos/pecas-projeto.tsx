"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { IconeLapis } from "@/components/ui/icons";
import { RodapeTabela } from "@/components/ui/layout";
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
      <table className="w-full border-collapse text-corpo">
        <CaptionOculta>Peças do projeto nesta linha</CaptionOculta>
        <thead>
          <tr className="bg-subtle">
            <Th>Código</Th>
            <Th className="px-2">Peça</Th>
            <Th largura={90} alinhar="right" className="px-2">
              Por un.
            </Th>
            <Th largura={80} alinhar="right" className="px-2">
              Total
            </Th>
            {editavel && <Th largura={52} />}
          </tr>
        </thead>
        <tbody>
          {pecas.map((p) => (
            <tr key={p.pecaId} className="border-b border-line-row last:border-b-0 hover:bg-subtle">
              <td className="px-[18px] py-1.5 font-mono text-pequeno text-ink-2">{p.codigo}</td>
              <td className="px-2 py-1.5 text-ink">{p.nome}</td>
              <td className="px-2 py-1.5 text-right font-mono text-ink-2">{p.porUnidade}</td>
              <td className="px-2 py-1.5 text-right font-mono font-medium text-ink">
                {p.total} <span className="text-rotulo font-normal text-muted">{p.unidade}</span>
              </td>
              {editavel && (
                <td className="py-1 pr-[18px] text-right">
                  <IconButton label={`Ajustar ${p.nome}`} onClick={() => abrir({ pecaId: p.pecaId, codigo: p.codigo, nome: p.nome, porUnidade: p.porUnidade })}>
                    <IconeLapis size={13} />
                  </IconButton>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <RodapeTabela
        direita={
          editavel && (
            <Button variant="link" size="sm" onClick={() => abrir({ pecaId: null, codigo: "", nome: "", porUnidade: 0 })}>
              + Incluir peça
            </Button>
          )
        }
      >
        {pecas.length} {pecas.length === 1 ? "tipo de peça" : "tipos de peça"} · <span className="font-mono">{totalUnidades}</span> unidades para × {quantidadeProjeto}
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
                  <Input id="qtd-peca" type="number" min={0} value={qtd} onChange={(e) => setQtd(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="w-[110px] font-mono" />
                </Field>
                <p className="m-0 pb-2 text-pequeno text-muted">
                  × {quantidadeProjeto} = <span className="font-mono text-ink">{qtd * quantidadeProjeto}</span>
                  {edicao.codigo ? ` (era ${edicao.porUnidade * quantidadeProjeto})` : ""}
                  {qtd === 0 && edicao.codigo ? " · retira a peça" : ""}
                </p>
              </div>
              <Field label="Motivo" htmlFor="motivo-peca" obrigatorio>
                <Textarea id="motivo-peca" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: só 2 tramos disponíveis; o cliente pediu vão menor" className="min-h-[72px]" />
              </Field>
              {erro && <p className="m-0 text-pequeno text-danger">{erro}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEdicao(null)} disabled={pendente}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={salvar} loading={pendente}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
