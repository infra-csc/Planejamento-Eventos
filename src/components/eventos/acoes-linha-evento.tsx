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
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";

type Linha = { id: string; nome: string; quantidade: number; veioDePedido: boolean };

/**
 * Editar e remover uma linha do evento (visão geral e página do item; admin e logística), pelo mesmo caminho da aba
 * Ata: antes de fechar a ata o motivo é opcional; com a ata fechada a justificativa é obrigatória, sai nova versão da
 * OS e a área é avisada. "Peças" leva à página do item, onde se mexe na composição do projeto.
 * `aoRemover`: para onde ir quando a linha deixa de existir (a página do item não tem mais o que mostrar).
 */
export function AcoesLinhaEvento({
  eventoId,
  linha,
  ataFechada,
  hrefPecas,
  tenda,
  aoRemover,
  tamanho = "xs",
  extra,
}: {
  eventoId: string;
  linha: Linha;
  ataFechada: boolean;
  hrefPecas?: string;
  tenda?: TendaDoLocal;
  aoRemover?: string;
  tamanho?: "xs" | "md";
  /** Ação a mais antes das outras (ex.: "Vincular" num item fora do catálogo), protegida do clique da linha. */
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"editar" | "remover" | null>(null);
  const descricaoPedido = linha.veioDePedido ? " Como veio de um pedido, a resposta do item é corrigida junto." : "";
  // "a definir" (0): o lápis serve para definir o número; o passo começa em 1.
  const aDefinir = linha.quantidade === 0;
  const removida = aoRemover ? () => router.push(aoRemover) : undefined;
  return (
    // A linha da tabela é clicável (abre o item): cliques e teclas daqui, inclusive de dentro das janelas (que no React
    // sobem pela árvore de componentes), não chegam a ela.
    <span className="inline-flex flex-nowrap items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {extra}
      {hrefPecas && (
        <Link href={hrefPecas} className="inline-flex min-h-8 items-center gap-1 rounded-controle px-2 text-rotulo font-medium text-ink-2 no-underline hover:bg-subtle hover:text-ink max-md:min-h-10" aria-label={`Peças de ${linha.nome}`}>
          <Icone nome="camadas" className="size-3.5" />
          Peças
        </Link>
      )}
      <Button variant={tamanho === "md" ? "secondary" : "ghost"} size={tamanho} onClick={() => setModo("editar")} aria-label={tenda ? `Editar tendas de ${linha.nome}` : `${aDefinir ? "Definir" : "Editar"} quantidade de ${linha.nome}`}>
        <Icone nome="lapis" className="size-3.5" />
        {aDefinir && !tenda ? "Definir" : tamanho === "md" ? (tenda ? "Editar tendas" : "Editar quantidade") : "Editar"}
      </Button>
      <Button
        variant={tamanho === "md" ? "dangerOutline" : "ghost"}
        size={tamanho}
        className={tamanho === "md" ? undefined : "px-2 text-danger hover:text-danger"}
        onClick={() => setModo("remover")}
        aria-label={`Remover ${linha.nome}`}
        title="Remover do evento"
      >
        <Icone nome="lixeira" className="size-3.5" />
        {tamanho === "md" && "Remover"}
      </Button>
      {modo === "editar" && tenda && <EditarTendaDialog eventoId={eventoId} tenda={tenda} ataFechada={ataFechada} onFechar={() => setModo(null)} aoRemover={aoRemover} />}
      {modo === "editar" && !tenda && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setModo(null)}
          title={`${aDefinir ? "Definir" : "Editar"} ${linha.nome}`}
          description={ataFechada ? `A ata já foi fechada: o ajuste gera nova versão da OS e avisa a área.${descricaoPedido}` : "O ajuste fica no histórico do evento."}
          confirmLabel="Salvar quantidade"
          reasonLabel={ataFechada ? "Justificativa" : "Motivo (opcional)"}
          reasonRequired={ataFechada}
          action={alterarQuantidadeLinhaAction}
          // A quantidade que a tela mostra: se outra pessoa mudar a linha antes, o servidor recusa.
          hidden={{ eventoId, linhaId: linha.id, quantidadeEsperada: String(linha.quantidade) }}
        >
          <Field label="Quantidade" htmlFor={`qtd-${linha.id}`} hint="Para tirar do evento, use Remover.">
            <QuantidadeEditavel id={`qtd-${linha.id}`} inicial={Math.max(1, linha.quantidade)} />
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
          onSuccess={removida}
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
export function EditarTendaDialog({ eventoId, tenda, ataFechada, onFechar, aoRemover }: { eventoId: string; tenda: TendaDoLocal; ataFechada: boolean; onFechar: () => void; aoRemover?: string }) {
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
      toastSucesso(tendas === 0 ? "Local tirado do evento" : ataFechada ? "Tendas ajustadas — OS atualizada" : "Tendas ajustadas");
      onFechar();
      if (tendas === 0 && aoRemover) router.push(aoRemover);
      else router.refresh();
    });
  // Mais de uma linha no mesmo local (ex.: uma da reunião e outra incluída depois): o quadro mexe na soma delas.
  const somaDeLinhas = tenda.linhaIds.length > 1 ? ` Soma das ${tenda.linhaIds.length} linhas deste local.` : "";
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={`Tenda ${tenda.tamanho}${tenda.local ? ` · ${tenda.local}` : ""}`} description={`${ataFechada ? "Totais do local. Sai nova versão da OS e a área é avisada." : "Totais do local, como no quadro de tendas da solicitação."}${somaDeLinhas}`} width={520}>
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
          <Button variant={tendas === 0 ? "danger" : "primary"} onClick={salvar} loading={pendente}>
            {tendas === 0 ? "Tirar o local" : "Salvar tendas"}
          </Button>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Todas as tendas de um projeto no evento num quadro só, um local por linha (como na solicitação): tendas, fechamentos
 * e calhas de cada local, com o total embaixo. Salva só os locais que mudaram, um por vez (mesma ação do quadro do local).
 */
export function EditarTendasDoItem({ eventoId, nome, locais, ataFechada, tamanho = "xs" }: { eventoId: string; nome: string; locais: TendaDoLocal[]; ataFechada: boolean; tamanho?: "xs" | "sm" }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Button variant={tamanho === "sm" ? "secondary" : "ghost"} size={tamanho} onClick={() => setAberto(true)} aria-label={`Editar todas as tendas de ${nome}`}>
        <Icone nome="lapis" className="size-3.5" />
        {tamanho === "sm" ? "Editar todos os locais" : "Editar tendas"}
      </Button>
      {aberto && <QuadroTendasDialog eventoId={eventoId} nome={nome} locais={locais} ataFechada={ataFechada} onFechar={() => setAberto(false)} />}
    </span>
  );
}

function QuadroTendasDialog({ eventoId, nome, locais, ataFechada, onFechar }: { eventoId: string; nome: string; locais: TendaDoLocal[]; ataFechada: boolean; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [valores, setValores] = useState(locais.map((l) => ({ tendas: l.tendas, fechamentos: l.fechamentos, calhas: l.calhas })));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const temCalha = locais.some((l) => l.temCalha);
  const mudou = (i: number) => valores[i].tendas !== locais[i].tendas || valores[i].fechamentos !== locais[i].fechamentos || (locais[i].temCalha && valores[i].calhas !== locais[i].calhas);
  const alterados = locais.map((_, i) => i).filter(mudou);
  const total = (k: "tendas" | "fechamentos" | "calhas") => valores.reduce((a, v) => a + v[k], 0);
  const mudar = (i: number, k: "tendas" | "fechamentos" | "calhas", v: number) => setValores((atual) => atual.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const salvar = () =>
    iniciar(async () => {
      if (!alterados.length) return onFechar();
      if (ataFechada && !motivo.trim()) return setErro("Informe a justificativa: a ata já foi fechada.");
      for (const i of alterados) {
        const l = locais[i];
        const v = valores[i];
        const r = await ajustarTendasDoLocalAction(eventoId, { linhaIds: l.linhaIds, tendas: v.tendas, totais: { fechamento: v.fechamentos, ...(l.temCalha ? { calha: v.calhas } : {}) }, motivo }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
        if (!r.ok) {
          router.refresh();
          return setErro(`${l.local ?? "Local não informado"}: ${r.erro}`);
        }
      }
      toastSucesso(`${alterados.length} ${alterados.length === 1 ? "local ajustado" : "locais ajustados"}${ataFechada ? " — OS atualizada" : ""}`);
      onFechar();
      router.refresh();
    });
  const celula = "border-b border-line-row px-2 py-2";
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent title={`${nome} · todos os locais`} description={ataFechada ? "Mude o que precisar em cada local. Sai nova versão da OS e a área é avisada." : "Mude o que precisar em cada local, como no quadro de tendas da solicitação. 0 tendas tira o local."} width={temCalha ? 760 : 640}>
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-rotulo text-ink-3">
                <th scope="col" className="border-b border-line-soft px-2 py-1.5 font-medium">Local</th>
                <th scope="col" className="border-b border-line-soft px-2 py-1.5 font-medium">Tendas</th>
                <th scope="col" className="border-b border-line-soft px-2 py-1.5 font-medium">Fechamentos</th>
                {temCalha && <th scope="col" className="border-b border-line-soft px-2 py-1.5 font-medium">Calhas</th>}
              </tr>
            </thead>
            <tbody>
              {locais.map((l, i) => (
                <tr key={l.linhaIds.join("|")} className={mudou(i) ? "bg-selected" : undefined}>
                  <th scope="row" className={`${celula} text-pequeno font-medium text-ink`}>
                    {l.local ?? <span className="text-muted">local não informado</span>}
                    {valores[i].tendas === 0 && <span className="block text-rotulo font-normal text-danger">sai do evento</span>}
                  </th>
                  <td className={celula}>
                    <Stepper id={`q-tendas-${i}`} valor={valores[i].tendas} min={0} onChange={(v) => mudar(i, "tendas", v)} label={`Tendas em ${l.local ?? "local não informado"}`} />
                  </td>
                  <td className={celula}>
                    <Stepper id={`q-fech-${i}`} valor={valores[i].fechamentos} min={0} onChange={(v) => mudar(i, "fechamentos", v)} label={`Fechamentos em ${l.local ?? "local não informado"}`} />
                  </td>
                  {temCalha && <td className={celula}>{l.temCalha ? <Stepper id={`q-calha-${i}`} valor={valores[i].calhas} min={0} onChange={(v) => mudar(i, "calhas", v)} label={`Calhas em ${l.local ?? "local não informado"}`} /> : "—"}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-subtle text-pequeno font-semibold text-ink">
                <th scope="row" className="px-2 py-2 text-left">Total</th>
                <td className="numero px-2 py-2">{total("tendas")} tendas</td>
                <td className="numero px-2 py-2">{total("fechamentos")} fechamentos</td>
                {temCalha && <td className="numero px-2 py-2">{total("calhas")} calhas</td>}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3.5">
          <Field label={ataFechada ? "Justificativa" : "Motivo"} htmlFor="quadro-motivo" obrigatorio={ataFechada} optional={!ataFechada}>
            <Textarea id="quadro-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} className="min-h-[56px]" placeholder="Fica registrado no histórico de cada local alterado." />
          </Field>
        </div>
        {erro && <FormError message={erro} />}
        <DialogFooter>
          <Button variant="primary" onClick={salvar} loading={pendente} disabled={!alterados.length}>
            {alterados.length ? `Salvar ${alterados.length} ${alterados.length === 1 ? "local" : "locais"}` : "Nada mudou"}
          </Button>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Incluir item" (admin e logística): o que ficou esquecido entra pelo mesmo formulário da conferência e dos itens da
 * OS. Antes da ata entra na ata; depois, entra na OS com justificativa (nova versão, área avisada).
 */
export function IncluirItemEvento({ eventoId, ataFechada, opcoes, areas }: { eventoId: string; ataFechada: boolean; opcoes: OpcoesReferencia; areas: Array<{ id: string; nome: string }> }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAberto(true)}>
        <Icone nome="mais" />
        Incluir item
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && (
          <DialogContent
            title={ataFechada ? "Incluir item na OS" : "Incluir item na ata"}
            description={ataFechada ? "A ata já foi fechada: o item entra na OS com justificativa, sai nova versão e a área é avisada." : "Projeto padrão, peça do catálogo ou item fora do catálogo. Fica no histórico como inclusão da logística."}
            width={520}
          >
            <LinhaAtaForm eventoId={eventoId} opcoes={opcoes} areas={areas} exigeJustificativa={ataFechada} rotuloEnviar={ataFechada ? "Incluir na OS" : "Incluir na ata"} onDone={() => setAberto(false)} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
