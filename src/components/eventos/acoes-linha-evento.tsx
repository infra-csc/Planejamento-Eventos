"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ajustarTendasDoLocalAction, alterarQuantidadeLinhaAction } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Textarea } from "@/components/ui/field";
import { toastSucesso } from "@/components/ui/toast";
import { Icone } from "@/components/ui/icons";
import { Stepper } from "@/components/ui/stepper";

type Linha = { id: string; nome: string; quantidade: number; veioDePedido: boolean };

/**
 * Editar e remover uma linha do evento direto da visão geral (admin e logística), pelo mesmo caminho da aba Ata:
 * antes de fechar a ata o motivo é opcional; com a ata fechada a justificativa é obrigatória, sai nova versão da OS e
 * a área é avisada. "Peças" leva à página do item, onde se mexe na composição do projeto.
 */
export function AcoesLinhaEvento({ eventoId, linha, ataFechada, hrefPecas, tenda }: { eventoId: string; linha: Linha; ataFechada: boolean; hrefPecas?: string; tenda?: TendaDoLocal }) {
  const [modo, setModo] = useState<"editar" | "remover" | null>(null);
  const descricaoPedido = linha.veioDePedido ? " Como veio de um pedido, a resposta do item é corrigida junto." : "";
  return (
    // A linha da tabela é clicável (abre o item): cliques e teclas daqui, inclusive de dentro das janelas (que no React
    // sobem pela árvore de componentes), não chegam a ela.
    <span className="inline-flex flex-nowrap items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {hrefPecas && (
        <Link href={hrefPecas} className="inline-flex min-h-8 items-center gap-1 rounded-controle px-2 text-rotulo font-medium text-ink-2 no-underline hover:bg-subtle hover:text-ink" aria-label={`Peças de ${linha.nome}`}>
          <Icone nome="camadas" className="size-3.5" />
          Peças
        </Link>
      )}
      <Button variant="ghost" size="xs" onClick={() => setModo("editar")} aria-label={tenda ? `Editar tendas de ${linha.nome}` : `Editar quantidade de ${linha.nome}`}>
        <Icone nome="lapis" className="size-3.5" />
        Editar
      </Button>
      <Button variant="ghost" size="xs" className="px-2 text-danger hover:text-danger" onClick={() => setModo("remover")} aria-label={`Remover ${linha.nome}`} title="Remover do evento">
        <Icone nome="lixeira" className="size-3.5" />
      </Button>
      {modo === "editar" && tenda && <EditarTendaDialog eventoId={eventoId} tenda={tenda} ataFechada={ataFechada} onFechar={() => setModo(null)} />}
      {modo === "editar" && !tenda && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setModo(null)}
          title={`Editar ${linha.nome}`}
          description={ataFechada ? `A ata já foi fechada: o ajuste gera nova versão da OS e avisa a área.${descricaoPedido}` : "O ajuste fica no histórico do evento."}
          confirmLabel="Salvar quantidade"
          reasonLabel={ataFechada ? "Justificativa" : "Motivo (opcional)"}
          reasonRequired={ataFechada}
          action={alterarQuantidadeLinhaAction}
          // A quantidade que a tela mostra: se outra pessoa mudar a linha antes, o servidor recusa.
          hidden={{ eventoId, linhaId: linha.id, quantidadeEsperada: String(linha.quantidade) }}
        >
          <Field label="Quantidade" htmlFor={`qtd-${linha.id}`}>
            <QuantidadeEditavel id={`qtd-${linha.id}`} inicial={linha.quantidade} />
          </Field>
        </ConfirmDialog>
      )}
      {modo === "remover" && (
        <ConfirmDialog
          open
          danger
          onOpenChange={(o) => !o && setModo(null)}
          title={`Remover ${linha.nome}?`}
          description={ataFechada ? `Sai da OS numa nova versão e a área é avisada.${descricaoPedido} Fica no histórico.` : "Sai da ata; fica no histórico do evento."}
          confirmLabel="Remover do evento"
          reasonLabel={ataFechada ? "Justificativa" : "Motivo (opcional)"}
          reasonRequired={ataFechada}
          action={alterarQuantidadeLinhaAction}
          hidden={{ eventoId, linhaId: linha.id, quantidadeEsperada: String(linha.quantidade), quantidade: "0" }}
        />
      )}
    </span>
  );
}

/** − e + com o valor num input oculto de mesmo nome que a ação lê. */
function QuantidadeEditavel({ id, inicial }: { id: string; inicial: number }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <Stepper id={id} valor={valor} onChange={setValor} min={1} autoFocus />
      <input type="hidden" name="quantidade" value={valor} />
    </>
  );
}

/** Tenda de um local: quantas tendas e os totais do local que variam (fechamentos e, na 5×5, calhas). */
export type TendaDoLocal = { linhaIds: string[]; local: string | null; tamanho: string; tendas: number; fechamentos: number; calhas: number; temCalha: boolean };

/**
 * Quadro da tenda, como na solicitação e na conferência: no local, quantas tendas, quantos fechamentos e calhas no
 * total. O servidor redistribui pelas linhas do local (mesma regra do quadro). Com a ata fechada, pede justificativa.
 */
export function EditarTendaDialog({ eventoId, tenda, ataFechada, onFechar }: { eventoId: string; tenda: TendaDoLocal; ataFechada: boolean; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [tendas, setTendas] = useState(tenda.tendas);
  const [fechamentos, setFechamentos] = useState(tenda.fechamentos);
  const [calhas, setCalhas] = useState(tenda.calhas);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const salvar = () =>
    iniciar(async () => {
      if (ataFechada && !motivo.trim()) return setErro("Informe a justificativa: a ata já foi fechada.");
      const r = await ajustarTendasDoLocalAction(eventoId, { linhaIds: tenda.linhaIds, tendas, totais: { fechamento: fechamentos, ...(tenda.temCalha ? { calha: calhas } : {}) }, motivo }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (!r.ok) return setErro(r.erro);
      toastSucesso(ataFechada ? "Tendas ajustadas — OS atualizada" : "Tendas ajustadas");
      onFechar();
      router.refresh();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={`Tenda ${tenda.tamanho}${tenda.local ? ` · ${tenda.local}` : ""}`} description={ataFechada ? "Totais do local. Sai nova versão da OS e a área é avisada." : "Totais do local, como no quadro de tendas da solicitação."} width={520}>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Tendas" htmlFor="tenda-qtd" hint="0 tira o local">
            <Stepper id="tenda-qtd" valor={tendas} min={0} onChange={setTendas} label="Tendas no local" />
          </Field>
          <Field label="Fechamentos" htmlFor="tenda-fech" hint="total do local">
            <Stepper id="tenda-fech" valor={fechamentos} min={0} onChange={setFechamentos} label="Fechamentos no local" />
          </Field>
          {tenda.temCalha && (
            <Field label="Calhas" htmlFor="tenda-calha" hint="total do local">
              <Stepper id="tenda-calha" valor={calhas} min={0} onChange={setCalhas} label="Calhas no local" />
            </Field>
          )}
        </div>
        <div className="mt-3.5">
          <Field label={ataFechada ? "Justificativa" : "Motivo"} htmlFor="tenda-motivo" obrigatorio={ataFechada} optional={!ataFechada}>
            <Textarea id="tenda-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} className="min-h-[64px]" placeholder="Fica registrado no histórico, com seu nome e a hora." />
          </Field>
        </div>
        {erro && <FormError message={erro} />}
        <DialogFooter>
          <Button variant="primary" onClick={salvar} loading={pendente}>
            Salvar tendas
          </Button>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
