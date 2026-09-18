import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, obterLinhasAta } from "@/server/services/eventos";
import { calcularOsAoVivo, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { slugArenaDoEvento } from "@/server/services/arenas";
import { OsVisoes, type VisaoOs } from "@/components/eventos/os-visoes";
import { Pills } from "@/components/ui/pills";
import { obterEventoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { totalPecas } from "@/domain/os";
import { classificarHistorico, COR_HISTORICO } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, hojeISO, isoSP, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Badge, ChipMono, Tag } from "@/components/ui/badge";
import { EmptyState, Marcador, Metric, MetricStrip, Section, type TomSemantico } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";

const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
const contagem = (n: number, hoje: string, passado: string) => (n === 0 ? hoje : n > 0 ? `faltam ${n} ${n === 1 ? "dia" : "dias"}` : `${passado} há ${-n} ${-n === 1 ? "dia" : "dias"}`);

type Grupo = { nome: string; codigo: string | null; capaId: string | null; quantidade: number; destinos: Set<string>; areas: Set<string>; ids: string[] };

/**
 * Visão geral do evento: um resumo visual para qualquer perfil (o que é, quando é, em que pé está,
 * o que vai ser montado e quem está envolvido). A parte de gestão (mudanças, ajustes, atividade)
 * fica abaixo, sem competir com a leitura rápida.
 */
const LEITURAS = [
  { chave: "lista", rotulo: "Itens e projetos" },
  { chave: "projetos", rotulo: "Por projeto, com as peças" },
  { chave: "totais", rotulo: "Todas as peças somadas" },
  { chave: "individuais", rotulo: "Peças soltas e fora do catálogo" },
] as const;
type Leitura = (typeof LEITURAS)[number]["chave"];

export default async function EventoVisaoGeralPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ itens?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const leitura: Leitura = LEITURAS.some((l) => l.chave === sp.itens) ? (sp.itens as Leitura) : "lista";
  const [ev, linhas, historico, versoes] = await Promise.all([obterEventoCache(usuario, id), obterLinhasAta(id), obterHistoricoEvento(usuario, id, 6), listarOsResumo(id)]);
  // O total de peças é conteúdo da OS: quem não tem a aba também não vê o número.
  const veOs = pode(usuario, "os.ver");
  const veTodasAsAreas = pode(usuario, "solicitacao.ver_todas");
  const veArena = pode(usuario, "arena.ver");
  // Leituras independentes em paralelo. As leituras por peça vêm do estado de agora (ata + o que
  // entrou depois), igual à OS em vigor.
  const [osAgora, conteudosUltimaOs, slugArena] = await Promise.all([
    leitura === "lista" ? null : calcularOsAoVivo(id),
    veOs && versoes[0] ? obterConteudosOs(id, [versoes[0].numero]) : null,
    veArena ? slugArenaDoEvento(id) : null,
  ]);
  const ultimaOs = conteudosUltimaOs && versoes[0] ? conteudosUltimaOs.get(versoes[0].numero) : null;
  const totalOs = ultimaOs ? totalPecas(ultimaOs) : 0;

  const projetos = linhas.filter((l) => l.tipo === "PROJETO");
  const pecasSoltas = linhas.filter((l) => l.tipo === "PECA");
  const foraCatalogo = linhas.filter((l) => l.tipo === "AVULSO");
  const posAta = linhas.filter((l) => l.posAta);
  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const unidades = linhas.reduce((a, l) => a + l.quantidade, 0);
  const porArea = new Map<string, number>();
  for (const l of linhas) porArea.set(l.areaNome ?? "Logística", (porArea.get(l.areaNome ?? "Logística") ?? 0) + 1);
  const areasEnvolvidas = [...porArea.entries()].sort((a, b) => b[1] - a[1]);
  const minhaArea = usuario.areaId;
  const deOutraArea = (l: (typeof linhas)[number]) => Boolean(minhaArea) && l.registro.areaId !== minhaArea;
  // Quem pediu é assunto da área que pediu: fora dela, a origem aparece sem o código da solicitação.
  const origemVisivel = (l: (typeof linhas)[number]) => (veTodasAsAreas || !l.origemSolicitacaoId || l.registro.areaId === minhaArea ? l.origemLabel : "Pedido de área");
  const AJUSTES = new Set(["ATA_QUANTIDADE", "ATA_REMOCAO", "AJUSTE_INCLUSAO", "CONFERENCIA_AJUSTE", "PECA_PROJETO_AJUSTADA", "ITEM_VINCULADO", "ATUALIZACAO_VERSAO"]);
  const ajustes = historico.filter((h) => h.entidade === "evento_item" && AJUSTES.has(h.acao));

  // Projetos agrupados (o mesmo projeto pode aparecer em várias linhas/destinos).
  const grupos = new Map<string, Grupo>();
  for (const l of projetos) {
    const k = l.projeto?.codigo ?? l.nome;
    const g = grupos.get(k) ?? { nome: l.nome, codigo: l.projeto?.codigo ?? null, capaId: null, quantidade: 0, destinos: new Set<string>(), areas: new Set<string>(), ids: [] };
    g.quantidade += l.quantidade;
    if (l.destino) g.destinos.add(l.destino);
    g.areas.add(l.areaNome ?? "Logística");
    g.ids.push(l.id);
    if (!g.capaId && l.capaId) g.capaId = l.capaId;
    grupos.set(k, g);
  }
  const galeria = [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade);

  const dEvento = diasAte(ev.dataInicio);
  const dReuniao = diasAte(isoSP(ev.dataReuniao));
  const fase: { rotulo: string; valor: string; sub?: string; tom: TomSemantico } =
    ev.status === "PREPARACAO"
      ? { rotulo: "Em preparação", valor: contagem(dReuniao, "reunião é hoje", "reunião foi"), sub: `As áreas enviam necessidades até a reunião de OS, ${diaMesHora(ev.dataReuniao)}.`, tom: "neutro" }
      : ev.status === "EM_REUNIAO"
        ? { rotulo: "Reunião de OS", valor: "acontecendo agora", sub: `${conferidas} de ${linhas.length} linhas conferidas.`, tom: "warning" }
        : ev.status === "ABERTO"
          ? { rotulo: "Aberto a alterações", valor: ev.janelaAlteracoesAte ? `até ${diaMesISO(ev.janelaAlteracoesAte)}` : "até encerrar", sub: `Ata fechada em ${diaMes(ev.ataFechadaEm)}. Alterações entram como solicitação.`, tom: "success" }
          : ev.status === "ENCERRADO"
            ? { rotulo: "Encerrado", valor: `OS final v${versoes[0]?.numero ?? "—"}`, sub: "Nada entra mais. O caminhão carrega o que está na OS.", tom: "neutro" }
            : { rotulo: "Cancelado", valor: "evento cancelado", sub: ev.canceladoMotivo ?? undefined, tom: "neutro" };

  const itensOrdenados = [...linhas].sort((a, b) => (a.areaNome ?? "Logística").localeCompare(b.areaNome ?? "Logística", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="flex flex-col gap-5">
      {/* Leitura rápida: quando é, em que pé está, o que vai ser montado. */}
      <MetricStrip className="mb-0">
        <Metric label="Evento" valor={periodoCurto(ev.dataInicio, ev.dataFim)} hint={contagem(dEvento, "é hoje", "aconteceu")} tom="accent" />
        <Metric label={fase.rotulo} valor={fase.valor} hint={fase.sub} tom={fase.tom} />
        <Metric
          label="Vai ser montado"
          valor={`${projetos.length + pecasSoltas.length + foraCatalogo.length} itens`}
          hint={`${projetos.length} ${projetos.length === 1 ? "projeto" : "projetos"} · ${unidades} unidades · ${areasEnvolvidas.length} ${areasEnvolvidas.length === 1 ? "área" : "áreas"}`}
          href="#itens"
        />
        <Metric
          label="Ordem de serviço"
          valor={versoes.length ? (veOs ? `v${versoes[0].numero} · ${totalOs} peças` : `v${versoes[0].numero}`) : "ainda não gerada"}
          hint={versoes.length ? `${versoes.length} ${versoes.length === 1 ? "versão" : "versões"} · última em ${diaMes(versoes[0].geradaEm)}${posAta.length ? ` · ${posAta.length} ${posAta.length === 1 ? "item" : "itens"} depois da ata` : ""}` : veOs ? "gerada ao fechar a ata; veja a prévia" : "gerada ao fechar a ata"}
          href={pode(usuario, "os.ver") ? `/eventos/${id}/os` : undefined}
        />
      </MetricStrip>

      {/* Lista completa: é a informação principal para quem pediu, inclusive o que entrou ou mudou depois da ata. */}
      <div id="itens" className="scroll-mt-20">
        <Section
          titulo={ev.ataFechadaEm ? "Todos os itens que vão para o evento" : "Todos os itens já na ata"}
          sub={ev.ataFechadaEm ? "Ata da reunião mais o que entrou depois. Itens marcados “depois da ata” ou “ajustado” mudaram após a reunião." : "O que as áreas pediram até agora. Ajustes acontecem na reunião."}
        >
          {linhas.length > 0 && (
            <div className="border-b border-line-soft px-cartao py-2.5">
              <Pills rotulo="Como ver os itens" itens={LEITURAS.map((l) => ({ label: l.rotulo, ativo: leitura === l.chave, href: l.chave === "lista" ? `/eventos/${id}#itens` : `/eventos/${id}?itens=${l.chave}#itens` }))} />
            </div>
          )}
          {linhas.length === 0 ? (
            <EmptyState compact title="Nada na ata ainda" />
          ) : osAgora ? (
            <div className="flex flex-col gap-4 bg-subtle p-4">
              <OsVisoes os={osAgora} visao={leitura as VisaoOs} semNavegacao titulo="Itens do evento" hrefVisao={(v) => `/eventos/${id}?itens=${v}#itens`} />
            </div>
          ) : (
            <table className="w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
              <CaptionOculta>Todos os itens do evento</CaptionOculta>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Área · destino</Th>
                  <Th>Origem</Th>
                  <Th largura={64} alinhar="right">
                    Qtd.
                  </Th>
                </tr>
              </thead>
              <tbody>
                {itensOrdenados.map((l) => (
                  <LinhaLink key={l.id} href={`/eventos/${id}/itens/${l.id}`} rotulo={`Abrir ${l.nome}`}>
                    <th scope="row" className="border-b border-line-row px-cartao py-2 text-left text-corpo font-normal">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="line-clamp-2 min-w-0 leading-[1.3] text-ink" title={l.nome}>{l.nome}</span>
                        {l.posAta && <Tag tom="accent">depois da ata</Tag>}
                        {!l.posAta && l.registro.justificativaAjuste && <Tag tom="warning">ajustado</Tag>}
                        {l.tipo === "AVULSO" && <Tag tom="warning">fora do catálogo</Tag>}
                      </span>
                    </th>
                    <td className="border-b border-line-row px-3 py-2 text-pequeno text-ink-3">
                      {l.areaNome ?? "Logística"}
                      {l.destino ? ` · ${l.destino}` : ""}
                    </td>
                    <td className="border-b border-line-row px-3 py-2 text-pequeno text-ink-3">{origemVisivel(l)}</td>
                    <td className="border-b border-line-row py-2 pl-3 pr-cartao text-right font-mono text-corpo font-medium text-ink">{l.quantidade}</td>
                  </LinhaLink>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section
        titulo="O que vai ser montado"
        sub={ev.ataFechadaEm ? "Projetos e peças que estão na OS. Clique para ver detalhes, quem pediu e o histórico." : "Projetos e peças já na ata em construção. Clique para ver detalhes e quem pediu."}
        acoes={
          <Link href="#itens" className="link text-pequeno">
            Ver a lista completa
          </Link>
        }
      >
        {linhas.length === 0 ? (
          <EmptyState compact title="Nada na ata ainda" description="Quando as áreas enviarem necessidades, os projetos aparecem aqui com foto." />
        ) : (
          <div className="px-cartao py-4">
            {galeria.length > 0 && (
              <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 xl:grid-cols-4">
                {galeria.map((g) => (
                  <li key={g.codigo ?? g.nome} className="overflow-hidden rounded-cartao border border-line bg-surface">
                    <Link href={`/eventos/${id}/itens/${g.ids[0]}`} className="block no-underline">
                      {/* Dentro do link a capa é só imagem (sem botão de zoom); o zoom fica na tela do item. */}
                      {g.capaId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/anexos/${g.capaId}?w=320`} alt={g.nome} loading="lazy" decoding="async" className="block aspect-[4/3] w-full bg-white object-contain" />
                      ) : (
                        <div className="grid aspect-[4/3] w-full place-items-center bg-subtle text-rotulo text-meta">sem foto</div>
                      )}
                      <div className="px-3 py-2.5">
                        <p className="m-0 flex items-start justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 text-corpo font-medium leading-[1.3] text-ink" title={g.nome}>
                            {g.nome}
                          </span>
                          <ChipMono tom="dark" className="shrink-0 text-accent-light">
                            × {g.quantidade}
                          </ChipMono>
                        </p>
                        <p className="mb-0 mt-0.5 truncate text-rotulo text-muted" title={[...g.destinos].join(" · ")}>
                          {[...g.destinos].join(" · ") || [...g.areas].join(" · ")}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {(pecasSoltas.length > 0 || foraCatalogo.length > 0) && (
              <div className={cn("flex flex-wrap gap-1.5", galeria.length > 0 && "mt-4 border-t border-line-soft pt-4")}>
                {pecasSoltas.map((l) => (
                  <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="no-underline">
                    <Badge tom="neutral" className="gap-1.5 text-ink hover:bg-control">
                      {l.nome} <span className="font-mono text-ink-3">× {l.quantidade}</span>
                    </Badge>
                  </Link>
                ))}
                {foraCatalogo.map((l) => (
                  <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="no-underline">
                    <Badge tom="warning" className="gap-1.5 text-ink">
                      {l.nome} <span className="font-mono text-ink-3">× {l.quantidade}</span>
                      <span className="text-rotulo text-warning">fora do catálogo</span>
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {ev.ataFechadaEm && (
            <Section titulo="Depois da ata" sub={posAta.length ? "Entrou na OS depois da reunião: alterações atendidas e ajustes da logística." : "Nada entrou depois da reunião. A OS reflete a ata."}>
              {posAta.slice(0, 8).map((l) => (
                <Link key={l.id} href={`/eventos/${id}/itens/${l.id}`} className="flex items-center gap-3 border-b border-line-row px-cartao py-2.5 text-corpo no-underline last:border-b-0 hover:bg-subtle">
                  <span className="line-clamp-2 min-w-0 flex-1 text-ink" title={l.nome}>
                    {l.nome}
                    {deOutraArea(l) && (
                      <Tag className="ml-2" tom="muted">
                        {l.areaNome ?? "Logística"}
                      </Tag>
                    )}
                  </span>
                  <span className="shrink-0 text-pequeno text-ink-3">{origemVisivel(l)}</span>
                  <span className="shrink-0 font-mono text-corpo font-medium text-ink">{l.quantidade}</span>
                </Link>
              ))}
              {posAta.length > 8 && (
                <Link href="#itens" className="link block px-cartao py-2.5 text-pequeno">
                  Mais {posAta.length - 8} itens
                </Link>
              )}
            </Section>
          )}

          <Section titulo="Ajustes" sub={ajustes.length ? "Mudanças de quantidade, peças de projeto, retiradas e vínculos, com quem fez." : "Nenhum ajuste até agora"}>
            {ajustes.slice(0, 5).map((h) => (
              <Link key={h.id} href={`/eventos/${id}/itens/${h.entidadeId}`} className="flex gap-3 border-b border-line-row px-cartao py-2.5 no-underline last:border-b-0 hover:bg-subtle">
                <span className="min-w-0 flex-1 truncate text-pequeno text-ink-2" title={h.descricao}>
                  {h.descricao}
                </span>
                <span className="shrink-0 text-rotulo text-muted">{h.usuario?.nome ?? "Sistema"}</span>
                <span className="shrink-0 font-mono text-rotulo text-meta">{diaMesHora(h.criadoEm)}</span>
              </Link>
            ))}
          </Section>

          <Section
            titulo="Atividade"
            acoes={
              <Link href={`/eventos/${id}/historico`} className="link text-pequeno">
                Ver histórico completo
              </Link>
            }
          >
            <div className="px-cartao py-3.5">
              {historico.length === 0 && <p className="m-0 text-pequeno text-muted">Sem registros</p>}
              {historico.map((h) => {
                const c = classificarHistorico(h);
                return (
                  <div key={h.id} className="flex gap-[13px] py-[7px]">
                    <Marcador cor={COR_HISTORICO[c.tipo]} quadrado={c.tipo === "marco"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-corpo text-ink">{c.titulo}</span>
                      <span className="block text-pequeno text-muted">{c.detalhe || h.usuario?.nome || "Sistema"}</span>
                    </span>
                    <span className="shrink-0 font-mono text-rotulo text-meta">{diaMesHora(h.criadoEm)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section titulo="Quem está envolvido">
            <div className="px-cartao py-3.5">
              <p className="m-0 flex items-center gap-2.5 text-corpo">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-dark text-pequeno font-semibold text-white">{ev.responsavel.nome.slice(0, 1)}</span>
                <span>
                  <span className="block text-ink">{ev.responsavel.nome}</span>
                  <span className="block text-rotulo text-muted">responsável na logística</span>
                </span>
              </p>
              {areasEnvolvidas.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {areasEnvolvidas.map(([nome, n]) => (
                    <Badge key={nome} tom="neutral" className="gap-1.5 text-ink">
                      {nome} <span className="font-mono text-ink-3">{n}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mb-0 mt-3 text-pequeno text-muted">Nenhuma área enviou necessidades ainda</p>
              )}
            </div>
          </Section>

          <Section titulo="Datas">
            <ol className="m-0 list-none px-cartao py-3">
              {[
                { rotulo: "Reunião de OS", quando: diaMesHora(ev.dataReuniao), feito: Boolean(ev.ataFechadaEm) || ev.status === "EM_REUNIAO", atual: ev.status === "EM_REUNIAO" },
                { rotulo: "Ata fechada", quando: ev.ataFechadaEm ? diaMesHora(ev.ataFechadaEm) : "ainda não", feito: Boolean(ev.ataFechadaEm), atual: false },
                ...(ev.janelaAlteracoesAte ? [{ rotulo: "Alterações até", quando: diaMesISO(ev.janelaAlteracoesAte), feito: hojeISO() > ev.janelaAlteracoesAte, atual: false }] : []),
                { rotulo: "Evento", quando: periodoCurto(ev.dataInicio, ev.dataFim), feito: dEvento < 0, atual: dEvento === 0 },
              ].map((d, i, arr) => (
                <li key={d.rotulo} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < arr.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-line" />}
                  <span aria-hidden className={cn("relative mt-[5px] block size-[11px] shrink-0 rounded-full ring-2 ring-surface", d.atual ? "bg-accent" : d.feito ? "bg-dark" : "bg-line-strong")} />
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <span className={cn("text-corpo", d.feito || d.atual ? "text-ink" : "text-ink-3")}>{d.rotulo}</span>
                    <span className="font-mono text-pequeno text-ink-2">{d.quando}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section titulo="Atalhos">
            <div className="flex flex-col gap-2 px-cartao py-3.5">
              {pode(usuario, "solicitacao.criar") && (ev.status === "PREPARACAO" || ev.status === "ABERTO") && (
                <ButtonLink href={`/solicitacoes/nova?evento=${id}`} variant="primary" size="md" className="no-underline">
                  {ev.status === "PREPARACAO" ? "Enviar necessidades" : "Solicitar alteração"}
                </ButtonLink>
              )}
              {pode(usuario, "os.ver") && versoes.length > 0 && (
                <ButtonLink href={`/impressao/os/${id}`} target="_blank" variant="secondary" size="md" className="no-underline">
                  Imprimir OS v{versoes[0].numero}
                </ButtonLink>
              )}
              <ButtonLink href={`/eventos/${id}/solicitacoes`} variant="secondary" size="md" className="no-underline">
                Solicitações do evento
              </ButtonLink>
              {veArena && (
                <ButtonLink href={slugArena ? `/arena/${slugArena}` : `/arena/nova?evento=${id}`} variant="secondary" size="md" className="no-underline">
                  {slugArena ? "Arena / mapa" : "Criar mapa da arena"}
                </ButtonLink>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
