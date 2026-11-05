"use client";

import { useMemo, useState, useTransition } from "react";
import { definirAtendePorAction, salvarEstruturaEventoAction, salvarLogisticaEventoAction } from "@/app/(app)/projecao/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { EmptyState, Section } from "@/components/ui/layout";
import { toastSucesso } from "@/components/ui/toast";
import { ATENDE_POR } from "@/domain/constantes";
import { ATENDE_POR_LABEL, ESTRUTURA_LABEL, type DatasPrevistas } from "@/domain/logistica";
import { diaMesISO } from "@/lib/format";
import type { AtendePor, EstruturaEvento } from "@/server/db/schema";

type Opcao = { value: string; label: string };
const ORIGEM = { veiculo: "pelos veículos cadastrados", editada: "editada neste evento", calculada: "calculada pela data do evento" } as const;

export function DadosLogisticaEvento({ eventoId, podeEditar, saidaEditada, retornoEditado, datas, eventoPaiId, tourId, eventosPai, tours }: { eventoId: string; podeEditar: boolean; saidaEditada: string | null; retornoEditado: string | null; datas: DatasPrevistas; eventoPaiId: string | null; tourId: string | null; eventosPai: Opcao[]; tours: Opcao[] }) {
  const [saida, setSaida] = useState(saidaEditada ?? "");
  const [retorno, setRetorno] = useState(retornoEditado ?? "");
  const [pai, setPai] = useState(eventoPaiId ?? "");
  const [tour, setTour] = useState(tourId ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <Section titulo="Datas e agrupamento" sub="Usadas na Projeção. Em branco, a saída e o retorno são calculados." padded>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Saída prevista" htmlFor="ev-saida" optional hint={`Valendo: ${diaMesISO(datas.saida)}, ${ORIGEM[datas.origemSaida]}.`}>
          <Input id="ev-saida" type="date" className="numero" disabled={!podeEditar} value={saida} onChange={(e) => setSaida(e.target.value)} />
        </Field>
        <Field label="Retorno previsto" htmlFor="ev-retorno" optional hint={`Valendo: ${diaMesISO(datas.retorno)}, ${ORIGEM[datas.origemRetorno]}.`}>
          <Input id="ev-retorno" type="date" className="numero" disabled={!podeEditar} value={retorno} onChange={(e) => setRetorno(e.target.value)} />
        </Field>
        <Field label="Evento pai" htmlFor="ev-pai" optional hint="Agrupa etapas de uma prova ou série. Sem efeito logístico.">
          <Select id="ev-pai" disabled={!podeEditar} value={pai} onValueChange={setPai} opcoes={[{ value: "", label: "Nenhum" }, ...eventosPai]} />
        </Field>
        <Field label="Tour" htmlFor="ev-tour" optional hint="Eventos atendidos pelos mesmos veículos. A sequência fica em Cadastros logísticos.">
          <Select id="ev-tour" disabled={!podeEditar} value={tour} onValueChange={setTour} opcoes={[{ value: "", label: "Nenhum" }, ...tours]} />
        </Field>
      </div>
      {podeEditar && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            loading={pendente}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                const r = await salvarLogisticaEventoAction(eventoId, { saidaPrevista: saida || null, retornoPrevisto: retorno || null, eventoPaiId: pai || null, tourId: tour || null });
                if (!r.ok) return setErro(r.erro);
                toastSucesso(r.mensagem ?? "Salvo");
              })
            }
          >
            Salvar datas e agrupamento
          </Button>
          <FormError message={erro} />
        </div>
      )}
    </Section>
  );
}

export function EstruturaEvento({ eventoId, podeEditar, estrutura, fornecedor }: { eventoId: string; podeEditar: boolean; estrutura: EstruturaEvento; fornecedor: string | null }) {
  const [valor, setValor] = useState<EstruturaEvento>(estrutura);
  const [nome, setNome] = useState(fornecedor ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <Section titulo="Estrutura do evento" sub="Estrutura e tendas seguem este campo, menos as linhas que a cenografia já decidiu uma a uma." padded>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estrutura" htmlFor="ev-estrutura" hint={podeEditar ? undefined : "Só a cenografia altera este campo."}>
          <Select id="ev-estrutura" disabled={!podeEditar} value={valor} onValueChange={(v) => setValor(v as EstruturaEvento)} ordenarAlfabetico={false} opcoes={(["PROPRIA", "TERCEIRIZADA", "A_DEFINIR"] as const).map((e) => ({ value: e, label: ESTRUTURA_LABEL[e] }))} />
        </Field>
        {valor === "TERCEIRIZADA" && (
          <Field label="Fornecedor da estrutura" htmlFor="ev-fornecedor" optional>
            <Input id="ev-fornecedor" disabled={!podeEditar} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
        )}
      </div>
      {podeEditar && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            loading={pendente}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                const r = await salvarEstruturaEventoAction(eventoId, { estrutura: valor, fornecedor: nome || null });
                if (!r.ok) return setErro(r.erro);
                toastSucesso(r.mensagem ?? "Salvo");
              })
            }
          >
            Salvar estrutura
          </Button>
          <FormError message={erro} />
        </div>
      )}
    </Section>
  );
}

export type LinhaAtende = { id: string; nome: string; quantidade: number; destino: string | null; area: string; grupo: string; projeto: string | null; atendePor: AtendePor; aDefinir: boolean; herdado: boolean; almoxarifadoId: string | null; montador: string | null };

const HERDAR = "HERDAR";

