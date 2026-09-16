import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { consolidarPeriodo } from "@/server/services/consolidacao";
import { listarPendenciasCompra } from "@/server/services/solicitacoes";
import { addDiasISO, diaMesISO, hojeISO } from "@/lib/format";
import { Metric, MetricStrip, PageHeader, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";

export const metadata: Metadata = { title: "Consolidação" };

const JANELAS = [15, 30, 60] as const;

export default async function ConsolidacaoPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const usuario = await requirePermissao("consolidacao.ver");
  const sp = await searchParams;
  const dias = JANELAS.find((d) => String(d) === sp.dias) ?? 30;
  const inicio = hojeISO();
  const fim = addDiasISO(inicio, dias);
  const [{ eventos, pecas }, pendenciasTodas] = await Promise.all([consolidarPeriodo(usuario, { inicio, fim }), listarPendenciasCompra(usuario)]);

  const demandadas = pecas.filter((p) => p.pico > 0).sort((a, b) => a.saldo - b.saldo || b.pico - a.pico);
  // Estoque 0 = não informado: não conta como déficit.
  const deficit = demandadas.filter((p) => p.estoque > 0 && p.saldo < 0);
  const aLocar = deficit.reduce((a, p) => a - p.saldo, 0);
  const pendencias = pendenciasTodas.filter((p) => p.solicitacao.evento.status !== "CANCELADO" && p.solicitacao.evento.status !== "ENCERRADO" && p.faltante > 0);

  return (
    <>
      <PageHeader
        title="Consolidação"
        description="Demanda de todos os eventos que ocupam o período, de montagem a desmontagem, contra o estoque próprio. Eventos simultâneos disputam a mesma peça: o pico mostra o pior dia."
      />

      <div className="mb-[18px] flex items-center gap-3">
        <Pills rotulo="Janela de tempo" itens={JANELAS.map((d) => ({ label: `${d} dias`, href: d === 30 ? "/consolidacao" : `/consolidacao?dias=${d}`, ativo: d === dias }))} />
        <span className="font-mono text-[12.5px] text-muted">
          {diaMesISO(inicio)} – {diaMesISO(fim)}
        </span>
      </div>

      <MetricStrip>
        <Metric label="Eventos no período" valor={eventos.length} hint={eventos.length ? eventos.map((e) => e.codigo).join(" · ") : "nenhum evento"} />
        <Metric label="Peças demandadas" valor={demandadas.length} hint="tipos com demanda no pico" />
        <Metric label="Peças em déficit" valor={deficit.length} cor={deficit.length ? "#a8400f" : "#136c41"} hint={deficit.length ? "pico acima do estoque" : "o estoque cobre tudo"} />
        <Metric label="Unidades a locar" valor={aLocar} cor={aLocar ? "#7a5f00" : undefined} hint="soma do que falta no pico" />
      </MetricStrip>

      <div className="flex flex-col gap-5">
        <Section titulo="Demanda × estoque" sub="Ordenado por risco: menor saldo primeiro. O traço escuro marca o estoque próprio.">
          {demandadas.length === 0 ? (
            <p className="m-0 px-[18px] py-10 text-center text-[13px] text-muted">Nenhuma demanda de peças no período. Eventos entram aqui quando têm ata ou solicitações com itens.</p>
          ) : (
            demandadas.map((p) => {
              const escala = Math.max(p.pico, p.estoque, 1);
              const falta = p.saldo < 0;
              return (
                <div key={p.pecaId} className="flex items-center gap-4 border-b border-line-row px-[18px] py-3 last:border-b-0">
                  <span className="w-[210px] shrink-0">
                    <span className="block font-mono text-[12.5px] font-medium">{p.codigo}</span>
                    <span className="block truncate text-[12px] text-muted">{p.nome}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="relative block h-2 rounded-[4px] bg-[#f0eceb]" role="img" aria-label={`Demanda ${p.pico}, estoque ${p.estoque}`}>
                      <span className="absolute left-0 top-0 block h-2 rounded-[4px]" style={{ width: `${(p.pico / escala) * 100}%`, background: falta ? "#a8400f" : "#136c41" }} />
                      <span aria-hidden className="absolute -top-1 block h-4 w-0.5 bg-dark" style={{ left: `calc(${(p.estoque / escala) * 100}% - 1px)` }} />
                    </span>
                    <span className="mt-1.5 block text-[11.5px] text-ink-3">
                      demanda <span className="font-mono">{p.pico}</span> · {p.estoque > 0 ? <>estoque <span className="font-mono">{p.estoque}</span></> : "estoque não informado"}
                      {p.eventosNoPico.length > 0 && <span className="text-meta"> · {p.eventosNoPico.map((e) => `${e.codigo} ${e.quantidade}${e.projetado ? " (projetado)" : ""}`).join(" · ")}</span>}
                    </span>
                  </span>
                  <span className="w-[108px] shrink-0 text-right">
                    <span className={p.estoque === 0 ? "inline-block rounded-[5px] bg-neutral-bg px-2 py-0.5 font-mono text-[12px] text-muted" : falta ? "inline-block rounded-[5px] bg-danger-bg px-2 py-0.5 font-mono text-[12px] font-medium text-danger" : "inline-block rounded-[5px] bg-success-bg px-2 py-0.5 font-mono text-[12px] font-medium text-success"}>
                      {p.estoque === 0 ? "sem estoque" : falta ? `faltam ${-p.saldo}` : `sobram ${p.saldo}`}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] text-meta">{p.diaPico ? `pico ${diaMesISO(p.diaPico)}` : ""}</span>
                  </span>
                </div>
              );
            })
          )}
        </Section>

        <section id="pendencias">
          <Section titulo="Pendências de compra e locação" sub="Respostas parciais ou recusadas que a logística marcou como pendência.">
            {pendencias.length === 0 ? (
              <p className="m-0 px-[18px] py-10 text-center text-[13px] text-muted">Nenhuma pendência aberta. Toda resposta parcial ou recusada aparece aqui até ser resolvida.</p>
            ) : (
              pendencias.map((p) => (
                <div key={p.id} className="flex items-start gap-4 border-b border-line-row px-[18px] py-3 last:border-b-0">
                  <Link href={`/solicitacoes/${p.solicitacaoId}`} className="w-[78px] shrink-0 pt-px font-mono text-[12.5px] font-medium text-ink no-underline hover:underline">
                    {p.solicitacao.codigo}
                  </Link>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-ink">{p.descricao}</span>
                    {p.observacaoLogistica && <span className="block text-[12.5px] text-ink-2">{p.observacaoLogistica}</span>}
                    <span className="block text-[12px] text-muted">
                      {p.solicitacao.evento.codigo} {p.solicitacao.evento.nome} · {p.solicitacao.area.nome} · montagem {diaMesISO(p.solicitacao.evento.dataMontagem)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-[5px] bg-warning-bg px-2 py-0.5 font-mono text-[12px] font-medium text-warning">faltam {p.faltante}</span>
                </div>
              ))
            )}
          </Section>
        </section>
      </div>
    </>
  );
}
