import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, progressoAreas } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo } from "@/server/services/os";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { pode } from "@/domain/permissions";
import { totalPecas } from "@/domain/os";
import { classificarHistorico, COR_HISTORICO } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { BarraProgresso, ListaDados, Section } from "@/components/ui/layout";

export default async function EventoVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, areas, historico, versoes, os] = await Promise.all([
    obterEventoCache(usuario, id),
    progressoAreas(id),
    obterHistoricoEvento(usuario, id, 6),
    listarOsResumo(id),
    calcularOsAtual(await getDb(), id),
  ]);
  const total = totalPecas(os);
  const osResumo = versoes.length === 0 ? "gerada ao fechar a ata" : `${versoes.length} ${versoes.length === 1 ? "versão · gerada em" : "versões · última em"} ${diaMes(versoes[0].geradaEm)}`;

  return (
    <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-start gap-5">
      <div className="flex flex-col gap-5">
        <Section titulo="Onde está cada área" sub="O que cada área enviou e o que já foi respondido neste evento.">
          {areas.map((a) => {
            const pct = a.itens ? Math.round((a.respondidos / a.itens) * 100) : 0;
            return (
              <div key={a.id} className="flex items-center gap-3.5 border-b border-line-row px-[18px] py-3 last:border-b-0">
                <span className="shrink-0 basis-[108px] text-[13.5px] text-ink">{a.nome}</span>
                <span className="min-w-0 flex-1" role="img" aria-label={a.itens ? `${pct}% respondido` : "sem envio"}>
                  <BarraProgresso pct={a.itens ? Math.max(4, pct) : 0} cor={pct === 100 ? "var(--color-success)" : "var(--color-accent)"} />
                </span>
                <span className="shrink-0 basis-[200px] text-right text-[12.5px] text-ink-3">
                  {a.itens === 0 ? "não enviou nada" : `${a.respondidos}/${a.itens} itens respondidos · ${a.solicitacoes} ${a.solicitacoes === 1 ? "solicitação" : "solicitações"}`}
                </span>
              </div>
            );
          })}
        </Section>

        <Section
          titulo="Atividade"
          acoes={
            <Link href={`/eventos/${id}/historico`} className="link text-[12.5px]">
              Ver histórico completo
            </Link>
          }
        >
          <div className="px-[18px] py-3.5">
            {historico.length === 0 && <p className="m-0 text-[12.5px] text-muted">Sem registros.</p>}
            {historico.map((h) => {
              const c = classificarHistorico(h);
              return (
                <div key={h.id} className="flex gap-[13px] py-[7px]">
                  <span aria-hidden className={cn("mt-1.5 block size-[7px] shrink-0", c.tipo === "marco" ? "rounded-[2px]" : "rounded-full")} style={{ background: COR_HISTORICO[c.tipo] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink">{c.titulo}</span>
                    <span className="block text-[12px] text-muted">{c.detalhe || h.usuario?.nome || "Sistema"}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] text-meta">{diaMesHora(h.criadoEm)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-5">
        <Section titulo="Datas">
          <ListaDados
            itens={[
              { label: "Montagem", valor: diaMesISO(ev.dataMontagem) },
              { label: "Evento", valor: periodoCurto(ev.dataInicio, ev.dataFim), forte: true },
              { label: "Desmontagem", valor: diaMesISO(ev.dataDesmontagem) },
              { label: "Reunião de OS", valor: diaMesHora(ev.dataReuniao) },
              { label: "Carga do caminhão", valor: ev.dataCarga ? diaMesISO(ev.dataCarga) : "não definida", forte: Boolean(ev.dataCarga) },
              { label: "Ata fechada", valor: ev.ataFechadaEm ? diaMesHora(ev.ataFechadaEm) : "ainda não" },
            ]}
          />
        </Section>

        <Section titulo="OS" sub={osResumo}>
          <div className="px-[18px] py-3.5">
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="font-mono text-[26px] font-medium tracking-[-0.02em]">{versoes.length ? total : "—"}</span>
              <span className="text-[12.5px] text-muted">peças no total</span>
            </div>
            {pode(usuario, "os.ver") ? (
              <ButtonLink href={`/eventos/${id}/os`} variant="secondary" size="md" className="w-full no-underline">
                Abrir OS
              </ButtonLink>
            ) : (
              <p className="m-0 text-[12px] text-muted">A OS é consultada pela logística e pela cenografia.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
