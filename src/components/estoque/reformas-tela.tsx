"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { diaMes, formatarData, hojeISO } from "@/lib/format";
import { problemaConclusao } from "@/domain/estoque";
import { abrirReformaAction, concluirReformaAction, editarReformaAction } from "@/app/(app)/ativacao/actions";
import type { ReformaTela } from "@/server/services/ativacao";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ComboBox } from "@/components/ui/combobox";
import { Stepper } from "@/components/ui/stepper";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { EmptyState } from "@/components/ui/layout";
import { toastErro, toastSucesso } from "@/components/ui/toast";

type ItemOpcao = { id: string; nome: string; quantidade: number };
type Modal = { tipo: "nova" } | { tipo: "editar"; r: ReformaTela } | { tipo: "concluir"; r: ReformaTela } | null;

/** Reformas em andamento (com o que fazer em cada uma) e, embaixo, as concluídas. */
export function ReformasTela({ reformas, itens }: { reformas: ReformaTela[]; itens: ItemOpcao[] }) {
  const [modal, setModal] = useState<Modal>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const abertas = reformas.filter((r) => r.status === "ABERTA");
  const concluidas = reformas.filter((r) => r.status === "CONCLUIDA");
  const hoje = hojeISO();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 text-corpo text-ink-2">
          <Numero valor={abertas.reduce((a, r) => a + r.quantidade, 0)} /> {abertas.length === 1 ? "unidade" : "unidades"} em reforma
        </p>
        <Button variant="primary" className="ml-auto" onClick={() => setModal({ tipo: "nova" })} disabled={!itens.length}>
          <Icone nome="mais" />
          Enviar para reforma
        </Button>
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        {abertas.length === 0 ? (
          <EmptyState compact title="Nada em reforma" description="O que voltar danificado de um evento entra aqui pelo registro de retorno. Para separar um item do estoque, use Enviar para reforma." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2.5 pl-cartao">Item</th>
                  <th className="px-3 py-2.5 text-right">Qtd.</th>
                  <th className="px-3 py-2.5">Motivo</th>
                  <th className="px-3 py-2.5">Onde está</th>
                  <th className="px-3 py-2.5">Previsão</th>
                  <th className="px-3 py-2.5 pr-cartao">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {abertas.map((r) => {
                  const atrasada = r.previsao && r.previsao < hoje;
                  return (
                    <tr key={r.id} className="border-t border-line-row align-top">
                      <td className="px-3 py-2.5 pl-cartao text-corpo">
                        <Link href={`/ativacao/itens/${r.item.id}`} className="font-medium text-ink no-underline hover:underline">
                          {r.item.nome}
                        </Link>
                        <span className="block text-rotulo text-muted">
                          {r.evento ? (
                            <>
                              voltou do <Codigo>{r.evento.codigo}</Codigo> {r.evento.nome}
                            </>
                          ) : (
                            "separado no estoque"
                          )}{" "}
                          · desde {diaMes(r.criadoEm)}
                          {r.anexos.length > 0 && ` · ${r.anexos.length} ${r.anexos.length === 1 ? "foto/anexo" : "fotos/anexos"}`}
                        </span>
                      </td>
                      <td className="numero px-3 py-2.5 text-right text-corpo font-semibold text-warning">{r.quantidade}</td>
                      <td className="px-3 py-2.5 text-pequeno text-ink-2">{r.motivo || <span className="text-line-strong">—</span>}</td>
                      <td className="px-3 py-2.5 text-pequeno text-ink-2">{r.local || <span className="text-line-strong">—</span>}</td>
                      <td className="px-3 py-2.5 text-pequeno">{r.previsao ? <span className={atrasada ? "font-medium text-danger" : "text-ink-2"}>{formatarData(r.previsao)}{atrasada ? " · atrasada" : ""}</span> : <span className="text-line-strong">—</span>}</td>
                      <td className="px-3 py-2.5 pr-cartao text-right">
                        <span className="inline-flex gap-1.5">
                          <Button variant="ghost" size="xs" onClick={() => setModal({ tipo: "editar", r })}>
                            <Icone nome="lapis" />
                            Editar
                          </Button>
                          <Button variant="secondary" size="xs" onClick={() => setModal({ tipo: "concluir", r })}>
                            <Icone nome="check" />
                            Concluir
                          </Button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {concluidas.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setVerConcluidas((v) => !v)} aria-expanded={verConcluidas}>
            <Icone nome={verConcluidas ? "seta-cima" : "seta-baixo"} />
            {verConcluidas ? "Esconder" : "Ver"} reformas concluídas ({concluidas.length})
          </Button>
          {verConcluidas && (
            <ul className="m-0 mt-2 list-none divide-y divide-line-row rounded-cartao border border-line bg-surface p-0">
              {concluidas.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-cartao py-2.5 text-pequeno">
                  <Link href={`/ativacao/itens/${r.item.id}`} className="font-medium text-ink no-underline hover:underline">
                    {r.item.nome}
                  </Link>
                  <span className="text-ink-3">
                    {r.quantidade} em reforma · {r.consertados ?? 0} voltaram ao estoque{r.baixados ? ` · ${r.baixados} baixados` : ""}
                    {r.concluidaEm && ` · concluída em ${diaMes(r.concluidaEm)}`}
                  </span>
                  <Tag tom="success" className="ml-auto">
                    concluída
                  </Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={modal !== null} onOpenChange={(v) => !v && setModal(null)}>
        {modal?.tipo === "nova" && <FormNova itens={itens} onFechar={() => setModal(null)} />}
        {modal?.tipo === "editar" && <FormEditar key={modal.r.id} r={modal.r} onFechar={() => setModal(null)} />}
        {modal?.tipo === "concluir" && <FormConcluir key={modal.r.id} r={modal.r} onFechar={() => setModal(null)} />}
      </Dialog>
    </div>
  );
}

/** Separar itens do estoque para reforma, sem evento (ex.: achou danificado no galpão). Também usado na página do item. */
export function FormNova({ itens, itemFixo, onFechar }: { itens: ItemOpcao[]; itemFixo?: string; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [itemId, setItemId] = useState<string | null>(itemFixo ?? null);
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [local, setLocal] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const item = itens.find((i) => i.id === itemId);
  const salvar = () =>
    iniciar(async () => {
      if (!itemId) return setErro("Escolha o item.");
      const r = await abrirReformaAction({ itemId, quantidade, motivo: motivo || null, local: local || null, previsao: previsao || null });
      if (!r.ok) {
        setErro(r.erro);
        toastErro(r.erro);
        return;
      }
      toastSucesso(`${quantidade} ${item?.nome ?? "itens"} em reforma`);
      onFechar();
      router.refresh();
    });
  return (
    <DialogContent title="Enviar para reforma" description="Sai do estoque em posse e fica em Reformas até você concluir." width={520}>
      <div className="flex flex-col gap-3.5">
        {!itemFixo && (
          <Field label="Item" htmlFor="ref-item" obrigatorio>
            <ComboBox id="ref-item" value={itemId} onChange={(v) => setItemId(v || null)} placeholder="Escolha o item" opcoes={itens.map((i) => ({ value: i.id, label: i.nome, descricao: `${i.quantidade} em posse` }))} />
          </Field>
        )}
        <Field label="Quantidade" htmlFor="ref-qtd" hint={item ? `${item.quantidade} em posse` : undefined}>
          <Stepper id="ref-qtd" valor={quantidade} min={1} max={item?.quantidade} onChange={setQuantidade} label="Quantidade para reforma" />
        </Field>
        <Field label="Motivo" htmlFor="ref-motivo" optional>
          <Textarea id="ref-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} className="min-h-[64px]" placeholder="Ex.: tecido rasgado, haste torta" />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Onde está" htmlFor="ref-local" optional>
            <Input id="ref-local" value={local} maxLength={120} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: marcenaria, costureira" />
          </Field>
          <Field label="Previsão de volta" htmlFor="ref-prev" optional>
            <Input id="ref-prev" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </Field>
        </div>
        {erro && <FormError message={erro} />}
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={salvar} loading={pendente}>
          Enviar para reforma
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function FormEditar({ r, onFechar }: { r: ReformaTela; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [motivo, setMotivo] = useState(r.motivo ?? "");
  const [local, setLocal] = useState(r.local ?? "");
  const [previsao, setPrevisao] = useState(r.previsao ?? "");
  const salvar = () =>
    iniciar(async () => {
      const x = await editarReformaAction(r.id, { motivo: motivo || null, local: local || null, previsao: previsao || null });
      if (!x.ok) return toastErro(x.erro);
      toastSucesso("Reforma atualizada");
      onFechar();
      router.refresh();
    });
  return (
    <DialogContent title={`Reforma · ${r.item.nome}`} description={`${r.quantidade} em reforma. Fotos do estrago e orçamentos ficam na página do item.`} width={520}>
      <div className="flex flex-col gap-3.5">
        <Field label="Motivo" htmlFor="ed-motivo" optional>
          <Textarea id="ed-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} className="min-h-[64px]" />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Onde está" htmlFor="ed-local" optional>
            <Input id="ed-local" value={local} maxLength={120} onChange={(e) => setLocal(e.target.value)} />
          </Field>
          <Field label="Previsão de volta" htmlFor="ed-prev" optional>
            <Input id="ed-prev" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={salvar} loading={pendente}>
          Salvar
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Concluir: começa com tudo consertado; o que não tem conserto vai para baixados. */
function FormConcluir({ r, onFechar }: { r: ReformaTela; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [consertados, setConsertados] = useState(r.quantidade);
  const baixados = r.quantidade - consertados;
  const erro = problemaConclusao(r.quantidade, consertados, baixados);
  const salvar = () =>
    iniciar(async () => {
      const x = await concluirReformaAction(r.id, consertados, baixados);
      if (!x.ok) return toastErro(x.erro);
      toastSucesso(`${consertados} ${r.item.nome} de volta ao estoque`);
      onFechar();
      router.refresh();
    });
  return (
    <DialogContent title={`Concluir reforma · ${r.item.nome}`} description={`${r.quantidade} em reforma. Os consertados voltam ao estoque em posse; os outros são baixados.`} width={480}>
      <div className="flex flex-col gap-3.5">
        <Field label="Consertados (voltam ao estoque)" htmlFor="conc-ok">
          <Stepper id="conc-ok" valor={consertados} min={0} max={r.quantidade} onChange={setConsertados} label="Consertados" />
        </Field>
        <p className="m-0 text-corpo text-ink-2">
          Baixados (sem conserto): <b className="numero font-semibold text-danger">{baixados}</b>
        </p>
        {erro && <FormError message={erro} />}
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={salvar} loading={pendente} disabled={Boolean(erro)}>
          Concluir reforma
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
