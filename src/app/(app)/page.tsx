import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { dadosPainel, type ItemAgenda, type ItemFila } from "@/server/services/dashboard";
import { pode } from "@/domain/permissions";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { dataExtenso } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Marcador, Metric, MetricStrip, PageHeader, Section } from "@/components/ui/layout";
import { Badge, ForaJanelaTag, TipoSolicitacaoTag } from "@/components/ui/badge";
import { AtenderRapido } from "@/components/painel/atender-rapido";
import { EventosSolicitante } from "@/components/painel/eventos-solicitante";

export const metadata: Metadata = { title: "Painel" };

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

function LinhaFila({ f, rapida }: { f: ItemFila; rapida: boolean }) {
  const pi = prazoInfo(f);
  const cor = COR_TOM[pi.tom];
  const href = `/solicitacoes/${f.id}`;
  const contexto = [f.areaNome, f.eventoNome, plural(f.total, "item", "itens"), f.respondidos > 0 ? `${f.respondidos} já respondido${f.respondidos === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start gap-[13px] border-b border-line-row px-cartao py-[13px] last:border-b-0">
      <Marcador cor={cor} pulsar={pi.vencido} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link href={href} className="inline-flex flex-wrap items-baseline gap-2 text-ink no-underline hover:underline">
            <span className="font-mono text-pequeno font-medium">{f.codigo}</span>
            <span className="text-corpo">{f.titulo || "sem título"}</span>
          </Link>
          <TipoSolicitacaoTag tipo={f.tipo} />
          {f.foraDaJanela && <ForaJanelaTag />}
        </div>
        <p className="mt-[3px] text-pequeno text-muted">{contexto}</p>
        {rapida && f.pendenteUnico && (
          <AtenderRapido
            itemId={f.pendenteUnico.id}
            codigo={f.codigo}
            href={href}
            sufixo={f.tipo === "ALTERACAO" ? "nova versão da OS" : "item entrou na ata"}
            rotulo={`${f.pendenteUnico.descricao} × ${f.pendenteUnico.quantidade}${f.pendenteUnico.destino ? ` · ${f.pendenteUnico.destino}` : ""}`}
          />
        )}
      </div>
      <div className="shrink-0 pl-1.5 text-right">
        <span className="block font-mono text-pequeno font-medium" style={{ color: cor }}>
          {pi.vencido ? "atrasada" : pi.label}
        </span>
        <span className="block text-rotulo text-meta">{pi.sub && !pi.vencido && (f.status === "ENVIADA" || f.status === "EM_ANALISE") ? `resposta até ${pi.sub}` : pi.sub}</span>
      </div>
    </div>
  );
}

function Agenda({ itens }: { itens: ItemAgenda[] }) {
  const cor = { reuniao: "var(--color-dark)", carga: "var(--color-warning)", montagem: "var(--color-muted)" };
  return (
    <Section titulo="Próximos 14 dias" sub="Reuniões, cargas e montagens de todos os eventos.">
      <div className="px-cartao pb-3.5 pt-1.5">
        {itens.length === 0 && <p className="m-0 py-3 text-pequeno text-muted">Nada marcado nas próximas duas semanas</p>}
        {itens.map((a) => (
          <Link key={a.chave} href={a.href} className="flex w-full gap-3 border-b border-line-faint py-[9px] text-left no-underline last:border-b-0 hover:bg-subtle">
            <span className="shrink-0 basis-[46px] pt-px font-mono text-pequeno text-muted">{a.dia}</span>
            <Marcador cor={cor[a.tipo]} quadrado={a.tipo === "reuniao"} />
            <span className="min-w-0 flex-1">
              <span className="block text-corpo font-medium text-ink">{a.titulo}</span>
              <span className="block text-pequeno text-muted">{a.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

export default async function PainelPage() {
  const usuario = await requireUsuario();
  const d = await dadosPainel(usuario);
  const primeiroNome = usuario.nome.split(" ")[0];
  const agora = new Date();
  // Logística e Administrador respondem: fila com atendimento rápido e modo fila.
  const responde = pode(usuario, "solicitacao.responder");

  let subtitulo: string;
  let acao: { label: string; href: string } | null;
  if (d.tipo === "operacao") {
    const reunioes = d.reunioesHoje.length === 0 ? "nenhuma reunião de OS" : d.reunioesHoje.length === 1 ? `uma reunião de OS às ${d.reunioesHoje[0]}` : `${d.reunioesHoje.length} reuniões de OS`;
    subtitulo =
      usuario.perfil === "GESTAO"
        ? "Visão entre eventos: prazos, exceções e o que está travando a operação."
        : usuario.perfil === "ADMIN"
          ? `Visão completa: ${reunioes}, ${plural(d.metricas.aguardando, "solicitação aguardando", "solicitações aguardando")} resposta, ${plural(d.sistema?.usuariosAtivos ?? 0, "pessoa ativa", "pessoas ativas")} e ${plural(d.sistema?.areasAtivas ?? 0, "área", "áreas")}.`
          : `Sua fila de hoje: ${reunioes}, ${plural(d.metricas.aguardando, "solicitação aguardando", "solicitações aguardando")} resposta e ${plural(d.metricas.atrasadas, "atrasada", "atrasadas")}.`;
    acao =
      usuario.perfil === "GESTAO"
        ? { label: "Ver atrasos", href: "/solicitacoes?filtro=ATRASADAS" }
        : usuario.perfil === "ADMIN"
          ? { label: "Administração", href: "/admin" }
          : d.reuniaoHoje
            ? { label: "Abrir conferência da ata de hoje", href: `/conferencia/${d.reuniaoHoje.id}` }
            : { label: "Novo evento", href: "/eventos/novo" };
  } else {
    subtitulo = `Área ${usuario.areaNome ?? ""}: o que você enviou, o que voltou para ajuste e onde ainda dá para pedir alteração.`;
    acao = { label: "Nova solicitação", href: "/solicitacoes/nova" };
  }

  return (
    <>
      <PageHeader
        eyebrow={<span className="font-mono">{dataExtenso(agora)}</span>}
        title={`Olá, ${primeiroNome}`}
        description={subtitulo}
        actions={
          acao && (
            <ButtonLink href={acao.href} variant="primary" size="lg" className="no-underline">
              {acao.label}
            </ButtonLink>
          )
        }
      />

      {d.tipo === "operacao" && d.sistema && (
        <MetricStrip>
          <Metric label="Pessoas ativas" valor={d.sistema.usuariosAtivos} hint="usuários que conseguem entrar" href="/admin" />
          <Metric label="Áreas ativas" valor={d.sistema.areasAtivas} hint="áreas que pedem itens" href="/admin?aba=areas" />
          <Metric label="Eventos ativos" valor={d.sistema.eventosAtivos} hint="em preparação, reunião ou abertos" href="/eventos" />
          <Metric label="Fora do catálogo" valor={d.sistema.foraCatalogo} tom={d.sistema.foraCatalogo > 0 ? "warning" : "success"} hint={d.sistema.foraCatalogo > 0 ? "itens para cadastrar ou vincular" : "tudo vinculado"} href="/biblioteca?aba=fora" />
        </MetricStrip>
      )}
      {d.tipo === "operacao" && (
        <MetricStrip>
          <Metric
            label={responde ? "Aguardando sua resposta" : "Aguardando resposta"}
            valor={d.metricas.aguardando}
            hint={d.metricas.atrasadas > 0 ? plural(d.metricas.atrasadas, "atrasada", "atrasadas") : "nenhuma atrasada"}
            href="/solicitacoes?filtro=ABERTAS"
          />
          <Metric
            label="Atrasadas"
            valor={d.metricas.atrasadas}
            tom={d.metricas.atrasadas > 0 ? "danger" : "success"}
            hint={d.metricas.piorAtraso ? `${d.metricas.piorAtraso.codigo} ${prazoInfo(d.metricas.piorAtraso).sub}` : "nenhuma atrasada"}
            href="/solicitacoes?filtro=ATRASADAS"
          />
          <Metric label="Reuniões esta semana" valor={d.metricas.reunioesSemana} hint={d.metricas.hintSemana} href="/eventos" />
          <Metric label="Eventos em preparação" valor={d.metricas.emPreparacao} hint={d.metricas.hintPreparacao} href="/eventos" />
        </MetricStrip>
      )}
      {d.tipo === "requisitante" && (
        <MetricStrip>
          <Metric label="Aguardando resposta" valor={d.metricas.aguardando} hint="da sua área" href="/solicitacoes?filtro=ABERTAS" />
          <Metric label="Rascunhos e devolvidas" valor={d.metricas.rascunhos} tom={d.metricas.temDevolvida ? "danger" : "neutro"} hint="precisam de você" href="/solicitacoes?filtro=RASCUNHO" />
          <Metric
            label="Respondidas em 7 dias"
            valor={d.metricas.respondidas7}
            hint={d.metricas.respondidas7 === 0 ? "nenhuma na semana" : d.metricas.comRessalva7 > 0 ? plural(d.metricas.comRessalva7, "com ressalva", "com ressalva") : "tudo atendido"}
            href="/solicitacoes?filtro=RESPONDIDA"
          />
          <Metric label="Eventos aceitando envio" valor={d.metricas.aceitando} hint={`${d.metricas.nPrep} em preparação · ${plural(d.metricas.nAberto, "aberto", "abertos")}`} href="/eventos" />
        </MetricStrip>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {d.tipo === "operacao" && (
            <Section
              titulo="Fila de resposta"
              sub="Ordenada por prazo. Solicitações de um item só podem ser atendidas direto daqui."
              acoes={
                responde && d.fila.length > 0 ? (
                  <ButtonLink href={`/solicitacoes/${d.fila[0].id}?fila=1`} variant="primary" size="sm" className="no-underline">
                    Responder em sequência
                  </ButtonLink>
                ) : undefined
              }
            >
              {d.fila.length === 0 ? (
                <EmptyState compact title="Fila zerada" description="Nenhuma solicitação aguardando resposta." />
              ) : (
                d.fila.map((f) => <LinhaFila key={f.id} f={f} rapida={responde} />)
              )}
            </Section>
          )}

          {d.tipo === "requisitante" && (
            <>
              <EventosSolicitante eventos={d.eventos} mudancas={d.mudancas} />
              <Section
                titulo="Precisa de você"
                sub="Rascunhos, devoluções e o que ainda aguarda resposta da logística."
                acoes={
                  <ButtonLink href="/solicitacoes/nova" variant="primary" size="sm" className="no-underline">
                    Nova solicitação
                  </ButtonLink>
                }
              >
                {d.fila.length === 0 ? (
                  <EmptyState compact title="Nada pendente da sua área" description="Quando um evento abrir para envio, ele aparece aqui." />
                ) : (
                  d.fila.map((f) => <LinhaFila key={f.id} f={f} rapida={false} />)
                )}
              </Section>
              <Section titulo="Respostas recebidas" sub="Cada item tem resposta própria. Parcial e não atendido vêm sempre com motivo.">
                {d.respostas.length === 0 && <EmptyState compact title="Nenhuma resposta ainda" />}
                {d.respostas.map((r) => (
                  <Link key={r.id} href={`/solicitacoes/${r.id}`} className="block border-b border-line-row px-cartao py-[13px] text-left no-underline last:border-b-0 hover:bg-subtle">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-pequeno font-medium text-ink">{r.codigo}</span>
                      <span className="min-w-0 flex-1 text-corpo text-ink">{r.titulo || "sem título"}</span>
                      <Badge tom={r.naAta ? "accent" : r.ressalvas > 0 ? "warning" : "success"}>{r.naAta ? "Na ata" : r.ressalvas > 0 ? `${r.ressalvas} com ressalva` : "Tudo atendido"}</Badge>
                    </div>
                    <p className="mt-1 text-pequeno text-muted">
                      {r.eventoNome} · {r.naAta ? "registrada na ata, confere na reunião" : `respondida por ${r.respondidoPor}`}
                    </p>
                  </Link>
                ))}
              </Section>
            </>
          )}

        </div>

        <div className="flex flex-col gap-5">
          <Agenda itens={d.agenda} />

          {d.tipo === "requisitante" && (
            <Section tom="dark" titulo="Como o processo funciona" padded>
              {[
                "Evento em preparação: envie as necessidades da área antes da reunião de OS.",
                "Ata fechada: mudanças passam a entrar como solicitação de alteração.",
                "Cada item recebe resposta separada — atendido, parcial ou não atendido, sempre com motivo.",
                "Encerrado: nada mais entra. Só a Gestão reabre, em exceção.",
              ].map((texto, i) => (
                <div key={i} className="flex gap-[11px] py-[7px]">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-chip bg-dark-2 font-mono text-rotulo text-accent-light">{i + 1}</span>
                  <span className="flex-1 text-pequeno leading-[1.5] text-on-dark-3">{texto}</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
