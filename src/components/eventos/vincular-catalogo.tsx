"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { SETORES } from "@/domain/constantes";
import { SETOR_LABEL } from "@/domain/os";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { vincularAoCatalogoAction } from "@/app/(app)/eventos/actions";
import type { OpcoesReferencia } from "./linha-ata-form";

type Modo = "PECA" | "PROJETO" | "NOVA_PECA";

const campo = "h-10 w-full rounded-lg border border-line-control bg-surface px-3 text-[13.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none";

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
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] border border-warning-border bg-warning-bg font-medium text-warning hover:border-warning",
          compacto ? "h-7 px-2 text-[11.5px]" : "h-8 px-2.5 text-[12px]",
        )}
      >
        Vincular ao catálogo
      </button>
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

  const aba = (m: Modo, rotulo: string) => (
    <button
      key={m}
      type="button"
      onClick={() => setModo(m)}
      aria-pressed={modo === m}
      className={cn("-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-1 pb-2 pt-1 text-[13px]", modo === m ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
    >
      {rotulo}
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title="Vincular ao catálogo" description="O item passa a somar as peças certas na OS. O texto original fica guardado e quem pediu é avisado." width={520}>
        <div className="flex flex-col gap-4">
          <div className="rounded-[8px] bg-warning-bg px-3.5 py-2.5 text-[13px] text-ink">
            Pedido: <span className="font-medium">“{linha.descricao}”</span> <span className="font-mono text-ink-3">× {linha.quantidade}</span>
          </div>

          <div className="flex gap-4 border-b border-line-soft">
            {aba("PECA", "Peça existente")}
            {aba("PROJETO", "Projeto padrão")}
            {podeCadastrar && aba("NOVA_PECA", "Cadastrar nova peça")}
          </div>

          {modo === "PECA" && (
            <div>
              <label className="text-[13px] font-medium text-ink">Peça do catálogo</label>
              <ComboBox className="mt-1.5" value={pecaId} onChange={setPecaId} placeholder="Buscar por código ou nome" opcoes={opcoes.pecas.map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo} · ${SETOR_LABEL[p.setor]}` }))} />
              <p className="mb-0 mt-1.5 text-[12px] text-muted">Busca sem acento; várias palavras em qualquer ordem.</p>
            </div>
          )}
          {modo === "PROJETO" && (
            <div>
              <label className="text-[13px] font-medium text-ink">Projeto padrão</label>
              <ComboBox className="mt-1.5" value={projetoId} onChange={setProjetoId} placeholder="Buscar projeto" opcoes={opcoes.projetos.map((p) => ({ value: p.id, label: p.nome, descricao: `${p.codigo}${p.categoria ? ` · ${p.categoria}` : ""}` }))} />
            </div>
          )}
          {modo === "NOVA_PECA" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="nova-codigo" className="text-[13px] font-medium text-ink">
                  Código
                </label>
                <input id="nova-codigo" value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value.toUpperCase() })} placeholder="Ex.: TOTEM-180" className={cn(campo, "mt-1.5 font-mono", campos.codigo && "border-danger")} />
                {campos.codigo && <p className="mb-0 mt-1 text-[12px] text-danger">{campos.codigo}</p>}
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink">Setor</label>
                <Select className="mt-1.5" value={nova.setor} onValueChange={(v) => setNova({ ...nova, setor: v })} placeholder="Selecione" invalid={Boolean(campos.setor)} opcoes={SETORES.map((s) => ({ value: s, label: SETOR_LABEL[s] }))} />
                {campos.setor && <p className="mb-0 mt-1 text-[12px] text-danger">Escolha o setor.</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="nova-nome" className="text-[13px] font-medium text-ink">
                  Nome
                </label>
                <input id="nova-nome" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} className={cn(campo, "mt-1.5", campos.nome && "border-danger")} />
              </div>
              <div>
                <label htmlFor="nova-familia" className="text-[13px] font-medium text-ink">
                  Família <span className="font-normal text-muted">opcional</span>
                </label>
                <input id="nova-familia" value={nova.familia} onChange={(e) => setNova({ ...nova, familia: e.target.value })} className={cn(campo, "mt-1.5")} />
              </div>
              <div>
                <label htmlFor="nova-unidade" className="text-[13px] font-medium text-ink">
                  Unidade
                </label>
                <input id="nova-unidade" value={nova.unidade} onChange={(e) => setNova({ ...nova, unidade: e.target.value })} className={cn(campo, "mt-1.5")} />
              </div>
            </div>
          )}

          {erro && <p className="m-0 text-[12.5px] text-danger">{erro}</p>}
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
