import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { dadosPainel, type DadosPainel, type ItemAgenda, type ItemFila } from "@/server/services/dashboard";
import { pode, type UsuarioPermissao } from "@/domain/permissions";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { dataExtenso } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Marcador, Metric, MetricStrip, PageHeader, Section } from "@/components/ui/layout";
import { Badge, ChipMono, ForaJanelaTag, TipoSolicitacaoTag } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { IndicadorLink } from "@/components/ui/indicador-link";
import { Codigo, Numero } from "@/components/ui/numero";
import { Agora, type AcaoAgora } from "@/components/painel/agora";
import { AtenderRapido } from "@/components/painel/atender-rapido";
import { EventosSolicitante, MudancasSolicitante } from "@/components/painel/eventos-solicitante";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

export const metadata: Metadata = { title: "Painel" };

type Operacao = Extract<DadosPainel, { tipo: "operacao" }>;
type Requisitante = Extract<DadosPainel, { tipo: "requisitante" }>;

const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);

/** "Bom dia" / "Boa tarde" / "Boa noite" no fuso de São Paulo. */
function saudacao(agora: Date) {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(agora));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/* ------------------------------------------------------------------ */
/* Fila de resposta (operação) e solicitações abertas (solicitante)     */
/* ------------------------------------------------------------------ */

