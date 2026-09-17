import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, obterLinhasAta } from "@/server/services/eventos";
import { Tag } from "@/components/ui/badge";
import { listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { obterEventoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { totalPecas } from "@/domain/os";
import { classificarHistorico, COR_HISTORICO } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { ListaDados, Metric, MetricStrip, Section } from "@/components/ui/layout";

export default async function EventoVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, linhas, historico, versoes] = await Promise.all([obterEventoCache(usuario, id), obterLinhasAta(id), obterHistoricoEvento(usuario, id, 6), listarOsResumo(id)]);
  // Resumo do que vai para o evento, visível para todo mundo (inclusive quem só pediu uma parte).
  const projetos = linhas.filter((l) => l.tipo === "PROJETO");
  const pecasSoltas = linhas.filter((l) => l.tipo === "PECA");
  const foraCatalogo = linhas.filter((l) => l.tipo === "AVULSO");
  const posAta = linhas.filter((l) => l.posAta);
  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const minhaArea = usuario.areaId;
  const deOutraArea = (l: (typeof linhas)[number]) => Boolean(minhaArea) && l.registro.areaId !== minhaArea;
  // Ajustes que mudam o que vai no caminhão, depois de a ata existir (para quem pediu enxergar mudanças).
  const AJUSTES = new Set(["ATA_QUANTIDADE", "ATA_REMOCAO", "AJUSTE_INCLUSAO", "CONFERENCIA_AJUSTE", "PECA_PROJETO_AJUSTADA", "ITEM_VINCULADO", "ATUALIZACAO_VERSAO"]);
  const ajustes = historico.filter((h) => h.entidade === "evento_item" && AJUSTES.has(h.acao));
  // O total só aparece quando existe OS; a última versão já traz o conteúdo (evita recalcular a ata inteira).
  const ultimaOs = versoes[0] ? (await obterConteudosOs(id, [versoes[0].numero])).get(versoes[0].numero) : null;
  const total = ultimaOs ? totalPecas(ultimaOs) : 0;
  const osResumo = versoes.length === 0 ? "gerada ao fechar a ata" : `${versoes.length} ${versoes.length === 1 ? "versão · gerada em" : "versões · última em"} ${diaMes(versoes[0].geradaEm)}`;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-5">
        <Section
          titulo={ev.ataFechadaEm ? "O que vai para o evento" : "O que já está na ata"}
          sub={ev.ataFechadaEm ? "Ata da reunião mais o que entrou depois. Cada item abre com quem pediu, ajustes e histórico." : "As necessidades das áreas entram aqui automaticamente e são conferidas na reunião."}
          acoes={
            <Link href={ev.ataFechadaEm ? `/eventos/${id}/os?visao=composicao` : `/eventos/${id}/ata`} className="link text-[12.5px]">
              Ver todos os itens
            </Link>
          }
        >
          <MetricStrip className="mb-0 rounded-none border-0 border-b border-line-soft">
            <Metric label="Projetos padrão" valor={projetos.length} hint={`${projetos.reduce((a, l) => a + l.quantidade, 0)} unidades`} tamanho={22} />
            <Metric label="Peças soltas" valor={pecasSoltas.length} hint={`${pecasSoltas.reduce((a, l) => a + l.quantidade, 0)} unidades`} tamanho={22} />
            <Metric label="Fora do catálogo" valor={foraCatalogo.length} hint={foraCatalogo.length ? "aguardam vínculo" : "tudo no catálogo"} cor={foraCatalogo.length ? "#7a5f00" : undefined} tamanho={22} />
            {ev.ataFechadaEm ? (
              <Metric label="Depois da ata" valor={posAta.length} hint={posAta.length ? "alterações e ajustes" : "nada entrou depois"} cor={posAta.length ? "#8e2740" : undefined} tamanho={22} />
            ) : (
              <Metric label="Conferidas" valor={`${conferidas}/${linhas.length}`} hint="na reunião de OS" cor={linhas.length && conferidas === linhas.length ? "#136c41" : undefined} tamanho={22} />
            )}
          </MetricStrip>

          {ev.ataFechadaEm && posAta.length > 0 && (
            <div className="border-b border-line-soft">
              <p className="m-0 px-[18px] pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-accent">Entrou depois da ata</p>
              {posAta.slice(0, 8).map((l) => (
                <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="flex items-center gap-3 border-t border-line-row px-[18px] py-2 text-[13px] no-underline hover:bg-subtle">
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {l.nome}
                    {deOutraArea(l) && <Tag className="ml-2" tom="muted">{l.areaNome ?? "Logística"}</Tag>}
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-3">{l.origemLabel}</span>
                  <span className="shrink-0 font-mono text-[13px] font-medium text-ink">{l.quantidade}</span>
                </Link>
              ))}
              {posAta.length > 8 && (
                <Link href={`/eventos/${id}/os?visao=composicao`} className="link block px-[18px] py-2 text-[12.5px]">
                  Mais {posAta.length - 8} itens
                </Link>
              )}
            </div>
          )}

          <div>
            <p className="m-0 px-[18px] pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{ajustes.length ? "Ajustes recentes" : "Sem ajustes até agora"}</p>
            {ajustes.length === 0 && <p className="m-0 px-[18px] pb-3 text-[12.5px] text-muted">Mudanças de quantidade, peças de projeto, retiradas e vínculos aparecem aqui com quem fez.</p>}
            {ajustes.slice(0, 5).map((h) => (
              <Link key={h.id} href={`/eventos/${id}/itens/${h.entidadeId}`} className="flex gap-3 border-t border-line-row px-[18px] py-2 no-underline hover:bg-subtle">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2" title={h.descricao}>
                  {h.descricao}
                </span>
                <span className="shrink-0 text-[11.5px] text-muted">{h.usuario?.nome ?? "Sistema"}</span>
                <span className="shrink-0 font-mono text-[11.5px] text-meta">{diaMesHora(h.criadoEm)}</span>
              </Link>
            ))}
          </div>
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
              { label: "Evento", valor: periodoCurto(ev.dataInicio, ev.dataFim), forte: true },
              { label: "Reunião de OS", valor: diaMesHora(ev.dataReuniao) },
              { label: "Alterações até", valor: ev.janelaAlteracoesAte ? diaMesISO(ev.janelaAlteracoesAte) : "até encerrar", forte: Boolean(ev.janelaAlteracoesAte) },
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
              versoes.length ? (
                <ButtonLink href={`/eventos/${id}/os`} variant="secondary" size="md" className="w-full no-underline">
                  Abrir OS
                </ButtonLink>
              ) : (
                <p className="m-0 text-[12px] text-muted">Aparece aqui assim que a ata for fechada.</p>
              )
            ) : (
              <p className="m-0 text-[12px] text-muted">A OS é consultada pela logística e pela cenografia.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