/** "Atende por" de cada linha: uma a uma, ou em lote por grupo de material ou projeto. */
export function AtendePorEvento({ eventoId, podeEditar, linhas, almoxarifados }: { eventoId: string; podeEditar: boolean; linhas: LinhaAtende[]; almoxarifados: Opcao[] }) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [atende, setAtende] = useState<string>(HERDAR);
  const [almoxarifadoId, setAlmoxarifadoId] = useState("");
  const [montador, setMontador] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const grupos = useMemo(() => [...new Set(linhas.map((l) => l.grupo))], [linhas]);
  const projetos = useMemo(() => [...new Set(linhas.flatMap((l) => (l.projeto ? [l.projeto] : [])))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const marcarVarias = (ids: string[]) => setMarcadas((m) => (ids.every((i) => m.has(i)) ? new Set([...m].filter((i) => !ids.includes(i))) : new Set([...m, ...ids])));
  const sai = atende === HERDAR || atende === "GALPAO_NORTE" || atende === "LOCACAO_VIA_GALPAO";
  if (linhas.length === 0) {
    return (
      <Section titulo="Atende por">
        <EmptyState compact icone="lista" title="Nenhum item neste evento ainda" />
      </Section>
    );
  }
  return (
    <Section titulo="Atende por" sub="De onde sai cada linha. Marque e aplique, por linha ou em lote.">
      {podeEditar && (
        <div className="flex flex-col gap-3 border-b border-line-soft px-cartao py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-pequeno text-ink-3">Marcar:</span>
            {grupos.map((g) => (
              <Button key={g} variant="ghost" size="xs" onClick={() => marcarVarias(linhas.filter((l) => l.grupo === g).map((l) => l.id))}>
                {g}
              </Button>
            ))}
            {projetos.slice(0, 12).map((p) => (
              <Button key={p} variant="ghost" size="xs" onClick={() => marcarVarias(linhas.filter((l) => l.projeto === p).map((l) => l.id))}>
                {p}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[220px_200px_minmax(0,1fr)_auto] md:items-end">
            <Field label="Atende por" htmlFor="lote-atende">
              <Select id="lote-atende" value={atende} onValueChange={setAtende} ordenarAlfabetico={false} opcoes={[{ value: HERDAR, label: "Padrão do evento" }, ...ATENDE_POR.map((a) => ({ value: a, label: ATENDE_POR_LABEL[a] }))]} />
            </Field>
            <Field label="Almoxarifado" htmlFor="lote-alm" optional>
              <Select id="lote-alm" disabled={!sai} value={almoxarifadoId} onValueChange={setAlmoxarifadoId} opcoes={[{ value: "", label: "O principal" }, ...almoxarifados]} />
            </Field>
            <Field label="Complemento ao montador" htmlFor="lote-montador" optional hint="Sai do nosso galpão direto para o montador.">
              <Input id="lote-montador" disabled={atende !== "GALPAO_NORTE"} value={montador} onChange={(e) => setMontador(e.target.value)} />
            </Field>
            <Button
              variant="primary"
              size="md"
              loading={pendente}
              disabled={marcadas.size === 0}
              motivoDesabilitado="Marque ao menos uma linha."
              onClick={() =>
                iniciar(async () => {
                  setErro(null);
                  const r = await definirAtendePorAction(eventoId, { linhaIds: [...marcadas], atendePor: atende === HERDAR ? null : atende, almoxarifadoId: almoxarifadoId || null, montador: montador || null });
                  if (!r.ok) return setErro(r.erro);
                  toastSucesso(r.mensagem ?? "Salvo");
                  setMarcadas(new Set());
                })
              }
            >
              Aplicar em {marcadas.size} {marcadas.size === 1 ? "linha" : "linhas"}
            </Button>
          </div>
          <FormError message={erro} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse sm:min-w-[640px]">
          <caption className="sr-only">Linhas do evento e de onde sai cada uma</caption>
          <thead>
            <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
              {podeEditar && <th scope="col" className="w-10 py-2 pl-cartao"><span className="sr-only">Marcar</span></th>}
              <th scope="col" className={`px-3 py-2 ${podeEditar ? "" : "pl-cartao"}`}>Item</th>
              <th scope="col" className="px-3 py-2 text-right">Qtd.</th>
              <th scope="col" className="hidden px-3 py-2 md:table-cell">Local</th>
              <th scope="col" className="px-3 py-2 pr-cartao">Atende por</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-t border-line-row align-top">
                {podeEditar && (
                  <td className="py-2 pl-cartao">
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={`Marcar ${l.nome}`}
                      checked={marcadas.has(l.id)}
                      onChange={() => marcarVarias([l.id])}
                    />
                  </td>
                )}
                <th scope="row" className={`px-3 py-2 text-left font-normal ${podeEditar ? "" : "pl-cartao"}`}>
                  <span className="block text-corpo text-ink">{l.nome}</span>
                  <span className="text-rotulo text-ink-3">{l.grupo} · {l.area}</span>
                </th>
                <td className="numero px-3 py-2 text-right text-corpo font-medium">{l.quantidade.toLocaleString("pt-BR")}</td>
                <td className="hidden px-3 py-2 text-pequeno text-ink-2 md:table-cell">{l.destino ?? "—"}</td>
                <td className="px-3 py-2 pr-cartao text-pequeno text-ink-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {ATENDE_POR_LABEL[l.atendePor]}
                    {l.aDefinir && <Badge tom="warning">a definir</Badge>}
                    {!l.herdado && <Badge tom="muted">decidido na linha</Badge>}
                  </span>
                  {(l.montador || l.almoxarifadoId) && <span className="block text-rotulo text-ink-3">{[l.montador ? `para ${l.montador}` : null, almoxarifados.find((a) => a.value === l.almoxarifadoId)?.label].filter(Boolean).join(" · ")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
