import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { dadosPainel, type ItemAgenda, type ItemFila } from "@/server/services/dashboard";
import { pode } from "@/domain/permissions";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { dataExtenso } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Metric, MetricStrip, Section } from "@/components/ui/layout";
import { TipoSolicitacaoTag } from "@/components/ui/badge";
import { AtenderRapido } from "@/components/painel/atender-rapido";

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

function LinhaFila({ f, rapida }: { f: ItemFila; rapida: boolean }) {
  const pi = prazoInfo(f);
  const cor = COR_TOM[pi.tom];
  const href = `/solicitacoes/${f.id}`;
  const contexto = [f.areaNome, f.eventoNome, plural(f.total, "item", "itens"), f.respondidos > 0 ? `${f.respondidos} já respondido${f.respondidos === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start gap-[13px] border-b border-line-row px-[18px] py-[13px] last:border-b-0">
      <span aria-hidden className={cn("mt-1.5 block size-[7px] shrink-0 rounded-full", pi.vencido && "animate-pulse-dot")} style={{ background: cor }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link href={href} className="font-mono text-[12.5px] font-medium text-ink no-underline hover:underline">
            {f.codigo}
          </Link>
          <Link href={href} className="text-[13.5px] text-ink no-underline hover:underline">
            {f.titulo || "sem título"}
          </Link>
          <TipoSolicitacaoTag tipo={f.tipo} />
        </div>
        <p className="mt-[3px] text-[12.5px] text-muted">{contexto}</p>
        {rapida && f.pendenteUnico && (
          <AtenderRapido
            itemId={f.pendenteUnico.id}
            codigo={f.codigo}
            href={href}
            sufixo={f.tipo === "ALTERACAO" ? "OS regerada" : "ata atualizada"}
            rotulo={`${f.pendenteUnico.descricao} × ${f.pendenteUnico.quantidade}${f.pendenteUnico.destino ? ` · ${f.pendenteUnico.destino}` : ""}`}
          />
        )}
      </div>
      <div className="shrink-0 pl-1.5 text-right">
        <span className="block font-mono text-[12.5px] font-medium" style={{ color: cor }}>
          {pi.label === "vencido" ? "vencido" : pi.label}
        </span>
        <span className="block text-[11.5px] text-meta">{pi.sub && !pi.vencido && (f.status === "ENVIADA" || f.status === "EM_ANALISE") ? `resposta até ${pi.sub}` : pi.sub}</span>
      </div>
    </div>
  );
}

function Agenda({ itens }: { itens: ItemAgenda[] }) {
  const cor = { reuniao: "#2a1418", carga: "#7a5f00", montagem: "#6b6263" };
  return (
    <Section titulo="Próximos 14 dias" sub="Reuniões, cargas e montagens de todos os eventos.">
      <div className="px-[18px] pb-3.5 pt-1.5">
        {itens.length === 0 && <p className="m-0 py-3 text-[12.5px] text-muted">Nada marcado nas próximas duas semanas.</p>}
        {itens.map((a) => (
          <Link key={a.chave} href={a.href} className="flex w-full gap-3 border-b border-line-faint py-[9px] text-left no-underline last:border-b-0 hover:bg-subtle">
            <span className="shrink-0 basis-[46px] pt-px font-mono text-[12px] text-muted">{a.dia}</span>
            <span aria-hidden className={cn("mt-1.5 block size-[7px] shrink-0", a.tipo === "reuniao" ? "rounded-[2px]" : "rounded-full")} style={{ background: cor[a.tipo] }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">{a.titulo}</span>
              <span className="block text-[12px] text-muted">{a.sub}</span>
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
        : `Sua fila de hoje: ${reunioes}, ${plural(d.metricas.aguardando, "solicitação aguardando", "solicitações aguardando")} resposta e ${plural(d.metricas.atrasadas, "prazo vencido", "prazos vencidos")}.`;
    acao =
      usuario.perfil === "GESTAO"
        ? { label: "Ver atrasos", href: "/solicitacoes?filtro=ATRASADAS" }
        : d.reuniaoHoje
          ? { label: "Consolidar ata de hoje", href: `/eventos/${d.reuniaoHoje.id}/reuniao` }
          : { label: "Novo evento", href: "/eventos/novo" };
  } else {
    subtitulo = `Área ${usuario.areaNome ?? ""}: o que você enviou, o que voltou para ajuste e onde ainda dá para pedir alteração.`;
    acao = { label: "Nova solicitação", href: "/solicitacoes/nova" };
  }

  return (
    <>
      <div className="mb-[22px] flex items-end justify-between gap-5">
        <div>
          <p className="mb-1 mt-0 font-mono text-[12.5px] text-muted">{dataExtenso(agora)}</p>
          <h1 className="m-0 text-[24px] font-semibold tracking-[-0.025em]">Olá, {primeiroNome}</h1>
          <p className="mt-1.5 max-w-[620px] text-[14.5px] text-ink-2">{subtitulo}</p>
        </div>
        {acao && (
          <ButtonLink href={acao.href} variant="primary" size="lg" className="no-underline">
            {acao.label}
          </ButtonLink>
        )}
      </div>

      {d.tipo === "operacao" && (
        <MetricStrip>
          <Metric
            label={responde ? "Aguardando sua resposta" : "Aguardando resposta"}
            valor={d.metricas.aguardando}
            hint={d.metricas.atrasadas > 0 ? `${d.metricas.atrasadas} com prazo vencido` : "nenhuma vencida"}
            href="/solicitacoes?filtro=ABERTAS"
          />
          <Metric
            label="Prazo vencido"
            valor={d.metricas.atrasadas}
            cor={d.metricas.atrasadas > 0 ? "#a8400f" : "#136c41"}
            hint={d.metricas.piorAtraso ? `${d.metricas.piorAtraso.codigo} ${prazoInfo(d.metricas.piorAtraso).sub}` : "nenhuma pendência vencida"}
            href="/solicitacoes?filtro=ATRASADAS"
          />
          <Metric label="Reuniões esta semana" valor={d.metricas.reunioesSemana} hint={d.metricas.hintSemana} href="/eventos" />
          <Metric label="Peças em déficit" valor={d.metricas.deficit} cor="#7a5f00" hint={d.metricas.hintDeficit} href="/consolidacao" />
        </MetricStrip>
      )}
      {d.tipo === "requisitante" && (
        <MetricStrip>
          <Metric label="Aguardando resposta" valor={d.metricas.aguardando} hint="da sua área" href="/solicitacoes?filtro=ABERTAS" />
          <Metric label="Rascunhos e devolvidas" valor={d.metricas.rascunhos} cor={d.metricas.temDevolvida ? "#a8400f" : undefined} hint="precisam de você" href="/solicitacoes?filtro=RASCUNHO" />
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
              sub="Ordenada por prazo. Solicitações de um item só podem ser respondidas aqui mesmo."
              acoes={
                responde && d.fila.length > 0 ? (
                  <ButtonLink href={`/solicitacoes/${d.fila[0].id}?fila=1`} variant="primary" size="sm" className="no-underline">
                    Responder em sequência
                  </ButtonLink>
                ) : undefined
              }
            >
              {d.fila.length === 0 ? (
                <div className="px-[18px] py-10 text-center">
                  <p className="m-0 text-[13.5px] font-medium text-ink">Fila zerada</p>
                  <p className="mt-1 text-[12.5px] text-muted">Nenhuma solicitação aguardando resposta.</p>
                </div>
              ) : (
                d.fila.map((f) => <LinhaFila key={f.id} f={f} rapida={responde} />)
              )}
            </Section>
          )}

          {d.tipo === "requisitante" && (
            <>
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
                  <div className="px-[18px] py-10 text-center">
                    <p className="m-0 text-[13.5px] font-medium text-ink">Nada pendente da sua área</p>
                    <p className="mt-1 text-[12.5px] text-muted">Quando um evento abrir para envio, ele aparece aqui.</p>
                  </div>
                ) : (
                  d.fila.map((f) => <LinhaFila key={f.id} f={f} rapida={false} />)
                )}
              </Section>
              <Section titulo="Respostas recebidas" sub="Cada item tem resposta própria. Parcial e recusa vêm sempre com motivo.">
                {d.respostas.length === 0 && <p className="m-0 px-[18px] py-8 text-center text-[12.5px] text-muted">Nenhuma resposta ainda.</p>}
                {d.respostas.map((r) => (
                  <Link key={r.id} href={`/solicitacoes/${r.id}`} className="block border-b border-line-row px-[18px] py-[13px] text-left no-underline last:border-b-0 hover:bg-subtle">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[12.5px] font-medium text-ink">{r.codigo}</span>
                      <span className="min-w-0 flex-1 text-[13.5px] text-ink">{r.titulo || "sem título"}</span>
                      <span className={cn("rounded-[5px] px-2 py-0.5 text-[11px] font-medium", r.ressalvas > 0 ? "bg-warning-bg text-warning" : "bg-success-bg text-success")}>
                        {r.ressalvas > 0 ? `${r.ressalvas} com ressalva` : "tudo atendido"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {r.eventoNome} · respondida por {r.respondidoPor}
                    </p>
                  </Link>
                ))}
              </Section>
            </>
          )}

        </div>

        <div className="flex flex-col gap-5">
          <Agenda itens={d.agenda} />

          {d.tipo === "operacao" && (
            <Section
              titulo="Estoque em risco"
              sub="Pico de demanda acima do estoque próprio."
              acoes={
                <Link href="/consolidacao" className="link text-[12.5px]">
                  Ver tudo
                </Link>
              }
            >
              {d.riscos.length === 0 && <p className="m-0 px-[18px] py-6 text-center text-[12.5px] text-muted">O estoque cobre a demanda dos próximos 30 dias.</p>}
              {d.riscos.map((r) => (
                <div key={r.pecaId} className="border-b border-line-faint px-[18px] py-[11px] last:border-b-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[12.5px] font-medium">{r.codigo}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{r.nome}</span>
                    <span className="font-mono text-[12.5px] font-medium text-danger">−{r.falta}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="relative block h-[5px] flex-1 overflow-hidden rounded-[3px] bg-line-soft" role="img" aria-label={`Estoque cobre ${Math.round((r.estoque / r.pico) * 100)}% do pico`}>
                      <span className="absolute left-0 top-0 block h-[5px] bg-dark" style={{ width: `${Math.min(100, Math.round((r.estoque / r.pico) * 100))}%` }} />
                    </span>
                    <span className="text-[11.5px] text-muted">
                      <span className="font-mono">{r.pico}</span> necessárias · <span className="font-mono">{r.estoque}</span> em estoque
                    </span>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {d.tipo === "requisitante" && (
            <section className="rounded-[10px] bg-dark p-[18px]">
              <h2 className="mb-3 mt-0 text-[13.5px] font-semibold text-white">Como o processo funciona</h2>
              {[
                "Evento em preparação: envie as necessidades da área antes da reunião de OS.",
                "Ata fechada: mudanças passam a entrar como solicitação de alteração.",
                "Cada item recebe resposta separada — atendido, parcial ou não atendido, sempre com motivo.",
                "Encerrado: nada mais entra. Só a Gestão reabre, em exceção.",
              ].map((texto, i) => (
                <div key={i} className="flex gap-[11px] py-[7px]">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-dark-2 font-mono text-[11px] text-accent-light">{i + 1}</span>
                  <span className="flex-1 text-[12.5px] leading-[1.5] text-on-dark-3">{texto}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
