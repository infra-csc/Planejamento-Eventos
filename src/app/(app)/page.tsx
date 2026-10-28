import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { dadosPainel, type DadosPainel, type ItemAgenda, type ItemFila } from "@/server/services/dashboard";
import { pode, type UsuarioPermissao } from "@/domain/permissions";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { dataExtenso } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Marcador, PageHeader, Section } from "@/components/ui/layout";
import { Badge, ChipMono, ForaJanelaTag } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { LinhaLink } from "@/components/ui/linha-link";
import { CaptionOculta, Th } from "@/components/ui/tabela";
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

const celula = "border-b border-line-row py-2.5";

/** Título com contador ao lado (cabeçalho de cartão). */
function TituloContado({ texto, n }: { texto: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {texto}
      {n > 0 && <ChipMono tom="control">{n}</ChipMono>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Fila de resposta (operação) e solicitações em andamento (solicitante) */
/* ------------------------------------------------------------------ */

/** Prazo numa linha: a parte forte (atrasada / em 5h / rascunho) e a data, que quebra para baixo no celular. */
function Prazo({ f, agora }: { f: ItemFila; agora: Date }) {
  const pi = prazoInfo(f, agora);
  const aberta = STATUS_ABERTOS.includes(f.status);
  const forte = pi.vencido ? "atrasada" : pi.label;
  const resto = pi.sub && !pi.vencido && aberta ? `até ${pi.sub}` : pi.sub;
  return (
    <span className="numero text-pequeno" style={{ color: COR_TOM[pi.tom] }}>
      <span className="whitespace-nowrap font-medium">{forte}</span>
      {resto && (
        <>
          {" "}
          <span className="whitespace-nowrap">{resto}</span>
        </>
      )}
    </span>
  );
}

/**
 * Uma linha por solicitação, uma informação por coluna (solicitação · área · evento · prazo), como a lista de
 * itens do evento. As colunas aparecem pela largura do cartão (@container): estreito, área e evento descem
 * para baixo do título. O tipo (sempre "alteração" na fila da logística) saiu; "fora da janela" fica, porque
 * muda a decisão. Atender rápido é um ícone na última coluna; parcial e não atender abrem pela linha.
 */
function TabelaFila({ fila, agora, rapida, comArea, rotulo }: { fila: ItemFila[]; agora: Date; rapida: boolean; comArea: boolean; rotulo: string }) {
  const temRapida = rapida && fila.some((f) => f.pendenteUnico);
  return (
    <div className="@container">
      <table data-responsiva className="w-full table-fixed border-collapse">
        <CaptionOculta>{rotulo}</CaptionOculta>
        <thead>
          <tr className="bg-subtle">
            <Th>Solicitação</Th>
            {comArea && <Th className="hidden @2xl:table-cell @2xl:w-[100px]">Área</Th>}
            <Th className="hidden @lg:table-cell @lg:w-[26%]">Evento</Th>
            <Th alinhar="right" className="w-[96px] @lg:w-[140px]">
              Prazo
            </Th>
            {temRapida && (
              <Th className="w-[52px] max-md:w-[64px]">
                <span className="sr-only">Atender</span>
              </Th>
            )}
          </tr>
        </thead>
        <tbody>
          {fila.map((f) => {
            const titulo = f.titulo || "sem título";
            const itens = `${f.total} ${plural(f.total, "item", "itens")}${f.respondidos > 0 ? `, ${f.respondidos} ${plural(f.respondidos, "respondido", "respondidos")}` : ""}`;
            return (
              <LinhaLink key={f.id} href={`/solicitacoes/${f.id}`} rotulo={`Abrir ${f.codigo} — ${titulo}`}>
                <th scope="row" className={`${celula} max-w-0 pl-cartao pr-3 text-left font-normal`}>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <Codigo className="shrink-0 text-pequeno text-ink-3">{f.codigo}</Codigo>
                    <span className="truncate text-corpo font-medium text-ink" title={`${titulo} · ${itens}`}>
                      {titulo}
                    </span>
                    {f.foraDaJanela && <ForaJanelaTag className="shrink-0" />}
                  </span>
                  {/* Cartão estreito: área (se a coluna sumiu) e evento embaixo do título. */}
                  <span className={`mt-0.5 block truncate text-pequeno text-muted ${comArea ? "@2xl:hidden" : "@lg:hidden"}`}>
                    {comArea && f.areaNome}
                    <span className="@lg:hidden">
                      {comArea && f.areaNome ? " · " : ""}
                      {f.eventoNome}
                    </span>
                  </span>
                </th>
                {comArea && <td className={`${celula} hidden max-w-0 truncate px-3 text-pequeno text-ink-2 @2xl:table-cell`}>{f.areaNome}</td>}
                <td className={`${celula} hidden max-w-0 px-3 @lg:table-cell`}>
                  <span className="block truncate text-pequeno text-ink-2" title={f.eventoNome}>
                    {f.eventoNome}
                  </span>
                </td>
                <td className={`${celula} pl-2 pr-3 text-right last:pr-cartao`}>
                  <Prazo f={f} agora={agora} />
                </td>
                {temRapida && (
                  <td className={`${celula} pl-1 pr-cartao text-right`}>
                    {f.pendenteUnico && (
                      <AtenderRapido
                        itemId={f.pendenteUnico.id}
                        codigo={f.codigo}
                        sufixo={f.tipo === "ALTERACAO" ? "nova versão da OS" : "item entrou na ata"}
                        rotulo={`${f.pendenteUnico.descricao} × ${f.pendenteUnico.quantidade}${f.pendenteUnico.destino ? ` · ${f.pendenteUnico.destino}` : ""}`}
                      />
                    )}
                  </td>
                )}
              </LinhaLink>
            );
          })}
        </tbody>
      </table>
    </div>
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

/** Uma linha por compromisso: dia · o quê · onde (o "onde" corta antes do "o quê"). */
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
          {itens.map((a, i) => {
            const sub = a.sub && a.sub.trim() !== "—" ? a.sub : null;
            return (
              <li key={a.chave} className="border-b border-line-row last:border-b-0">
                <Link
                  href={a.href}
                  title={sub ? `${a.titulo} · ${sub}` : a.titulo}
                  className="flex min-h-10 items-center gap-3 px-cartao py-2 no-underline transition-colors duration-150 hover:bg-subtle"
                >
                  {/* O dia aparece na primeira linha dele; nas seguintes fica só para o leitor de tela (a coluna lê como agenda). */}
                  {i > 0 && itens[i - 1].dia === a.dia ? (
                    <span className="w-11 shrink-0">
                      <span className="sr-only">{a.dia}</span>
                    </span>
                  ) : (
                    <span className="numero w-11 shrink-0 text-pequeno font-medium text-ink-2">{a.dia}</span>
                  )}
                  <Marcador cor={TIPO_AGENDA[a.tipo].cor} quadrado={a.tipo === "reuniao"} className="!mt-0" />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="max-w-full shrink-0 truncate text-corpo font-medium text-ink">{a.titulo}</span>
                    {/* O "onde" usa o espaço que sobra e corta primeiro; no celular fica só no title. */}
                    {sub && <span className="hidden min-w-0 truncate text-pequeno text-muted sm:block">{sub}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Administrador: o cadastro em números                                */
/* ------------------------------------------------------------------ */

/**
 * Pessoas, áreas e eventos ativos, uma linha cada, cada uma levando à tela onde se cuida dela. Substitui
 * "Saúde do sistema" (com uma frase embaixo de cada número e o selo "1 ponto de atenção") e o cartão
 * "Atalhos" (Usuários, Áreas, Novo evento, Calendário: já estão no menu e nestas linhas). "Fora do catálogo"
 * ficou só em "Precisa de você agora", onde aparece quando há o que vincular.
 */
function Cadastro({ s }: { s: NonNullable<Operacao["sistema"]> }) {
  const linhas: Array<{ rotulo: string; valor: number; href: string; icone: NomeIcone }> = [
    { rotulo: "Pessoas ativas", valor: s.usuariosAtivos, href: "/admin", icone: "usuario" },
    { rotulo: "Áreas ativas", valor: s.areasAtivas, href: "/admin?aba=areas", icone: "camadas" },
    { rotulo: "Eventos ativos", valor: s.eventosAtivos, href: "/eventos", icone: "eventos" },
  ];
  return (
    <Section titulo="Cadastro">
      <ul className="m-0 list-none p-0">
        {linhas.map((l) => (
          <li key={l.rotulo} className="border-b border-line-row last:border-b-0">
            <Link href={l.href} className="flex min-h-10 items-center gap-3 px-cartao py-2 no-underline transition-colors duration-150 hover:bg-subtle">
              <Icone nome={l.icone} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-corpo text-ink">{l.rotulo}</span>
              <Numero valor={l.valor} className="text-corpo font-semibold text-ink" />
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
    });
  }
  // Reunião aberta há dias e reunião que passou sem começar: a ata não fecha sozinha e a OS não sai.
  if (d.reunioes.abertas.n > 0) {
    acoes.push({
      chave: "reunioes-abertas",
      icone: "alerta",
      tom: "warning",
      n: <Numero valor={d.reunioes.abertas.n} />,
      titulo: plural(d.reunioes.abertas.n, "reunião aberta com a ata por fechar", "reuniões abertas com a ata por fechar"),
      detalhe: d.reunioes.abertas.nomes,
      href: "/eventos?fase=EM_REUNIAO",
    });
  }
  if (d.reunioes.naoIniciadas.n > 0) {
    acoes.push({
      chave: "reunioes-nao-iniciadas",
      icone: "relogio",
      tom: "warning",
      n: <Numero valor={d.reunioes.naoIniciadas.n} />,
      titulo: plural(d.reunioes.naoIniciadas.n, "reunião passou sem começar", "reuniões passaram sem começar"),
      detalhe: d.reunioes.naoIniciadas.nomes,
      href: "/eventos?reuniao=atrasada",
    });
  }
  if (d.reunioes.amanha.n > 0) {
    acoes.push({
      chave: "reunioes-amanha",
      icone: "calendario",
      tom: "info",
      n: <Numero valor={d.reunioes.amanha.n} />,
      titulo: plural(d.reunioes.amanha.n, "reunião de OS amanhã", "reuniões de OS amanhã"),
      detalhe: d.reunioes.amanha.horas,
      href: "/eventos?reuniao=amanha",
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
    });
  }
  return acoes;
}

/** O que mudou nos eventos fica no próprio cartão "O que mudou", ao lado: não entra aqui de novo. */
function acoesRequisitante(d: Requisitante): AcaoAgora[] {
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
    });
  }
  return acoes;
}

/** Respostas da semana: uma linha por solicitação (solicitação · evento · resultado). Some quando não há. */
function RespostasRecebidas({ respostas }: { respostas: Requisitante["respostas"] }) {
  if (respostas.length === 0) return null;
  return (
    <Section titulo="Respostas recebidas">
      <div className="@container">
        <table data-responsiva className="w-full table-fixed border-collapse">
          <CaptionOculta>Respostas recebidas nos últimos 7 dias</CaptionOculta>
          <thead>
            <tr className="bg-subtle">
              <Th>Solicitação</Th>
              <Th className="hidden @lg:table-cell @lg:w-[34%]">Evento</Th>
              <Th className="w-[140px]">Resposta</Th>
            </tr>
          </thead>
          <tbody>
            {respostas.map((r) => {
              const titulo = r.titulo || "sem título";
              return (
                <LinhaLink key={r.id} href={`/solicitacoes/${r.id}`} rotulo={`Abrir ${r.codigo} — ${titulo}`}>
                  <th scope="row" className={`${celula} max-w-0 pl-cartao pr-3 text-left font-normal`}>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <Codigo className="shrink-0 text-pequeno text-ink-3">{r.codigo}</Codigo>
                      <span className="truncate text-corpo font-medium text-ink" title={titulo}>
                        {titulo}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-pequeno text-muted @lg:hidden">{r.eventoNome}</span>
                  </th>
                  <td className={`${celula} hidden max-w-0 px-3 @lg:table-cell`}>
                    <span className="block truncate text-pequeno text-ink-2" title={r.naAta ? r.eventoNome : `${r.eventoNome} · respondida por ${r.respondidoPor}`}>
                      {r.eventoNome}
                    </span>
                  </td>
                  <td className={`${celula} px-3 last:pr-cartao`}>
                    <Badge tom={r.naAta ? "info" : r.ressalvas > 0 ? "warning" : "success"}>{r.naAta ? "Na ata" : r.ressalvas > 0 ? `${r.ressalvas} com ressalva` : "Tudo atendido"}</Badge>
                  </td>
                </LinhaLink>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** As regras do envio, fechadas por padrão: quem usa todo dia não precisa delas na tela; quem chega, abre. */
function ComoFunciona() {
  return (
    <details className="group rounded-cartao border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-cartao py-2.5 text-corpo font-medium text-ink [&::-webkit-details-marker]:hidden">
        <Icone nome="info" className="shrink-0 text-ink-3" />
        Como funciona o envio
        <Icone nome="chevron-baixo" className="ml-auto shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <ol className="m-0 list-decimal border-t border-line-soft py-2.5 pl-10 pr-cartao text-pequeno text-ink-2 marker:text-ink-3">
        <li className="py-1">Em preparação: envie as necessidades antes da reunião de OS.</li>
        <li className="py-1">Ata fechada: mudanças entram como solicitação de alteração.</li>
        <li className="py-1">Cada item tem resposta própria, sempre com motivo.</li>
        <li className="py-1">Encerrado: nada mais entra. Só a Gestão reabre.</li>
      </ol>
    </details>
  );
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

  // Uma ação principal por perfil, no cabeçalho. A Gestão não tem: "Ver atrasos" repetia a linha de atrasadas logo abaixo.
  let acao: { label: string; href: string; icone: NomeIcone } | null;
  if (d.tipo === "operacao") {
    acao =
      usuario.perfil === "GESTAO"
        ? null
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
          <>
            {/* A Cenografia mantém a Biblioteca (projetos padrão e peças): o painel dela não apontava para lá. */}
            {usuario.perfil === "CENOGRAFIA" && (
              <ButtonLink href="/biblioteca" variant="secondary" size="lg" className="no-underline">
                <Icone nome="livro" />
                Biblioteca
              </ButtonLink>
            )}
            {acao && (
              <ButtonLink href={acao.href} variant="primary" size="lg" className="no-underline">
                <Icone nome={acao.icone} />
                {acao.label}
              </ButtonLink>
            )}
          </>
        }
      />

      {d.tipo === "operacao" && (
        <>
          <Agora acoes={acoesOperacao(d, usuario, responde, agora)} vazio={{ titulo: "Nada urgente agora", descricao: "Sem atrasos, sem solicitações aguardando e sem reunião hoje." }} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
            <Section
              // Gestão acompanha, não responde: "Fila de resposta" dizia o contrário.
              titulo={<TituloContado texto={responde ? "Fila de resposta" : "Aguardando a logística"} n={d.fila.length} />}
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
                <TabelaFila fila={d.fila} agora={agora} rapida={responde} comArea rotulo={responde ? "Fila de resposta, por prazo" : "Aguardando a logística, por prazo"} />
              )}
            </Section>

            <div className="flex min-w-0 flex-col gap-5">
              <Agenda itens={d.agenda} />
              {d.sistema && <Cadastro s={d.sistema} />}
            </div>
          </div>
        </>
      )}

      {d.tipo === "requisitante" && (
        <>
          <Agora acoes={acoesRequisitante(d)} vazio={{ titulo: "Nada pendente da sua área", descricao: "Rascunhos, devoluções e respostas com ressalva aparecem aqui." }} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5">
              <EventosSolicitante eventos={d.eventos} />

              <Section
                titulo={<TituloContado texto="Suas solicitações em andamento" n={d.fila.length} />}
                acoes={
                  <Link href="/solicitacoes" className="link text-pequeno">
                    Ver todas
                  </Link>
                }
              >
                {d.fila.length === 0 ? (
                  <EmptyState compact title="Nada em andamento" description="Quando um evento abrir para envio, mande as necessidades da área." />
                ) : (
                  <TabelaFila fila={d.fila} agora={agora} rapida={false} comArea={false} rotulo="Suas solicitações em andamento" />
                )}
              </Section>

              <RespostasRecebidas respostas={d.respostas} />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <MudancasSolicitante mudancas={d.mudancas} />
              <Agenda itens={d.agenda} />
              <ComoFunciona />
            </div>
          </div>
        </>
      )}
    </>
  );
}