function LinhaFila({ f, rapida, agora }: { f: ItemFila; rapida: boolean; agora: Date }) {
  const pi = prazoInfo(f, agora);
  const cor = COR_TOM[pi.tom];
  const href = `/solicitacoes/${f.id}`;
  const contexto = [f.areaNome, f.eventoNome, `${f.total} ${plural(f.total, "item", "itens")}`, f.respondidos > 0 ? `${f.respondidos} ${plural(f.respondidos, "respondido", "respondidos")}` : null].filter(Boolean).join(" · ");
  const aberta = STATUS_ABERTOS.includes(f.status);
  return (
    <li className="flex items-start gap-3 border-b border-line-row px-cartao py-3 last:border-b-0">
      <Marcador cor={cor} pulsar={pi.vencido} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={href} className="inline-flex min-w-0 items-baseline gap-2 text-ink no-underline hover:underline">
            <Codigo className="text-pequeno text-ink-3">{f.codigo}</Codigo>
            <span className="text-corpo font-medium">{f.titulo || "sem título"}</span>
          </Link>
          <TipoSolicitacaoTag tipo={f.tipo} />
          {f.foraDaJanela && <ForaJanelaTag />}
        </div>
        <p className="m-0 mt-0.5 text-pequeno text-muted">{contexto}</p>
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
      <div className="shrink-0 pl-1 text-right">
        <span className="numero block text-pequeno font-medium" style={{ color: cor }}>
          {pi.vencido ? "atrasada" : pi.label}
        </span>
        <span className="numero block text-rotulo text-meta">{pi.sub && !pi.vencido && aberta ? `até ${pi.sub}` : pi.sub}</span>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda                                                              */
/* ------------------------------------------------------------------ */

/** Mesmas cores do calendário: reunião = info, carga = escuro, montagem = sucesso. */
const TIPO_AGENDA: Record<ItemAgenda["tipo"], { cor: string; rotulo: string }> = {
  reuniao: { cor: "var(--color-info)", rotulo: "Reunião" },
  carga: { cor: "var(--color-dark)", rotulo: "Carga" },
  montagem: { cor: "var(--color-success)", rotulo: "Montagem" },
};

function Agenda({ itens }: { itens: ItemAgenda[] }) {
  return (
    <Section
      titulo="Próximos 14 dias"
      acoes={
        <Link href="/calendario" className="link text-pequeno">
          Calendário
        </Link>
      }
    >
      {itens.length === 0 ? (
        <EmptyState compact title="Nada marcado" description="Reuniões, cargas e montagens das próximas duas semanas aparecem aqui." />
      ) : (
        <ul className="m-0 list-none p-0">
          {itens.map((a) => (
            <li key={a.chave} className="border-b border-line-row last:border-b-0">
              <Link href={a.href} className="flex gap-3 px-cartao py-2.5 no-underline hover:bg-subtle">
                <span className="numero w-11 shrink-0 text-pequeno text-ink-3">{a.dia}</span>
                <Marcador cor={TIPO_AGENDA[a.tipo].cor} quadrado={a.tipo === "reuniao"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-corpo font-medium text-ink">{a.titulo}</span>
                  <span className="block truncate text-pequeno text-muted">{a.sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Administrador: saúde do sistema e atalhos                           */
/* ------------------------------------------------------------------ */

function SaudeSistema({ s }: { s: NonNullable<Operacao["sistema"]> }) {
  const linhas: Array<{ rotulo: string; valor: number; href: string; icone: NomeIcone; alerta?: boolean; hint: string }> = [
    { rotulo: "Pessoas ativas", valor: s.usuariosAtivos, href: "/admin", icone: "usuario", hint: "conseguem entrar" },
    { rotulo: "Áreas ativas", valor: s.areasAtivas, href: "/admin?aba=areas", icone: "camadas", hint: "pedem itens" },
    { rotulo: "Eventos ativos", valor: s.eventosAtivos, href: "/eventos", icone: "eventos", hint: "em preparação, reunião ou abertos" },
    { rotulo: "Fora do catálogo", valor: s.foraCatalogo, href: "/biblioteca?aba=fora", icone: "caixa", alerta: s.foraCatalogo > 0, hint: s.foraCatalogo > 0 ? "para cadastrar ou vincular" : "tudo vinculado" },
  ];
  return (
    <Section titulo="Saúde do sistema" acoes={s.foraCatalogo > 0 ? <Badge tom="warning">1 ponto de atenção</Badge> : <Badge tom="success">Tudo em ordem</Badge>}>
      <ul className="m-0 list-none p-0">
        {linhas.map((l) => (
          <li key={l.rotulo} className="border-b border-line-row last:border-b-0">
            <Link href={l.href} className="flex items-center gap-3 px-cartao py-2.5 no-underline hover:bg-subtle">
              <Icone nome={l.icone} className="text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="block text-corpo text-ink">{l.rotulo}</span>
                <span className="block truncate text-pequeno text-muted">{l.hint}</span>
              </span>
              <Numero valor={l.valor} className={cn("text-secao font-semibold", l.alerta ? "text-warning" : "text-ink")} />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Atalhos({ usuario }: { usuario: UsuarioPermissao }) {
  const itens: Array<{ rotulo: string; href: string; icone: NomeIcone; ok: boolean }> = [
    { rotulo: "Usuários", href: "/admin", icone: "usuario", ok: pode(usuario, "admin.usuarios") },
    { rotulo: "Áreas", href: "/admin?aba=areas", icone: "camadas", ok: pode(usuario, "admin.areas") },
    { rotulo: "Novo evento", href: "/eventos/novo", icone: "mais", ok: pode(usuario, "evento.criar") },
    { rotulo: "Calendário", href: "/calendario", icone: "calendario", ok: true },
    { rotulo: "Consolidação", href: "/consolidacao", icone: "grafico", ok: pode(usuario, "consolidacao.ver") },
    { rotulo: "Pendências", href: "/pendencias", icone: "alerta", ok: pode(usuario, "pendencias.ver") },
  ];
  const visiveis = itens.filter((i) => i.ok);
  if (visiveis.length === 0) return null;
  return (
    <Section titulo="Atalhos">
      <ul className="m-0 grid list-none grid-cols-2 gap-px bg-line-row p-0">
        {visiveis.map((i) => (
          <li key={i.href} className="bg-surface">
            <Link href={i.href} className="flex min-h-11 items-center gap-2.5 px-cartao py-2.5 text-corpo text-ink no-underline hover:bg-subtle">
              <Icone nome={i.icone} className="text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{i.rotulo}</span>
              <IndicadorLink />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* O que precisa da pessoa agora                                       */
/* ------------------------------------------------------------------ */

function acoesOperacao(d: Operacao, usuario: UsuarioPermissao, responde: boolean, agora: Date): AcaoAgora[] {
  const acoes: AcaoAgora[] = [];
  if (d.reuniaoHoje) {
    const conferir = pode(usuario, "ata.consolidar");
    acoes.push({
      chave: "reuniao",
      icone: "calendario",
      tom: "info",
      titulo: `Reunião de OS às ${d.reuniaoHoje.hora}`,
      detalhe: d.reuniaoHoje.nome,
      href: conferir ? `/conferencia/${d.reuniaoHoje.id}` : `/eventos/${d.reuniaoHoje.id}`,
      rotuloAcao: conferir ? "Abrir conferência" : "Ver evento",
    });
  }
  const { atrasadas, aguardando, piorAtraso } = d.metricas;
  if (atrasadas > 0) {
    acoes.push({
      chave: "atrasadas",
      icone: "alerta",
      tom: "danger",
      n: <Numero valor={atrasadas} />,
      titulo: plural(atrasadas, "solicitação atrasada", "solicitações atrasadas"),
      detalhe: piorAtraso ? `${piorAtraso.codigo} venceu ${prazoInfo(piorAtraso, agora).sub}` : undefined,
      href: "/solicitacoes?filtro=ATRASADAS",
      rotuloAcao: "Ver atrasadas",
    });
  }
  const noPrazo = aguardando - atrasadas;
  if (noPrazo > 0) {
    const proxima = d.fila.find((f) => !prazoInfo(f, agora).vencido);
    const sub = proxima ? prazoInfo(proxima, agora).sub : "";
    acoes.push({
      chave: "aguardando",
      icone: "relogio",
      tom: "warning",
      n: <Numero valor={noPrazo} />,
      titulo: responde ? "aguardando sua resposta" : "aguardando resposta",
      detalhe: sub ? `próximo prazo ${sub}` : undefined,
      href: "/solicitacoes?filtro=ABERTAS",
      rotuloAcao: "Ver fila",
    });
  }
  if (d.sistema && d.sistema.foraCatalogo > 0) {
    acoes.push({
      chave: "fora",
      icone: "caixa",
      tom: "warning",
      n: <Numero valor={d.sistema.foraCatalogo} />,
      titulo: plural(d.sistema.foraCatalogo, "item fora do catálogo", "itens fora do catálogo"),
      detalhe: "para cadastrar ou vincular",
      href: "/biblioteca?aba=fora",
      rotuloAcao: "Vincular",
    });
  }
  return acoes;
}

function acoesRequisitante(d: Requisitante, agora: Date): AcaoAgora[] {
  const acoes: AcaoAgora[] = [];
  const { rascunhos, temDevolvida, comRessalva7 } = d.metricas;
  if (rascunhos > 0) {
    acoes.push({
      chave: "rascunhos",
      icone: temDevolvida ? "alerta" : "lapis",
      tom: temDevolvida ? "danger" : "warning",
      n: <Numero valor={rascunhos} />,
      titulo: temDevolvida ? plural(rascunhos, "devolvida ou rascunho", "devolvidas ou rascunhos") : plural(rascunhos, "rascunho para enviar", "rascunhos para enviar"),
      detalhe: temDevolvida ? "a logística pediu ajuste" : "ainda não chegaram à logística",
      href: "/solicitacoes?filtro=RASCUNHO",
      rotuloAcao: "Concluir",
    });
  }
  if (comRessalva7 > 0) {
    acoes.push({
      chave: "ressalvas",
      icone: "info",
      tom: "warning",
      n: <Numero valor={comRessalva7} />,
      titulo: plural(comRessalva7, "resposta com ressalva", "respostas com ressalva"),
      detalhe: "parcial ou não atendido, com motivo",
      href: "/solicitacoes?filtro=RESPONDIDA",
      rotuloAcao: "Ver respostas",
    });
  }
  const semana = d.mudancas.filter((m) => agora.getTime() - new Date(m.quando).getTime() <= 7 * 86_400_000).length;
  if (semana > 0) {
    acoes.push({
      chave: "mudancas",
      icone: "camadas",
      tom: "info",
      n: <Numero valor={semana} />,
      titulo: plural(semana, "mudança nos seus eventos", "mudanças nos seus eventos"),
      detalhe: "nos últimos 7 dias",
      href: "#o-que-mudou",
      rotuloAcao: "Ver o que mudou",
    });
  }
  return acoes;
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default async function PainelPage() {
  const usuario = await requireUsuario();
  const d = await dadosPainel(usuario);
  const primeiroNome = usuario.nome.split(" ")[0];
  const agora = new Date();
  // Logística e Administrador respondem: fila com atendimento rápido e modo fila.
  const responde = pode(usuario, "solicitacao.responder");
  const hoje = dataExtenso(agora);

  // Uma ação principal por perfil, no cabeçalho.
  let acao: { label: string; href: string; icone: NomeIcone } | null;
  if (d.tipo === "operacao") {
    acao =
      usuario.perfil === "GESTAO"
        ? { label: "Ver atrasos", href: "/solicitacoes?filtro=ATRASADAS", icone: "alerta" }
        : usuario.perfil === "ADMIN"
          ? { label: "Administração", href: "/admin", icone: "escudo" }
          : d.reuniaoHoje
            ? { label: "Abrir conferência de hoje", href: `/conferencia/${d.reuniaoHoje.id}`, icone: "calendario" }
            : pode(usuario, "evento.criar")
              ? { label: "Novo evento", href: "/eventos/novo", icone: "mais" }
              : null;
  } else {
    acao = pode(usuario, "solicitacao.criar") ? { label: "Nova solicitação", href: "/solicitacoes/nova", icone: "mais" } : null;
  }

  return (
    <>
      <PageHeader
        divisor
        eyebrow={<span className="numero">{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</span>}
        title={`${saudacao(agora)}, ${primeiroNome}`}
        actions={
          acao && (
            <ButtonLink href={acao.href} variant="primary" size="lg" className="no-underline">
              <Icone nome={acao.icone} />
              {acao.label}
            </ButtonLink>
          )
        }
      />

      {d.tipo === "operacao" && (
        <>
          <Agora acoes={acoesOperacao(d, usuario, responde, agora)} vazio={{ titulo: "Nada urgente agora", descricao: "Sem atrasos, sem solicitações aguardando e sem reunião hoje." }} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
            <Section
              titulo={
                <span className="inline-flex items-center gap-2">
                  Fila de resposta
                  {d.fila.length > 0 && <ChipMono tom="control">{d.fila.length}</ChipMono>}
                </span>
              }
              sub="Por prazo, a mais urgente primeiro."
              acoes={
                responde && d.fila.length > 0 ? (
                  <ButtonLink href={`/solicitacoes/${d.fila[0].id}?fila=1`} variant="secondary" size="sm" className="no-underline">
                    <Icone nome="seta" />
                    Responder em sequência
                  </ButtonLink>
                ) : undefined
              }
            >
              {d.fila.length === 0 ? (
                <EmptyState
                  compact
                  title="Fila zerada"
                  description="Nenhuma solicitação aguardando resposta."
                  action={
                    <Link href="/solicitacoes" className="link text-corpo">
                      Ver todas as solicitações
                    </Link>
                  }
                />
              ) : (
                <ul className="m-0 list-none p-0">
                  {d.fila.map((f) => (
                    <LinhaFila key={f.id} f={f} rapida={responde} agora={agora} />
                  ))}
                </ul>
              )}
            </Section>

            <div className="flex flex-col gap-5">
              {d.sistema && <SaudeSistema s={d.sistema} />}
              <Agenda itens={d.agenda} />
              {usuario.perfil === "ADMIN" && <Atalhos usuario={usuario} />}
            </div>
          </div>

          <section aria-label="Resumo" className="mt-6">
            <MetricStrip>
            <Metric
              label={responde ? "Aguardando sua resposta" : "Aguardando resposta"}
              valor={<Numero valor={d.metricas.aguardando} />}
              hint={d.metricas.atrasadas > 0 ? `${d.metricas.atrasadas} ${plural(d.metricas.atrasadas, "atrasada", "atrasadas")}` : "nenhuma atrasada"}
              href="/solicitacoes?filtro=ABERTAS"
            />
            <Metric label="Atrasadas" valor={<Numero valor={d.metricas.atrasadas} />} tom={d.metricas.atrasadas > 0 ? "danger" : "neutro"} hint={d.metricas.piorAtraso ? `pior: ${d.metricas.piorAtraso.codigo}` : "tudo no prazo"} href="/solicitacoes?filtro=ATRASADAS" />
            <Metric label="Reuniões esta semana" valor={<Numero valor={d.metricas.reunioesSemana} />} hint={d.metricas.hintSemana} href="/calendario" />
            <Metric label="Eventos em preparação" valor={<Numero valor={d.metricas.emPreparacao} />} hint={d.metricas.hintPreparacao} href="/eventos?fase=PREPARACAO" />
            </MetricStrip>
          </section>
        </>
      )}

      {d.tipo === "requisitante" && (
        <>
          <Agora acoes={acoesRequisitante(d, agora)} vazio={{ titulo: "Nada pendente da sua área", descricao: "Rascunhos, devoluções e respostas com ressalva aparecem aqui." }} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5">
              <EventosSolicitante eventos={d.eventos} mudancas={d.mudancas} />

              <Section
                titulo={
                  <span className="inline-flex items-center gap-2">
                    Suas solicitações em andamento
                    {d.fila.length > 0 && <ChipMono tom="control">{d.fila.length}</ChipMono>}
                  </span>
                }
                acoes={
                  <Link href="/solicitacoes" className="link text-pequeno">
                    Ver todas
                  </Link>
                }
              >
                {d.fila.length === 0 ? (
                  <EmptyState compact title="Nada em andamento" description="Quando um evento abrir para envio, mande as necessidades da área." />
                ) : (
                  <ul className="m-0 list-none p-0">
                    {d.fila.map((f) => (
                      <LinhaFila key={f.id} f={f} rapida={false} agora={agora} />
                    ))}
                  </ul>
                )}
              </Section>

              <Section titulo="Respostas recebidas">
                {d.respostas.length === 0 ? (
                  <EmptyState compact title="Nenhuma resposta nos últimos 7 dias" />
                ) : (
                  <ul className="m-0 list-none p-0">
                    {d.respostas.map((r) => (
                      <li key={r.id} className="border-b border-line-row last:border-b-0">
                        <Link href={`/solicitacoes/${r.id}`} className="flex items-start gap-3 px-cartao py-3 no-underline hover:bg-subtle">
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <Codigo className="text-pequeno text-ink-3">{r.codigo}</Codigo>
                              <span className="min-w-0 truncate text-corpo font-medium text-ink">{r.titulo || "sem título"}</span>
                            </span>
                            <span className="mt-0.5 block text-pequeno text-muted">
                              {r.eventoNome} · {r.naAta ? "confere na reunião" : `por ${r.respondidoPor}`}
                            </span>
                          </span>
                          <Badge tom={r.naAta ? "info" : r.ressalvas > 0 ? "warning" : "success"}>{r.naAta ? "Na ata" : r.ressalvas > 0 ? `${r.ressalvas} com ressalva` : "Tudo atendido"}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <MudancasSolicitante mudancas={d.mudancas} />
              <Agenda itens={d.agenda} />
              <Section tom="dark" titulo="Como funciona" padded>
                <ol className="m-0 list-none p-0">
                  {[
                    "Em preparação: envie as necessidades antes da reunião de OS.",
                    "Ata fechada: mudanças entram como solicitação de alteração.",
                    "Cada item tem resposta própria, sempre com motivo.",
                    "Encerrado: nada mais entra. Só a Gestão reabre.",
                  ].map((texto, i) => (
                    <li key={i} className="flex gap-2.5 py-1.5">
                      <span aria-hidden className="numero grid size-5 shrink-0 place-items-center rounded-chip bg-dark-2 text-rotulo text-accent-light">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-pequeno text-on-dark-3">{texto}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>
          </div>

          <section aria-label="Resumo" className="mt-6">
            <MetricStrip>
            <Metric label="Aguardando resposta" valor={<Numero valor={d.metricas.aguardando} />} hint="da sua área" href="/solicitacoes?filtro=ABERTAS" />
            <Metric label="Rascunhos e devolvidas" valor={<Numero valor={d.metricas.rascunhos} />} tom={d.metricas.temDevolvida ? "danger" : "neutro"} hint="precisam de você" href="/solicitacoes?filtro=RASCUNHO" />
            <Metric
              label="Respondidas em 7 dias"
              valor={<Numero valor={d.metricas.respondidas7} />}
              hint={d.metricas.respondidas7 === 0 ? "nenhuma na semana" : d.metricas.comRessalva7 > 0 ? `${d.metricas.comRessalva7} com ressalva` : "tudo atendido"}
              href="/solicitacoes?filtro=RESPONDIDA"
            />
            <Metric label="Eventos aceitando envio" valor={<Numero valor={d.metricas.aceitando} />} hint={`${d.metricas.nPrep} em preparação · ${d.metricas.nAberto} ${plural(d.metricas.nAberto, "aberto", "abertos")}`} href="/eventos" />
            </MetricStrip>
          </section>
        </>
      )}
    </>
  );
}
