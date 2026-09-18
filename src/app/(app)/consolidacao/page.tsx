import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { consolidarPeriodo } from "@/server/services/consolidacao";
import { listarPendenciasCompra } from "@/server/services/solicitacoes";
import { addDiasISO, diaMesISO, hojeISO } from "@/lib/format";
import { BarraProgresso, EmptyState, Metric, MetricStrip, PageHeader, Section } from "@/components/ui/layout";
import { ChipMono } from "@/components/ui/badge";
import { Pills } from "@/components/ui/pills";

export const metadata: Metadata = { title: "Demanda de peças" };

const JANELAS = [15, 30, 60] as const;

export default async function ConsolidacaoPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const usuario = await requirePermissao("consolidacao.ver");
  const sp = await searchParams;
  const dias = JANELAS.find((d) => String(d) === sp.dias) ?? 30;
  const inicio = hojeISO();
  const fim = addDiasISO(inicio, dias);
  const [{ eventos, pecas }, pendenciasTodas] = await Promise.all([consolidarPeriodo(usuario, { inicio, fim }), listarPendenciasCompra(usuario)]);

  // Só demanda: o estoque fica fora desta tela por enquanto.
  const demandadas = pecas.filter((p) => p.pico > 0).sort((a, b) => b.pico - a.pico || a.codigo.localeCompare(b.codigo));
  const unidadesPico = demandadas.reduce((a, p) => a + p.pico, 0);
  const simultaneas = demandadas.filter((p) => p.eventosNoPico.length > 1).length;
  const pendencias = pendenciasTodas.filter((p) => p.solicitacao.evento.status !== "CANCELADO" && p.solicitacao.evento.status !== "ENCERRADO" && p.faltante > 0);

  return (
    <>
      <PageHeader
        title="Demanda de peças"
        description="Peças que todos os eventos do período vão precisar, da montagem ao fim do evento. Eventos simultâneos disputam a mesma peça: o pico mostra o pior dia."
      />

      <div className="mb-[18px] flex items-center gap-3">
        <Pills rotulo="Janela de tempo" itens={JANELAS.map((d) => ({ label: `${d} dias`, href: d === 30 ? "/consolidacao" : `/consolidacao?dias=${d}`, ativo: d === dias }))} />
        <span className="font-mono text-pequeno text-muted">
          {diaMesISO(inicio)} – {diaMesISO(fim)}
        </span>
      </div>

      <MetricStrip>
        <Metric label="Eventos no período" valor={eventos.length} hint={eventos.length ? eventos.map((e) => e.codigo).join(" · ") : "nenhum evento"} />
        <Metric label="Peças demandadas" valor={demandadas.length} hint="tipos com demanda no pico" />
        <Metric label="Unidades no pico" valor={unidadesPico} hint="soma dos picos de cada peça" />
        <Metric label="Disputadas" valor={simultaneas} hint={simultaneas ? "pedidas por mais de um evento no mesmo dia" : "nenhuma peça disputada"} />
      </MetricStrip>

      <div className="flex flex-col gap-5">
        <Section titulo="Demanda por peça" sub="Maior pico primeiro. Ao lado, os eventos que compõem o pico.">
          {demandadas.length === 0 ? (
            <EmptyState compact title="Nenhuma demanda de peças no período." description="Eventos entram aqui quando têm ata ou solicitações com itens." />
          ) : (
            demandadas.map((p) => {
              const escala = Math.max(demandadas[0]?.pico ?? 1, 1);
              const disputada = p.eventosNoPico.length > 1;
              return (
                <div key={p.pecaId} className="flex items-center gap-4 border-b border-line-row px-[18px] py-3 last:border-b-0">
                  <span className="w-[210px] shrink-0">
                    <span className="block font-mono text-pequeno font-medium">{p.codigo}</span>
                    <span className="block truncate text-pequeno text-muted">{p.nome}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span role="img" aria-label={`Demanda no pico: ${p.pico}`}>
                      <BarraProgresso pct={Math.max(2, (p.pico / escala) * 100)} tom={disputada ? "warning" : "neutro"} altura={8} />
                    </span>
                    <span className="mt-1.5 block text-rotulo text-ink-3">
                      pico <span className="font-mono">{p.pico}</span>
                      {p.eventosNoPico.length > 0 && <span className="text-meta"> · {p.eventosNoPico.map((e) => `${e.codigo} ${e.quantidade}${e.projetado ? " (projetado)" : ""}`).join(" · ")}</span>}
                    </span>
                  </span>
                  <span className="w-[108px] shrink-0 text-right">
                    <ChipMono tom={disputada ? "warning" : "neutral"} className="font-medium">
                      {disputada ? `${p.eventosNoPico.length} eventos` : `${p.pico} un.`}
                    </ChipMono>
                    <span className="mt-1 block font-mono text-rotulo text-meta">{p.diaPico ? `pico ${diaMesISO(p.diaPico)}` : ""}</span>
                  </span>
                </div>
              );
            })
          )}
        </Section>

        <section id="pendencias">
          <Section titulo="Pendências de compra e locação" sub="Respostas parciais ou recusadas que a logística marcou como pendência.">
            {pendencias.length === 0 ? (
              <EmptyState compact title="Nenhuma pendência aberta." description="Toda resposta parcial ou recusada aparece aqui até ser resolvida." />
            ) : (
              pendencias.map((p) => (
                <div key={p.id} className="flex items-start gap-4 border-b border-line-row px-[18px] py-3 last:border-b-0">
                  <Link href={`/solicitacoes/${p.solicitacaoId}`} className="w-[78px] shrink-0 pt-px font-mono text-pequeno font-medium text-ink no-underline hover:underline">
                    {p.solicitacao.codigo}
                  </Link>
                  <span className="min-w-0 flex-1">
                    <span className="block text-corpo text-ink">{p.descricao}</span>
                    {p.observacaoLogistica && <span className="block text-pequeno text-ink-2">{p.observacaoLogistica}</span>}
                    <span className="block text-pequeno text-muted">
                      {p.solicitacao.evento.codigo} {p.solicitacao.evento.nome} · {p.solicitacao.area.nome} · montagem {diaMesISO(p.solicitacao.evento.dataMontagem)}
                    </span>
                  </span>
                  <ChipMono tom="warning" className="shrink-0 font-medium">
                    faltam {p.faltante}
                  </ChipMono>
                </div>
              ))
            )}
          </Section>
        </section>
      </div>
    </>
  );
}
