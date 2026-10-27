import { conferenciaOpcional } from "@/domain/itens-padrao";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, obterLinhasAta, opcoesReferenciasResumidas } from "@/server/services/eventos";
import { calcularOsAoVivo, listarOsResumo, totalPecasOs } from "@/server/services/os";
import { slugArenaDoEvento } from "@/server/services/arenas";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { OsVisoes, type VisaoOs } from "@/components/eventos/os-visoes";
import { Pills } from "@/components/ui/pills";
import { listarAreasCache, obterEventoCache } from "@/server/cache";
import { daMinhaArea, pode } from "@/domain/permissions";
import { classificarHistorico } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, hojeISO, iniciais, isoSP, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ChipMono, Tag } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { EmptyState, Metric, MetricStrip, Section, type TomSemantico } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { QuantidadeAta } from "@/components/eventos/quantidade-ata";
import { AcoesLinhaEvento, IncluirItemEvento } from "@/components/eventos/acoes-linha-evento";
import { BadgeVersao } from "@/components/eventos/ata-lista";
import { VincularCatalogo } from "@/components/eventos/vincular-catalogo";
import { kitDaTenda, PAPEIS_POR_LOCAL } from "@/domain/tendas";
import { iconeHistorico, LinhaTempoAgrupada } from "@/components/eventos/linha-tempo-agrupada";
import { MudancasPosAta } from "@/components/eventos/mudancas-pos-ata";
import { mudancasPosAta } from "@/server/services/solicitacoes";

const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
const contagem = (n: number, hoje: string, passado: string) => (n === 0 ? hoje : n > 0 ? `em ${n} ${n === 1 ? "dia" : "dias"}` : `${passado} há ${-n} ${-n === 1 ? "dia" : "dias"}`);

type Grupo = { nome: string; codigo: string | null; capaId: string | null; quantidade: number; destinos: Set<string>; areas: Set<string>; ids: string[] };

/**
 * Visão geral do evento: resumo no topo (o que falta, prazos, versão da OS), o que mudou depois
 * da ata em destaque discreto, os itens agrupados por tipo (projetos, peças, fora do catálogo) e a
 * galeria dos projetos. Na coluna lateral: datas, quem está envolvido, ajustes e atividade.
 */
const LEITURAS = [
  { chave: "lista", rotulo: "Lista" },
  { chave: "projetos", rotulo: "Peças por projeto" },
  { chave: "totais", rotulo: "Totais por peça" },
  { chave: "individuais", rotulo: "Soltas e fora do catálogo" },
] as const;
type Leitura = (typeof LEITURAS)[number]["chave"];

const GRUPOS_TIPO = [
  { tipo: "PROJETO", rotulo: "Projetos" },
  { tipo: "PECA", rotulo: "Peças do catálogo" },
  { tipo: "AVULSO", rotulo: "Fora do catálogo" },
] as const;

