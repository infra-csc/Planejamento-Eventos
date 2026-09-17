"use client";

import { useState, useTransition } from "react";
import { SETORES } from "@/domain/constantes";
import { SETOR_LABEL } from "@/domain/os";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TabsControladas } from "@/components/ui/tabs-nav";
import { toast } from "@/components/ui/toast";
import { vincularAoCatalogoAction } from "@/app/(app)/eventos/actions";
import type { OpcoesReferencia } from "./linha-ata-form";

type Modo = "PECA" | "PROJETO" | "NOVA_PECA";

/** Botão "Vincular ao catálogo" + modal. Usado na conferência, nos itens da OS e na fila da Biblioteca. */
export function VincularCatalogo({
  linha,
  opcoes,
  podeCadastrar,
  compacto = false,
}: {
  linha: { linhaId?: string | null; solicitacaoItemId?: string | null; descricao: string; quantidade: number };
  opcoes: OpcoesReferencia;
  podeCadastrar: boolean;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="parcial" size={compacto ? "xs" : "sm"} onClick={() => setAberto(true)}>
        {compacto ? "Vincular" : "Vincular ao catálogo"}
      </Button>
      {aberto && <VincularModal linha={linha} opcoes={opcoes} podeCadastrar={podeCadastrar} onFechar={() => setAberto(false)} />}
    </>
  );
}

function VincularModal({ linha, opcoes, podeCadastrar, onFechar }: { linha: { linhaId?: string | null; solicitacaoItemId?: string | null; descricao: string; quantidade: number }; opcoes: OpcoesReferencia; podeCadastrar: boolean; onFechar: () => void }) {
  const [modo, setModo] = useState<Modo>("PECA");
  const [pecaId, setPecaId] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [nova, setNova] = useState({ codigo: "", nome: linha.descricao, setor: "", familia: "", unidade: "un" });
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();

  const salvar = () => {
    setErro(null);
    setCampos({});
    const alvo =
      modo === "PECA" ? (pecaId ? { tipo: "PECA", pecaId } : null) : modo === "PROJETO" ? (projetoId ? { tipo: "PROJETO", projetoId } : null) : { tipo: "NOVA_PECA", peca: { ...nova, descricao: `Cadastrada a partir do pedido “${linha.descricao}”.` } };
    if (!alvo) return setErro(modo === "PECA" ? "Escolha a peça." : "Escolha o projeto.");
    iniciar(async () => {
      const r = await vincularAoCatalogoAction({ linhaId: linha.linhaId ?? null, solicitacaoItemId: linha.solicitacaoItemId ?? null }, alvo);
      if (!r.ok) {
        setErro(r.erro);
        if ("campos" in r && r.campos) setCampos(r.campos);
        return;
      }
      toast(`“${linha.descricao}” vinculado a ${r.dados?.rotulo ?? "item do catálogo"}`);
      onFechar();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title="Vincular ao catálogo" description="O item passa a somar as peças certas na OS. O texto original fica guardado e quem pediu é avisado." width={520}>
        <div className="flex flex-col gap-4">
          <div className="rounded-controle bg-warning-bg px-3.5 py-2.5 text-corpo text-ink">
            Pedido: <span className="font-medium">“{linha.descricao}”</span> <span className="font-mono text-ink-3">× {linha.quantidade}</span>
          </div>

          <TabsControladas
            compacta
            className="!mb-0"
            rotulo="Como vincular"
            valor={modo}
            onChange={setModo}
            abas={[
              { chave: "PECA" as Modo, label: "Peça existente" },
              { chave: "PROJETO" as Modo, label: "Projeto padrão" },
              ...(podeCadastrar ? [{ chave: "NOVA_PECA" as Modo, label: "Cadastrar nova peça" }] : []),
            ]}
          />

          {modo === "PECA" && (
            <div>
              <Label>Peça do catálogo</Label>
              <ComboBox value={pecaId} onChange={setPecaId} placeholder="Buscar por código ou nome" opcoes={opcoes.pecas.map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo} · ${SETOR_LABEL[p.setor]}` }))} />
              <p className="mb-0 mt-1.5 text-pequeno text-muted">Busca sem acento; várias palavras em qualquer ordem.</p>
            </div>
          )}
          {modo === "PROJETO" && (
            <div>
              <Label>Projeto padrão</Label>
              <ComboBox value={projetoId} onChange={setProjetoId} placeholder="Buscar projeto" opcoes={opcoes.projetos.map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo}${p.categoria ? ` · ${p.categoria}` : ""}` }))} />
            </div>
          )}
          {modo === "NOVA_PECA" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código" htmlFor="nova-codigo" error={campos.codigo}>
                <Input id="nova-codigo" value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value.toUpperCase() })} placeholder="Ex.: TOTEM-180" className="font-mono" />
              </Field>
              <Field label="Setor" error={campos.setor ? "Escolha o setor." : undefined}>
                <Select value={nova.setor} onValueChange={(v) => setNova({ ...nova, setor: v })} placeholder="Selecione" invalid={Boolean(campos.setor)} opcoes={SETORES.map((s) => ({ value: s, label: SETOR_LABEL[s] }))} />
              </Field>
              <Field label="Nome" htmlFor="nova-nome" error={campos.nome} className="sm:col-span-2">
                <Input id="nova-nome" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
              </Field>
              <Field label="Família" htmlFor="nova-familia" optional>
                <Input id="nova-familia" value={nova.familia} onChange={(e) => setNova({ ...nova, familia: e.target.value })} />
              </Field>
              <Field label="Unidade" htmlFor="nova-unidade">
                <Input id="nova-unidade" value={nova.unidade} onChange={(e) => setNova({ ...nova, unidade: e.target.value })} />
              </Field>
            </div>
          )}

          {erro && <p className="m-0 text-pequeno text-danger">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={pendente}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvar} loading={pendente}>
              {modo === "NOVA_PECA" ? "Cadastrar e vincular" : "Vincular"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
