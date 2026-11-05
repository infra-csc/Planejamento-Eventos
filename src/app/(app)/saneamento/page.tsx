import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { dadosDoSaneamento } from "@/server/services/saneamento";
import { INCONSISTENCIA_LABEL } from "@/domain/logistica";
import { diaMesISO } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Metric, MetricStrip, PageHeader, Section } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";
import { ImportarPecasPlanilha, VincularAtivacao } from "@/components/logistica/saneamento-telas";

export const metadata: Metadata = { title: "Saneamento" };

const ABAS = [
  ["datas", "Datas dos eventos"],
  ["pecas", "Tipo e m³ das peças"],
  ["ativacao", "Itens da Ativação"],
] as const;

export default async function SaneamentoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const usuario = await requirePermissao("logistica.cadastros");
  const { aba: pedida } = await searchParams;
  const aba = ABAS.find(([k]) => k === pedida)?.[0] ?? "datas";
  const d = await dadosDoSaneamento(usuario);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Saneamento" description="O que precisa de acerto para a Projeção não calcular sobre número errado. Aqui só aponta: quem corrige é você." />
      <MetricStrip>
        <Metric label="Eventos para corrigir" valor={d.eventos.length} tom={d.eventos.length ? "warning" : "success"} hint={`de ${d.totalEventos} ativos`} href="/saneamento?aba=datas" />
        <Metric label="Peças sem tipo" valor={d.semTipo.length} tom={d.semTipo.length ? "warning" : "success"} hint={`de ${d.totalPecas} ativas`} href="/saneamento?aba=pecas" />
        <Metric label="Peças sem m³" valor={d.semVolume.length} tom={d.semVolume.length ? "warning" : "success"} hint="a estimativa de veículos avisa" href="/saneamento?aba=pecas" />
        <Metric label="Itens da Ativação sem peça" valor={d.itensSemVinculo.length} tom={d.itensSemVinculo.length ? "warning" : "success"} href="/saneamento?aba=ativacao" />
      </MetricStrip>
      <TabsNav rotulo="Saneamento" tabs={ABAS.map(([k, label]) => ({ href: `/saneamento?aba=${k}`, label, exact: true, ativo: k === aba }))} />

      {aba === "datas" && (
        <Section titulo="Eventos com data inconsistente">
          {d.eventos.length === 0 ? (
            <EmptyState compact icone="check-circulo" title="Nenhum evento com data inconsistente" />
          ) : (
            <ul className="m-0 list-none p-0">
              {d.eventos.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line-row px-cartao py-2.5 first:border-t-0">
                  <span className="min-w-0">
                    <Link href={`/eventos/${e.id}/editar`} className="link text-corpo font-medium">
                      <span className="font-mono">{e.codigo}</span> · {e.nome}
                    </Link>
                    <span className="numero block text-pequeno text-ink-3">evento {diaMesISO(e.dataInicio)} · reunião {diaMesISO(e.diaReuniao)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {e.problemas.map((p) => (
                      <Badge key={p} tom="warning">{INCONSISTENCIA_LABEL[p]}</Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {aba === "pecas" && (
        <>
          <ImportarPecasPlanilha />
          <div className="grid gap-4 lg:grid-cols-2">
            <ListaPecas titulo="Sem tipo" sub="Retornável ou consumível: sem isso, a Projeção conta como retornável." lista={d.semTipo} />
            <ListaPecas titulo="Sem m³" sub="Sem volume, a estimativa de veículos sai marcada como incompleta." lista={d.semVolume} />
          </div>
        </>
      )}

      {aba === "ativacao" && <VincularAtivacao itens={d.itensSemVinculo} pecas={d.pecasParaVincular} />}
    </div>
  );
}

function ListaPecas({ titulo, sub, lista }: { titulo: string; sub: string; lista: Array<{ id: string; codigo: string; nome: string }> }) {
  return (
    <Section titulo={`${titulo} · ${lista.length}`} sub={sub}>
      {lista.length === 0 ? (
        <EmptyState compact icone="check-circulo" title="Nada pendente" />
      ) : (
        <ul className="m-0 max-h-[420px] list-none overflow-y-auto p-0">
          {lista.map((p) => (
            <li key={p.id} className="border-t border-line-row first:border-t-0">
              <Link href={`/catalogo/${p.id}`} className="flex min-h-10 items-center justify-between gap-3 px-cartao py-1.5 text-pequeno text-ink no-underline hover:bg-subtle">
                <span className="min-w-0 truncate">{p.nome}</span>
                <span className="shrink-0 font-mono text-ink-3">{p.codigo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