/** Linha de atalho da coluna lateral: ícone + texto, a linha inteira é o link. */
function Atalho({ href, icone, children, novaAba }: { href: string; icone: NomeIcone; children: React.ReactNode; novaAba?: boolean }) {
  return (
    <Link
      href={href}
      target={novaAba ? "_blank" : undefined}
      className="flex items-center gap-2.5 border-b border-line-row px-cartao py-2.5 text-corpo text-ink no-underline transition-colors duration-150 last:border-b-0 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-md:min-h-11"
    >
      <Icone nome={icone} className="shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">{children}</span>
      <Icone nome={novaAba ? "link-externo" : "chevron-direita"} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export default async function EventoVisaoGeralPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ itens?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const leitura: Leitura = LEITURAS.some((l) => l.chave === sp.itens) ? (sp.itens as Leitura) : "lista";
  const [ev, linhas, historico, versoes, mudancas] = await Promise.all([obterEventoCache(usuario, id), obterLinhasAta(id), obterHistoricoEvento(usuario, id), listarOsResumo(id), mudancasPosAta(id)]);
  // O total de peças é conteúdo da OS: quem não tem a aba também não vê o número.
  const veOs = pode(usuario, "os.ver");
  const veTodasAsAreas = pode(usuario, "solicitacao.ver_todas");
  const veArena = pode(usuario, "arena.ver");
  // Admin e logística corrigem os itens daqui (mesma regra da página do item): antes da ata, e com a ata fechada.
  const antesDaAta = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";
  const editavel = pode(usuario, "ata.consolidar") && (antesDaAta || (ev.status === "ABERTO" && pode(usuario, "ata.ajustar")));
  // Leituras independentes em paralelo. As leituras por peça vêm do estado de agora (ata + o que
  // entrou depois), igual à OS em vigor. Catálogo e áreas só para quem inclui e vincula itens.
  const [osAgora, totalOs, slugArena, gruposMaterial, opcoes, areasAtivas] = await Promise.all([
    leitura === "lista" ? null : calcularOsAoVivo(id),
    veOs && versoes[0] ? totalPecasOs(id, versoes[0].numero) : 0,
    veArena ? slugArenaDoEvento(id) : null,
    leitura === "lista" ? undefined : mapaGruposPecas(),
    editavel ? opcoesReferenciasResumidas() : null,
    editavel ? listarAreasCache() : Promise.resolve([]),
  ]);

  const projetos = linhas.filter((l) => l.tipo === "PROJETO");
  // Para fechar a ata contam só as obrigatórias ("a definir" e estaiamento ficam de fora).
  const obrigatorias = linhas.filter((l) => !conferenciaOpcional({ tipo: l.tipo, codigo: l.peca?.codigo, quantidade: l.quantidade }));
  const conferidas = obrigatorias.filter((l) => l.conferidoEm).length;
  const unidades = linhas.reduce((a, l) => a + l.quantidade, 0);
  const porArea = new Map<string, number>();
  for (const l of linhas) porArea.set(l.areaNome ?? "Logística", (porArea.get(l.areaNome ?? "Logística") ?? 0) + 1);
  const areasEnvolvidas = [...porArea.entries()].sort((a, b) => b[1] - a[1]);
  // Quem pediu é assunto da área que pediu: fora dela, a origem aparece sem o código da solicitação.
  const podeVerOrigem = (l: (typeof linhas)[number]) => veTodasAsAreas || !l.origemSolicitacaoId || daMinhaArea(usuario, l.registro.areaId);
  const origemVisivel = (l: (typeof linhas)[number]) => (podeVerOrigem(l) ? l.origemLabel : "Pedido de área");
  // Nome de quem pediu (ou de quem incluiu), com a mesma regra do código da solicitação.
  const quemPediu = (l: (typeof linhas)[number]) => (podeVerOrigem(l) ? l.origemPor : null);
  const AJUSTES = new Set(["ATA_QUANTIDADE", "ATA_REMOCAO", "AJUSTE_INCLUSAO", "CONFERENCIA_AJUSTE", "PECA_PROJETO_AJUSTADA", "ITEM_VINCULADO", "ATUALIZACAO_VERSAO"]);
  const ajustesTodos = historico.filter((h) => h.entidade === "evento_item" && AJUSTES.has(h.acao));
  const depoisDaAta = (h: { criadoEm: Date }) => Boolean(ev.ataFechadaEm) && h.criadoEm > ev.ataFechadaEm!;
  const ajustesPosAta = ajustesTodos.filter((h) => depoisDaAta(h) && h.acao !== "CONFERENCIA_AJUSTE");
  const ajustes = ajustesTodos.filter((h) => !depoisDaAta(h));

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
  // O que falta: o próximo marco da fase, com o prazo.
  const falta: { rotulo: string; valor: React.ReactNode; hint?: string; tom: TomSemantico; href?: string } =
    ev.status === "PREPARACAO"
      ? { rotulo: "Próximo passo: reunião de OS", valor: contagem(dReuniao, "hoje", "foi"), hint: `${diaMesHora(ev.dataReuniao)} · as áreas enviam necessidades até lá`, tom: dReuniao < 0 ? "warning" : "neutro" }
      : ev.status === "EM_REUNIAO"
        ? {
            rotulo: "Conferência da ata",
            valor: (
              <>
                {conferidas}
                <span className="text-destaque font-normal text-muted"> de {obrigatorias.length}</span>
              </>
            ),
            hint: obrigatorias.length - conferidas > 0 ? `faltam ${obrigatorias.length - conferidas} para fechar a ata` : "tudo conferido; falta fechar a ata",
            tom: "warning",
            href: pode(usuario, "ata.consolidar") ? `/conferencia/${id}` : undefined,
          }
        : ev.status === "ABERTO"
          ? {
              rotulo: "Alterações",
              valor: ev.janelaAlteracoesAte ? `até ${diaMesISO(ev.janelaAlteracoesAte)}` : "abertas",
              hint: mudancas.length + ajustesPosAta.length ? `${mudancas.length + ajustesPosAta.length} ${mudancas.length + ajustesPosAta.length === 1 ? "mudança" : "mudanças"} desde a ata de ${diaMes(ev.ataFechadaEm)}` : `Ata fechada em ${diaMes(ev.ataFechadaEm)}. Nada mudou desde então.`,
              tom: "neutro",
              href: "#mudancas",
            }
          : ev.status === "ENCERRADO"
            ? { rotulo: "Encerrado", valor: "nada falta", hint: "Nada entra mais. O caminhão carrega o que está na OS.", tom: "success" }
            : { rotulo: "Cancelado", valor: "—", hint: ev.canceladoMotivo ?? undefined, tom: "neutro" };

  const porTipo = GRUPOS_TIPO.map((g) => ({ ...g, linhas: linhas.filter((l) => l.tipo === g.tipo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) })).filter((g) => g.linhas.length > 0);
  // Mesmo item em vários locais (ex.: 13 tendas 3×3) vira uma linha só, com o total e os locais; o detalhe
  // de cada local fica na página do item (que lista todas as linhas dele).
  // Peça: só o nome (o código já está na linha de baixo e no detalhe).
  const nomeExibido = (l: (typeof linhas)[number]) => (l.tipo === "PECA" && l.peca ? l.peca.nome : l.nome);
  // De onde veio a linha (área · pedido ou inclusão · quem), numa frase só: na coluna larga e embaixo do nome.
  const deOnde = (l: (typeof linhas)[number]) => `${l.areaNome ?? "Logística"} · ${origemVisivel(l)}${quemPediu(l) ? ` · ${quemPediu(l)}` : ""}`;
  // Tenda: quantas tendas e o que varia por local (fechamentos, calhas), pela lista de peças gravada na linha.
  const detalheTenda = (l: (typeof linhas)[number]) => {
    if (l.tipo !== "PROJETO") return null;
    const bom = l.registro.bomSnapshot ?? [];
    const kit = kitDaTenda(bom.map((b) => b.codigo));
    if (!kit) return null;
    const total = (codigo: string | undefined) => (codigo ? (bom.find((b) => b.codigo === codigo)?.quantidade ?? 0) * l.quantidade : 0);
    const rotulos: Record<string, [string, string]> = { fechamento: ["fechamento", "fechamentos"], calha: ["calha", "calhas"] };
    const partes = [`${l.quantidade} ${l.quantidade === 1 ? "tenda" : "tendas"} ${kit.tamanho}`];
    for (const papel of PAPEIS_POR_LOCAL) {
      const n = total(kit.pecas[papel]);
      if (n > 0) partes.push(`${n} ${rotulos[papel]?.[n === 1 ? 0 : 1] ?? papel}`);
    }
    if (partes.length === 1) partes.push("sem fechamentos");
    return partes.join(" · ");
  };
  // Para o quadro da tenda: o local inteiro (todas as linhas da mesma tenda no mesmo local) e os totais dele.
  const tendaDoLocal = (x: (typeof linhas)[number], doItem: typeof linhas) => {
    const bom = x.registro.bomSnapshot ?? [];
    const kit = x.tipo === "PROJETO" ? kitDaTenda(bom.map((b) => b.codigo)) : null;
    if (!kit) return undefined;
    const doLocal = doItem.filter((y) => (y.destino ?? "").trim().toLowerCase() === (x.destino ?? "").trim().toLowerCase());
    const soma = (codigo: string | undefined) => (codigo ? doLocal.reduce((a, y) => a + (y.registro.bomSnapshot ?? []).filter((b) => b.codigo === codigo).reduce((c, b) => c + b.quantidade, 0) * y.quantidade, 0) : 0);
    return { linhaIds: doLocal.map((y) => y.id), local: x.destino, tamanho: kit.tamanho, tendas: doLocal.reduce((a, y) => a + y.quantidade, 0), fechamentos: soma(kit.pecas.fechamento), calhas: soma(kit.pecas.calha), temCalha: Boolean(kit.pecas.calha) };
  };
  const agruparItens = (ls: typeof linhas) => {
    const m = new Map<string, typeof linhas>();
    for (const l of ls) {
      const k = `${l.tipo}|${l.projeto?.codigo ?? l.peca?.codigo ?? l.nome}`;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.values()];
  };

  const datas = [
    { rotulo: "Reunião de OS", quando: diaMesHora(ev.dataReuniao), feito: Boolean(ev.ataFechadaEm) || ev.status === "EM_REUNIAO", atual: ev.status === "EM_REUNIAO" },
    { rotulo: "Ata fechada", quando: ev.ataFechadaEm ? diaMesHora(ev.ataFechadaEm) : "—", feito: Boolean(ev.ataFechadaEm), atual: false },
    ...(ev.janelaAlteracoesAte ? [{ rotulo: "Alterações até", quando: diaMesISO(ev.janelaAlteracoesAte), feito: hojeISO() > ev.janelaAlteracoesAte, atual: false }] : []),
    { rotulo: "Evento", quando: periodoCurto(ev.dataInicio, ev.dataFim), feito: dEvento < 0, atual: dEvento === 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo: o que falta, quando é, o tamanho do evento e a versão da OS. */}
      <MetricStrip className="mb-0">
        <Metric label={falta.rotulo} valor={falta.valor} hint={falta.hint} tom={falta.tom} href={falta.href} hintInteiro />
        <Metric label="Evento" valor={periodoCurto(ev.dataInicio, ev.dataFim)} hint={contagem(dEvento, "é hoje", "aconteceu")} />
        <Metric
          label="Itens"
          valor={<Numero valor={linhas.length} />}
          hint={`${galeria.length} ${galeria.length === 1 ? "projeto" : "projetos"} · ${unidades.toLocaleString("pt-BR")} un. · ${areasEnvolvidas.length} ${areasEnvolvidas.length === 1 ? "área" : "áreas"}`}
          href="#itens"
        />
        <Metric
          label="Ordem de serviço"
          valor={versoes.length ? <Codigo>v{versoes[0].numero}</Codigo> : "—"}
          hint={versoes.length ? `${veOs ? `${totalOs.toLocaleString("pt-BR")} peças · ` : ""}atualizada ${diaMes(versoes[0].geradaEm)}` : "gerada ao fechar a ata"}
          href={veOs ? `/eventos/${id}/os` : undefined}
        />
      </MetricStrip>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Depois da reunião: o que entrou, mudou ou saiu (pedidos das áreas e ajustes da logística), em destaque. */}
          {ev.ataFechadaEm && (
            <MudancasPosAta
              ataFechadaEm={ev.ataFechadaEm}
              mudancas={mudancas.map((m) => ({ ...m, codigoVisivel: veTodasAsAreas || daMinhaArea(usuario, m.areaId) }))}
              ajustes={ajustesPosAta.map((h) => ({ id: h.id, titulo: classificarHistorico(h).titulo, autor: h.usuario?.nome ?? null, quando: h.criadoEm, href: `/eventos/${id}/itens/${h.entidadeId}` }))}
              hrefOs={veOs && versoes.length > 1 ? `/eventos/${id}/os?base=${versoes[versoes.length - 1].numero}` : null}
            />
          )}

          {/* Itens por tipo: projetos, peças do catálogo e fora do catálogo — com quem pediu e para onde vai. */}
          <div id="itens" className="alvo-ancora">
            <Section
              titulo="Itens do evento"
              sub={
                editavel
                  ? ev.ataFechadaEm
                    ? "Ata da reunião mais o que entrou depois. Cada correção gera nova versão da OS."
                    : "O que as áreas pediram até agora. Corrija aqui ou na conferência."
                  : ev.ataFechadaEm
                    ? "Ata da reunião mais o que entrou depois."
                    : "O que as áreas pediram até agora. Ajustes acontecem na reunião."
              }
              acoes={editavel && opcoes ? <IncluirItemEvento eventoId={id} ataFechada={Boolean(ev.ataFechadaEm)} opcoes={opcoes} areas={areasAtivas.map((a) => ({ id: a.id, nome: a.nome }))} /> : undefined}
            >
              {linhas.length > 0 && (
                <div className="overflow-x-auto border-b border-line-soft px-cartao py-2.5">
                  <Pills rotulo="Como ver os itens" className="max-md:flex-nowrap" itens={LEITURAS.map((l) => ({ label: l.rotulo, ativo: leitura === l.chave, href: l.chave === "lista" ? `/eventos/${id}#itens` : `/eventos/${id}?itens=${l.chave}#itens` }))} />
                </div>
              )}
              {linhas.length === 0 ? (
                <EmptyState compact title="Nenhum item ainda" description={editavel ? "Os pedidos das áreas entram aqui sozinhos. O que for decidido fora de um pedido entra por “Incluir item”." : "Quando as áreas enviarem necessidades, os itens aparecem aqui."} />
              ) : osAgora ? (
                <div className="flex flex-col gap-4 bg-subtle p-3 sm:p-4">
                  <OsVisoes os={osAgora} grupos={gruposMaterial} visao={leitura as VisaoOs} semNavegacao titulo="Itens do evento" hrefVisao={(v) => `/eventos/${id}?itens=${v}#itens`} />
                </div>
              ) : (
                // As colunas seguem a largura da lista, não da tela: a 1280 px, ao lado da coluna lateral, a lista tem ~650 px
                // e a origem desce para baixo do nome (antes o nome ficava espremido em 3 linhas e cortado).
                <div className="@container">
                  <table data-responsiva className="w-full border-collapse max-sm:[overflow-wrap:anywhere]">
                    <CaptionOculta>Itens do evento por tipo</CaptionOculta>
                    <thead>
                      <tr>
                        <Th>Item · local</Th>
                        <Th className="hidden @3xl:table-cell @3xl:w-[28%]">Área · origem</Th>
                        <Th largura={64} alinhar="right">
                          Qtd.
                        </Th>
                        {editavel && (
                          <Th className="hidden w-px sm:table-cell">
                            <span className="sr-only">Ações</span>
                          </Th>
                        )}
                      </tr>
                    </thead>
                    {porTipo.map((g) => (
                      <tbody key={g.tipo}>
                        <tr>
                          <th colSpan={editavel ? 4 : 3} scope="colgroup" className="border-b border-line-soft bg-subtle px-cartao py-1.5 text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                            {g.rotulo}
                            <span className="numero ml-2 font-normal tracking-normal text-muted">{agruparItens(g.linhas).length}</span>
                          </th>
                        </tr>
                        {agruparItens(g.linhas).flatMap((itensDoGrupo) => {
                          const l = itensDoGrupo[0];
                          const varios = itensDoGrupo.length > 1;
                          // Locais distintos: duas linhas no mesmo local (uma da reunião, outra incluída depois) não são "2 locais".
                          const nLocais = new Set(itensDoGrupo.map((x) => (x.destino ?? "").trim().toLowerCase())).size;
                          const rotuloGrupo = nLocais === itensDoGrupo.length ? `${nLocais} locais` : `${nLocais} ${nLocais === 1 ? "local" : "locais"} · ${itensDoGrupo.length} linhas`;
                          // Mesma origem em todas as linhas (ex.: tendas incluídas na reunião): ela aparece uma vez, no total do item.
                          const origemComum = varios && new Set(itensDoGrupo.map(deOnde)).size === 1;
                          const capa =
                            g.tipo === "PROJETO" &&
                            (l.capaId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`/api/anexos/${l.capaId}?w=96`} alt="" loading="lazy" decoding="async" className="h-8 w-11 shrink-0 rounded-chip border border-line bg-white object-contain" />
                            ) : (
                              <span aria-hidden className="grid h-8 w-11 shrink-0 place-items-center rounded-chip border border-line bg-subtle text-meta">
                                <Icone nome="camadas" className="size-3.5" />
                              </span>
                            ));
                          const colunaOrigem = (x: (typeof linhas)[number]) => (
                            <>
                              {x.areaNome ?? "Logística"}
                              <span className="block text-rotulo text-ink-3">
                                {origemVisivel(x)}
                                {quemPediu(x) ? ` · ${quemPediu(x)}` : ""}
                              </span>
                            </>
                          );
                          // Mesmo item em vários locais: uma linha com o total e, embaixo, cada local com a sua quantidade
                          // (e as suas ações), em vez de "N locais" sem detalhe.
                          const cabecalho = varios ? (
                            <tr key={`${l.id}-total`}>
                              <th scope="row" className="border-b border-line-soft py-2 pl-cartao pr-3 text-left font-normal">
                                <span className="flex min-w-0 items-center gap-2.5">
                                  {capa}
                                  <span className="min-w-0">
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <span className="line-clamp-2 text-corpo font-medium text-ink" title={nomeExibido(l)}>
                                        {nomeExibido(l)}
                                      </span>
                                      <Tag tom="muted">{rotuloGrupo}</Tag>
                                    </span>
                                    <span className="block text-rotulo text-muted @3xl:hidden">{origemComum ? deOnde(l) : [...new Set(itensDoGrupo.map((x) => x.areaNome ?? "Logística"))].join(", ")}</span>
                                  </span>
                                </span>
                              </th>
                              <td className="hidden border-b border-line-soft px-3 py-2 text-pequeno text-ink-2 @3xl:table-cell">{origemComum ? colunaOrigem(l) : [...new Set(itensDoGrupo.map((x) => x.areaNome ?? "Logística"))].join(", ")}</td>
                              <td className="border-b border-line-soft py-2 pl-3 pr-cartao text-right text-corpo font-semibold text-ink">
                                <QuantidadeAta valor={itensDoGrupo.reduce((a, x) => a + x.quantidade, 0)} />
                              </td>
                              {editavel && <td className="hidden border-b border-line-soft sm:table-cell" />}
                            </tr>
                          ) : null;
                          const linhasDoItem = itensDoGrupo.map((x) => {
                            const tenda = detalheTenda(x);
                            const acoes = editavel ? (
                              <AcoesLinhaEvento
                                eventoId={id}
                                ataFechada={Boolean(ev.ataFechadaEm)}
                                linha={{ id: x.id, nome: `${nomeExibido(x)}${x.destino ? ` · ${x.destino}` : ""}`, quantidade: x.quantidade, veioDePedido: Boolean(x.origemSolicitacaoId) }}
                                hrefPecas={x.tipo === "PROJETO" ? `/eventos/${id}/itens/${x.id}#pecas` : undefined}
                                tenda={tendaDoLocal(x, itensDoGrupo)}
                                extra={x.tipo === "AVULSO" && opcoes ? <VincularCatalogo compacto linha={{ linhaId: x.id, descricao: x.nome, quantidade: x.quantidade }} opcoes={opcoes} podeCadastrar={pode(usuario, "catalogo.gerenciar")} /> : undefined}
                              />
                            ) : null;
                            return (
                              <LinhaLink key={x.id} href={`/eventos/${id}/itens/${x.id}`} rotulo={`Abrir ${nomeExibido(x)}${x.destino ? ` · ${x.destino}` : ""}`}>
                                <th scope="row" className={cn("border-b border-line-row py-2.5 pr-3 text-left font-normal", varios ? "pl-10" : "pl-cartao")}>
                                  <span className="flex min-w-0 items-center gap-2.5">
                                    {!varios && capa}
                                    <span className="min-w-0">
                                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className={cn("line-clamp-2 text-ink", varios ? "text-pequeno" : "text-corpo")} title={nomeExibido(x)}>
                                          {varios ? (
                                            <>
                                              <span aria-hidden className="text-meta">↳ </span>
                                              {x.destino ?? "sem local informado"}
                                            </>
                                          ) : (
                                            nomeExibido(x)
                                          )}
                                        </span>
                                        {x.posAta ? <Tag tom="info">depois da ata</Tag> : x.registro.justificativaAjuste ? <Tag tom="warning">ajustado</Tag> : null}
                                        {editavel && x.versaoDefasada && <BadgeVersao l={{ id: x.id, nome: nomeExibido(x), versao: x.versao, versaoAtual: x.versaoAtual }} eventoId={id} podeAtualizar />}
                                      </span>
                                      {!varios && x.destino && <span className="block text-pequeno text-ink-2">{x.destino}</span>}
                                      {tenda && <span className="block text-rotulo text-ink-3">{tenda}</span>}
                                      {!origemComum && <span className="block text-rotulo text-muted @3xl:hidden">{deOnde(x)}</span>}
                                      {acoes && <span className="mt-1 block sm:hidden">{acoes}</span>}
                                    </span>
                                  </span>
                                </th>
                                <td className="hidden border-b border-line-row px-3 py-2.5 text-pequeno text-ink-2 @3xl:table-cell">{!origemComum && colunaOrigem(x)}</td>
                                <td className={cn("border-b border-line-row py-2.5 pl-3 pr-cartao text-right text-ink", varios ? "text-pequeno" : "text-corpo font-medium")}>
                                  <QuantidadeAta valor={x.quantidade} />
                                </td>
                                {editavel && <td className="hidden w-px whitespace-nowrap border-b border-line-row py-2 pr-cartao text-right sm:table-cell">{acoes}</td>}
                              </LinhaLink>
                            );
                          });
                          return [cabecalho, ...linhasDoItem];
                        })}
                      </tbody>
                    ))}
                  </table>
                </div>
              )}
            </Section>
          </div>

          {galeria.length > 0 && (
            <Section titulo="Galeria dos projetos" sub="O que vai ser montado. Abra um projeto para ver as peças e quem pediu.">
              <ul className="m-0 grid list-none grid-cols-2 gap-3 px-cartao py-4 sm:grid-cols-3 xl:grid-cols-4">
                {galeria.map((g) => (
                  <li key={g.codigo ?? g.nome} className="group overflow-hidden rounded-cartao border border-line bg-surface transition-colors duration-150 hover:border-line-strong">
                    <Link href={`/eventos/${id}/itens/${g.ids[0]}`} className="block no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      {/* Dentro do link a capa é só imagem (sem botão de zoom); o zoom fica na tela do item. */}
                      {g.capaId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/anexos/${g.capaId}?w=320`} alt={g.nome} loading="lazy" decoding="async" className="block aspect-[4/3] w-full border-b border-line-soft bg-white object-contain transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]" />
                      ) : (
                        <div className="grid aspect-[4/3] w-full place-items-center border-b border-line-soft bg-subtle text-meta">
                          <Icone nome="camadas" tamanho={20} />
                        </div>
                      )}
                      <div className="px-3 py-2.5">
                        <p className="m-0 flex items-start justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 text-corpo font-medium text-ink" title={g.nome}>
                            {g.nome}
                          </span>
                          <ChipMono className="shrink-0">× {g.quantidade}</ChipMono>
                        </p>
                        <p className="mb-0 mt-0.5 truncate text-rotulo text-muted" title={[...g.destinos].join(" · ")}>
                          {[...g.destinos].join(" · ") || [...g.areas].join(" · ")}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Section titulo="Datas">
            <ol className="m-0 list-none px-cartao py-3.5">
              {datas.map((d, i) => (
                <li key={d.rotulo} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < datas.length - 1 && <span aria-hidden className="absolute left-[4px] top-3 h-full w-px bg-line" />}
                  <span aria-hidden className={cn("relative mt-1.5 block size-[9px] shrink-0 rounded-full ring-2 ring-surface", d.atual ? "bg-accent" : d.feito ? "bg-ink-3" : "bg-line-strong")} />
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <span className={cn("text-corpo", d.atual ? "font-medium text-ink" : d.feito ? "text-ink-2" : "text-ink-3")}>{d.rotulo}</span>
                    <span className="numero shrink-0 text-pequeno text-ink-2">{d.quando}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section titulo="Quem está envolvido">
            <div className="flex items-center gap-2.5 border-b border-line-row px-cartao py-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-bg text-pequeno font-semibold text-ink-2">
                {iniciais(ev.responsavel.nome)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-corpo text-ink">{ev.responsavel.nome}</span>
                <span className="block text-rotulo text-muted">responsável na logística</span>
              </span>
            </div>
            {areasEnvolvidas.length > 0 ? (
              <ul className="m-0 list-none px-cartao py-2">
                {areasEnvolvidas.map(([nome, n]) => (
                  <li key={nome} className="flex items-baseline justify-between gap-3 py-1 text-pequeno">
                    <span className="truncate text-ink-2">{nome}</span>
                    <span className="numero shrink-0 text-muted">
                      {n} {n === 1 ? "item" : "itens"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 px-cartao py-3 text-pequeno text-muted">Nenhuma área enviou necessidades ainda.</p>
            )}
          </Section>

          {ajustes.length > 0 && (
            <Section titulo="Ajustes recentes" sub="Quantidades, peças de projeto, retiradas e vínculos">
              <ul className="m-0 list-none p-0">
                {ajustes.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    <Link href={`/eventos/${id}/itens/${h.entidadeId}`} className="block border-b border-line-row px-cartao py-2.5 no-underline transition-colors duration-150 hover:bg-subtle">
                      <span className="line-clamp-2 text-pequeno text-ink-2" title={h.descricao}>
                        {h.descricao}
                      </span>
                      <span className="mt-0.5 block text-rotulo text-muted">
                        {h.usuario?.nome ?? "Sistema"} · <span className="numero">{diaMesHora(h.criadoEm)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            titulo="Atividade"
            acoes={
              <Link href={`/eventos/${id}/historico`} className="link text-pequeno">
                Ver tudo
              </Link>
            }
          >
            <LinhaTempoAgrupada
              compacta
              maximo={6}
              vazio={<EmptyState compact title="Sem registros" />}
              entradas={historico.map((h) => {
                const c = classificarHistorico(h);
                return { id: h.id, em: h.criadoEm, titulo: c.titulo, detalhe: c.detalhe || null, autor: h.usuario?.nome ?? null, ...iconeHistorico(h.entidade, h.acao) };
              })}
            />
          </Section>

          <Section titulo="Atalhos">
            {veOs && versoes.length > 0 && (
              <Atalho href={`/impressao/os/${id}`} icone="imprimir" novaAba>
                Imprimir OS <Codigo className="text-ink-3">v{versoes[0].numero}</Codigo>
              </Atalho>
            )}
            <Atalho href={`/eventos/${id}/solicitacoes`} icone="solicitacoes">
              Solicitações do evento
            </Atalho>
            {/* Quem só vê o mapa não tem "criar": o atalho aparece quando o evento já tem arena. */}
            {veArena && (slugArena || pode(usuario, "arena.editar")) && (
              <Atalho href={slugArena ? `/arena/${slugArena}` : `/arena/nova?evento=${id}`} icone="arena">
                {slugArena ? "Mapa da arena" : "Criar mapa da arena"}
              </Atalho>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
