"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previaContagemPlanilhaAction, registrarContagemAction } from "@/app/(app)/projecao/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComboBox, type OpcaoCombo } from "@/components/ui/combobox";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { EmptyState, Section } from "@/components/ui/layout";
import { toastSucesso } from "@/components/ui/toast";
import { diaMesISO, hojeISO } from "@/lib/format";
import type { SugestaoContagem } from "@/domain/saldo";

type PecaContagem = { id: string; codigo: string; nome: string; unidade: string; saldo: number; sugestao: SugestaoContagem };
type LinhaLocador = { chave: number; pecaId: string; locadorId: string; contado: string };
type Historico = { id: string; dataContagem: string; responsavel: string; linhas: number; observacao: string | null };

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const POR_VEZ = 150;

/**
 * Contagem de saldo: digita o que viu, ou importa a planilha. O campo em branco é peça não contada e não muda nada.
 * O saldo não é editado: o servidor compara com a soma dos lançamentos e grava só a diferença.
 */
export function ContagemTela({ almoxarifadoId, almoxarifadoNome, jaContado, pecas, locadores, saldosDeLocador, historico }: { almoxarifadoId: string; almoxarifadoNome: string; jaContado: boolean; pecas: PecaContagem[]; locadores: Array<{ id: string; nome: string }>; saldosDeLocador: Array<{ pecaId: string; locadorId: string | null; quantidade: number }>; historico: Historico[] }) {
  const router = useRouter();
  const [data, setData] = useState(hojeISO());
  const [justificativa, setJustificativa] = useState("");
  const [contado, setContado] = useState<Record<string, string>>({});
  const [deLocador, setDeLocador] = useState<LinhaLocador[]>([]);
  const [busca, setBusca] = useState("");
  const [soPreenchidas, setSoPreenchidas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [errosPlanilha, setErrosPlanilha] = useState<string[]>([]);
  const [pendente, iniciar] = useTransition();
  const [lendo, iniciarLeitura] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const proximaChave = useRef(0);

  const opcoesPecas: OpcaoCombo[] = useMemo(() => pecas.map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo })), [pecas]);
  const filtradas = useMemo(() => {
    const q = semAcento(busca.trim());
    return pecas.filter((p) => (!q || semAcento(`${p.codigo} ${p.nome}`).includes(q)) && (!soPreenchidas || (contado[p.id] ?? "") !== ""));
  }, [pecas, busca, soPreenchidas, contado]);
  const comSugestao = pecas.filter((p) => p.sugestao).length;
  const preenchidas = Object.values(contado).filter((v) => v !== "").length + deLocador.filter((l) => l.contado !== "").length;
  const diferencas = pecas.filter((p) => (contado[p.id] ?? "") !== "" && Number(contado[p.id]) !== p.saldo).length;

  const usarSugestoes = () => setContado((c) => ({ ...Object.fromEntries(pecas.flatMap((p) => (p.sugestao ? [[p.id, String(p.sugestao.quantidade)]] : []))), ...c }));

  const importar = (f: File) =>
    iniciarLeitura(async () => {
      setErro(null);
      setErrosPlanilha([]);
      const fd = new FormData();
      fd.set("arquivo", f);
      const r = await previaContagemPlanilhaAction(fd);
      if (input.current) input.current.value = "";
      if (!r.ok) return setErro(r.erro);
      const novas = { ...contado };
      const locadorNovas: LinhaLocador[] = [...deLocador];
      for (const l of r.dados ?? []) {
        if (l.erro || l.contado === null || !l.pecaId) continue;
        if (l.locadorId) locadorNovas.push({ chave: ++proximaChave.current, pecaId: l.pecaId, locadorId: l.locadorId, contado: String(l.contado) });
        else novas[l.pecaId] = String(l.contado);
      }
      setContado(novas);
      setDeLocador(locadorNovas);
      setSoPreenchidas(true);
      setErrosPlanilha((r.dados ?? []).filter((l) => l.erro).map((l) => `Linha ${l.linha}: ${l.erro}`));
    });

  const registrar = () =>
    iniciar(async () => {
      setErro(null);
      const linhas = [
        ...Object.entries(contado).flatMap(([pecaId, v]) => (v === "" ? [] : [{ pecaId, locadorId: null as string | null, contado: Number(v) }])),
        ...deLocador.flatMap((l) => (l.contado === "" || !l.pecaId || !l.locadorId ? [] : [{ pecaId: l.pecaId, locadorId: l.locadorId as string | null, contado: Number(l.contado) }])),
      ];
      const r = await registrarContagemAction({ almoxarifadoId, dataContagem: data, justificativa: justificativa || null, linhas });
      if (!r.ok) return setErro(r.erro);
      toastSucesso(r.dados && r.dados.diferencas > 0 ? `Contagem registrada: ${r.dados.diferencas} ${r.dados.diferencas === 1 ? "diferença lançada" : "diferenças lançadas"} (${r.dados.numero})` : "Contagem registrada, sem diferença de saldo");
      setContado({});
      setDeLocador([]);
      setJustificativa("");
      setSoPreenchidas(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <Section padded>
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-start">
          <Field label="Data da contagem" htmlFor="contagem-data" obrigatorio>
            <Input id="contagem-data" type="date" max={hojeISO()} className="numero" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Justificativa" htmlFor="contagem-justificativa" optional={!jaContado} obrigatorio={jaContado} hint={jaContado ? "Obrigatória se a contagem mudar o saldo: vira ajuste de inventário." : "A primeira contagem é o saldo inicial."}>
            <Input id="contagem-justificativa" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-2 md:pt-6">
            <a href="/api/contagem/modelo" className="inline-flex min-h-10 items-center gap-1.5 text-pequeno font-medium text-accent no-underline hover:underline">
              <Icone nome="download" />
              Baixar modelo
            </a>
            <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label="Planilha de contagem" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
            <Button variant="secondary" size="md" loading={lendo} onClick={() => input.current?.click()}>
              <Icone nome="seta-cima" />
              Importar planilha
            </Button>
          </div>
        </div>
        {errosPlanilha.length > 0 && (
          <div role="alert" className="mt-3 rounded-controle border border-danger-border bg-danger-bg px-3 py-2 text-pequeno text-danger">
            <p className="m-0 font-medium">{errosPlanilha.length} {errosPlanilha.length === 1 ? "linha ficou de fora" : "linhas ficaram de fora"}:</p>
            <ul className="m-0 mt-1 max-h-32 list-none overflow-y-auto p-0">
              {errosPlanilha.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section
        titulo={`Peças de ${almoxarifadoNome}`}
        sub="Em branco = não contada, não muda nada. Proprietário Norte. Peça de locador vai no bloco abaixo."
        acoes={
          comSugestao > 0 && !jaContado ? (
            <Button variant="secondary" size="sm" onClick={usarSugestoes}>
              Usar os {comSugestao} números do cadastro antigo
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-cartao py-2.5">
          <Input aria-label="Buscar peça" placeholder="Buscar peça ou código" className="max-w-xs" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-pequeno text-ink-2">
            <input type="checkbox" checked={soPreenchidas} onChange={(e) => setSoPreenchidas(e.target.checked)} />
            Só as preenchidas
          </label>
          <span className="numero ml-auto text-pequeno text-ink-3">{filtradas.length} {filtradas.length === 1 ? "peça" : "peças"}</span>
        </div>
        {filtradas.length === 0 ? (
          <EmptyState compact icone="busca" title="Nenhuma peça com este filtro" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Quantidade contada por peça</caption>
              <thead>
                <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                  <th scope="col" className="px-cartao py-2">Peça</th>
                  <th scope="col" className="w-24 px-3 py-2 text-right">Saldo</th>
                  <th scope="col" className="hidden w-40 px-3 py-2 text-right md:table-cell">Cadastro antigo</th>
                  <th scope="col" className="w-32 px-3 py-2 pr-cartao text-right">Contado</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, POR_VEZ).map((p) => {
                  const v = contado[p.id] ?? "";
                  const mudou = v !== "" && Number(v) !== p.saldo;
                  return (
                    <tr key={p.id} className="border-t border-line-row">
                      <th scope="row" className="px-cartao py-1.5 text-left font-normal">
                        <span className="block text-corpo text-ink">{p.nome}</span>
                        <span className="font-mono text-rotulo text-ink-3">{p.codigo}</span>
                      </th>
                      <td className="numero px-3 py-1.5 text-right text-corpo text-ink-2">{p.saldo.toLocaleString("pt-BR")}</td>
                      <td className="numero hidden px-3 py-1.5 text-right text-pequeno text-ink-3 md:table-cell" title={p.sugestao?.origem}>{p.sugestao ? p.sugestao.quantidade.toLocaleString("pt-BR") : "—"}</td>
                      <td className="px-3 py-1 pr-cartao text-right">
                        <Input
                          aria-label={`Quantidade contada de ${p.nome}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className={`numero ml-auto w-24 text-right ${mudou ? "border-warning-border bg-warning-bg" : ""}`}
                          value={v}
                          onChange={(e) => setContado((c) => ({ ...c, [p.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtradas.length > POR_VEZ && <p className="m-0 border-t border-line-soft px-cartao py-2 text-pequeno text-ink-3">Mostrando {POR_VEZ} de {filtradas.length}. Busque a peça para achar as outras.</p>}
          </div>
        )}
      </Section>

      <Section
        titulo="Peças de locador"
        sub="O dono fica no saldo: o mesmo item pode ter saldo da Norte e de um locador."
        acoes={
          <Button variant="secondary" size="sm" disabled={locadores.length === 0} motivoDesabilitado="Cadastre um locador em Cadastros logísticos." onClick={() => setDeLocador((l) => [...l, { chave: ++proximaChave.current, pecaId: "", locadorId: "", contado: "" }])}>
            <Icone nome="mais" />
            Incluir linha
          </Button>
        }
      >
        {deLocador.length === 0 && saldosDeLocador.length === 0 ? (
          <p className="m-0 px-cartao py-3 text-pequeno text-ink-3">Nenhum saldo de locador neste almoxarifado.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {saldosDeLocador.map((s) => (
              <li key={`${s.pecaId}|${s.locadorId}`} className="flex flex-wrap justify-between gap-2 border-t border-line-row px-cartao py-2 text-pequeno first:border-t-0">
                <span>{pecas.find((p) => p.id === s.pecaId)?.nome ?? "Peça"}</span>
                <span className="text-ink-2">{locadores.find((l) => l.id === s.locadorId)?.nome ?? "Locador"} · saldo <span className="numero font-medium">{s.quantidade}</span></span>
              </li>
            ))}
            {deLocador.map((l) => (
              <li key={l.chave} className="grid gap-2 border-t border-line-row px-cartao py-2 first:border-t-0 md:grid-cols-[minmax(0,1fr)_200px_110px_40px] md:items-center">
                <ComboBox value={l.pecaId || null} onChange={(v) => setDeLocador((x) => x.map((o) => (o.chave === l.chave ? { ...o, pecaId: v } : o)))} opcoes={opcoesPecas} placeholder="Buscar peça" />
                <Select value={l.locadorId} onValueChange={(v) => setDeLocador((x) => x.map((o) => (o.chave === l.chave ? { ...o, locadorId: v } : o)))} opcoes={locadores.map((o) => ({ value: o.id, label: o.nome }))} placeholder="Locador" />
                <Input aria-label="Quantidade contada do locador" type="number" min={0} className="numero text-right" value={l.contado} onChange={(e) => setDeLocador((x) => x.map((o) => (o.chave === l.chave ? { ...o, contado: e.target.value } : o)))} />
                <IconButton label="Tirar esta linha" onClick={() => setDeLocador((x) => x.filter((o) => o.chave !== l.chave))} className="hover:text-danger">
                  <Icone nome="lixeira" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-cartao border border-line bg-surface px-cartao py-3 shadow-popover">
        <span className="numero text-corpo text-ink-2">
          {preenchidas} {preenchidas === 1 ? "linha contada" : "linhas contadas"}
          {diferencas > 0 && <Badge tom="warning" className="ml-2">{diferencas} {diferencas === 1 ? "diferença" : "diferenças"}</Badge>}
        </span>
        <FormError message={erro} />
        <Button variant="primary" size="lg" className="ml-auto" loading={pendente} disabled={preenchidas === 0} motivoDesabilitado="Preencha ao menos uma quantidade." onClick={registrar}>
          {jaContado ? "Registrar contagem" : "Registrar saldo inicial"}
        </Button>
      </div>

      {historico.length > 0 && (
        <Section titulo="Últimas contagens">
          <ul className="m-0 list-none p-0">
            {historico.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 border-t border-line-row px-cartao py-2 text-pequeno first:border-t-0">
                <span className="text-ink">
                  <span className="numero font-medium">{diaMesISO(h.dataContagem)}</span> · {h.responsavel} · {h.linhas} {h.linhas === 1 ? "linha" : "linhas"}
                </span>
                {h.observacao && <span className="text-ink-3">{h.observacao}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
