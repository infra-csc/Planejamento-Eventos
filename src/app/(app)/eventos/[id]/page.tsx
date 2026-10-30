import { conferenciaOpcional } from "@/domain/itens-padrao";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, obterLinhasAta, opcoesReferenciasResumidas } from "@/server/services/eventos";
import { listarOsResumo, totalPecasOs } from "@/server/services/os";
import { calcularOS } from "@/domain/os";
import { montarEdicaoOs } from "@/components/eventos/edicao-os-evento";
import { slugArenaDoEvento } from "@/server/services/arenas";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { OsVisoes, type VisaoOs } from "@/components/eventos/os-visoes";
import { Pills } from "@/components/ui/pills";
import { listarAreasCache, obterEventoCache } from "@/server/cache";
import { daMinhaArea, pode } from "@/domain/permissions";
import { classificarHistorico } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, hojeISO, isoSP, periodoCurto } from "@/lib/format";
import { ChipMono } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { EmptyState, Metric, MetricStrip, Section, type TomSemantico } from "@/components/ui/layout";
import { IncluirItemEvento } from "@/components/eventos/acoes-linha-evento";
import { ListaItensEvento } from "@/components/eventos/lista-itens-evento";
import { iconeHistorico, LinhaTempoAgrupada } from "@/components/eventos/linha-tempo-agrupada";
import { agruparAtualizacoesDeVersao, MudancasPosAta, separarAjustes, tituloAtualizacao } from "@/components/eventos/mudancas-pos-ata";
import { mudancasPosAta } from "@/server/services/solicitacoes";

const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
const contagem = (n: number, hoje: string, passado: string) => (n === 0 ? hoje : n > 0 ? `em ${n} ${n === 1 ? "dia" : "dias"}` : `${passado} há ${-n} ${-n === 1 ? "dia" : "dias"}`);

type Grupo = { nome: string; codigo: string | null; capaId: string | null; quantidade: number; destinos: Set<string>; areas: Set<string>; ids: string[] };

/**
 * Visão geral do evento: resumo no topo (o que falta, prazos, versão da OS), o que mudou depois da ata, os itens na
 * largura toda (é onde admin e logística corrigem) e, embaixo, a galeria dos projetos, a atividade e os atalhos.
 * Datas, responsável e fases já estão no cabeçalho do evento; a contagem por área, na coluna Área da lista.
 */
const LEITURAS = [
  { chave: "lista", rotulo: "Lista" },
  { chave: "projetos", rotulo: "Peças por projeto" },
  { chave: "totais", rotulo: "Totais por peça" },
  { chave: "individuais", rotulo: "Soltas e fora do catálogo" },
] as const;
type Leitura = (typeof LEITURAS)[number]["chave"];

/** Linha de atalho: ícone + texto, a linha inteira é o link. */
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
  // Cancelado não terá ata, OS nem pedidos: os textos de "ainda vai acontecer" não servem (auditoria 30/10, B-18).
  const cancelado = ev.status === "CANCELADO";
  const editavel = pode(usuario, "ata.consolidar") && (antesDaAta || (ev.status === "ABERTO" && pode(usuario, "ata.ajustar")));
  // Leituras independentes em paralelo. As leituras por peça vêm do estado de agora (ata + o que
  // entrou depois), igual à OS em vigor. Catálogo e áreas só para quem inclui e vincula itens.
  const [totalOs, slugArena, gruposMaterial, opcoes, areasAtivas] = await Promise.all([
    veOs && versoes[0] ? totalPecasOs(id, versoes[0].numero) : 0,
    veArena ? slugArenaDoEvento(id) : null,
    leitura === "lista" ? undefined : mapaGruposPecas(),
    editavel ? opcoesReferenciasResumidas() : null,
    editavel ? listarAreasCache() : Promise.resolve([]),
  ]);
  // As leituras por peça saem das mesmas linhas da lista (a mesma conta de `calcularOsAoVivo`, sem ir de novo ao banco):
  // cada linha da leitura aponta para a linha da ata que a gerou, e admin e logística corrigem dali também.
  const osAgora = leitura === "lista" ? null : calcularOS(linhas);
  const edicaoOs = osAgora && editavel ? montarEdicaoOs({ eventoId: id, linhas, os: osAgora, ataFechada: Boolean(ev.ataFechadaEm), opcoes, podeCadastrar: pode(usuario, "catalogo.gerenciar") }) : undefined;

  const projetos = linhas.filter((l) => l.tipo === "PROJETO");
  // Para fechar a ata contam só as obrigatórias ("a definir" e estaiamento ficam de fora).
  const obrigatorias = linhas.filter((l) => !conferenciaOpcional({ tipo: l.tipo, codigo: l.peca?.codigo, quantidade: l.quantidade }));
  const conferidas = obrigatorias.filter((l) => l.conferidoEm).length;
  const unidades = linhas.reduce((a, l) => a + l.quantidade, 0);
  const nAreas = new Set(linhas.map((l) => l.areaNome ?? "Logística")).size;
  // Quem pediu é assunto da área que pediu: fora dela, a origem aparece sem o código da solicitação nem o nome.
  const podeVerOrigem = (l: (typeof linhas)[number]) => veTodasAsAreas || !l.origemSolicitacaoId || daMinhaArea(usuario, l.registro.areaId);
  // "Pedido de outra área", como na aba Ata e no Excel (antes "Pedido de área"; auditoria 28/10, nº 86).
  const origem = (l: (typeof linhas)[number]) => (podeVerOrigem(l) ? [l.origemLabel, l.origemPor].filter(Boolean).join(" · ") : "Pedido de outra área");
  // Uma edição de projeto conta uma vez (as linhas atualizadas juntas), aqui, em "O que mudou" e na aba Ata (auditoria 30/10, B-20).
  const ajustesPosAta = agruparAtualizacoesDeVersao(separarAjustes(historico, ev.ataFechadaEm).posAta);

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

  const janelaEncerrada = Boolean(ev.janelaAlteracoesAte && ev.janelaAlteracoesAte < hojeISO());
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
              // Janela vencida: o maior número da tela era uma data passada sem dizer o que isso muda (auditoria 28/10, nº 35).
              valor: janelaEncerrada ? "janela encerrada" : ev.janelaAlteracoesAte ? `até ${diaMesISO(ev.janelaAlteracoesAte)}` : "abertas",
              hint: janelaEncerrada
                ? `em ${diaMesISO(ev.janelaAlteracoesAte)} · pedidos ainda entram; a logística decide se atende`
                : mudancas.length + ajustesPosAta.length ? `${mudancas.length + ajustesPosAta.length} ${mudancas.length + ajustesPosAta.length === 1 ? "mudança" : "mudanças"} desde a ata de ${diaMes(ev.ataFechadaEm)}` : `Ata fechada em ${diaMes(ev.ataFechadaEm)}. Nada mudou desde então.`,
              tom: "neutro",
              href: "#mudancas",
            }
          : ev.status === "ENCERRADO"
            ? { rotulo: "Encerrado", valor: "nada falta", hint: "Nada entra mais. O caminhão carrega o que está na OS.", tom: "success" }
            : { rotulo: "Cancelado", valor: "—", hint: ev.canceladoMotivo ?? undefined, tom: "neutro" };

  const atividade = (
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
  );
  const atalhos = (
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
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo: o que falta, quando é, o tamanho do evento e a versão da OS. */}
      <MetricStrip className="mb-0">
        <Metric label={falta.rotulo} valor={falta.valor} hint={falta.hint} tom={falta.tom} href={falta.href} hintInteiro />
        <Metric label="Evento" valor={periodoCurto(ev.dataInicio, ev.dataFim)} hint={contagem(dEvento, "é hoje", "aconteceu")} />
        <Metric label="Itens" valor={<Numero valor={linhas.length} />} hint={`${galeria.length} ${galeria.length === 1 ? "projeto" : "projetos"} · ${unidades.toLocaleString("pt-BR")} un. · ${nAreas} ${nAreas === 1 ? "área" : "áreas"}`} href="#itens" />
        <Metric
          label="Ordem de serviço"
          valor={versoes.length ? <Codigo>v{versoes[0].numero}</Codigo> : "—"}
          hint={versoes.length ? `${veOs ? `${totalOs.toLocaleString("pt-BR")} peças · ` : ""}atualizada ${diaMes(versoes[0].geradaEm)}` : cancelado ? "evento cancelado: sem OS" : "gerada ao fechar a ata"}
          href={veOs ? `/eventos/${id}/os` : undefined}
        />
      </MetricStrip>

      {/* Depois da reunião: o que entrou, mudou ou saiu (pedidos das áreas e ajustes da logística). Três à vista: a lista
          de itens, onde se corrige, vem logo abaixo; o resto abre no "Ver as outras" e no Histórico. */}
      {ev.ataFechadaEm && (
        <MudancasPosAta
          ataFechadaEm={ev.ataFechadaEm}
          mudancas={mudancas.map((m) => ({ ...m, codigoVisivel: veTodasAsAreas || daMinhaArea(usuario, m.areaId) }))}
          ajustes={ajustesPosAta.map(({ h, n }) =>
            h.acao === "ATUALIZACAO_VERSAO"
              ? { id: h.id, titulo: tituloAtualizacao(classificarHistorico(h).titulo, n), rotulo: "Projeto editado na Biblioteca", autor: h.usuario?.nome ?? null, quando: h.criadoEm, href: `/eventos/${id}/itens/${h.entidadeId}` }
              : { id: h.id, titulo: classificarHistorico(h).titulo, autor: h.usuario?.nome ?? null, quando: h.criadoEm, href: `/eventos/${id}/itens/${h.entidadeId}` },
          )}
          hrefOs={veOs && versoes.length > 1 ? `/eventos/${id}/os?base=${versoes[versoes.length - 1].numero}` : null}
          maximo={3}
        />
      )}

      {/* Itens na largura toda: é a tabela de trabalho de admin e logística (antes dividia a tela com a coluna lateral). */}
      <div id="itens" className="alvo-ancora">
        <Section
          titulo="Itens do evento"
          sub={antesDaAta ? (editavel ? "O que as áreas pediram até agora. Corrija aqui ou na conferência." : "O que as áreas pediram até agora. Ajustes acontecem na reunião.") : undefined}
          acoes={editavel && opcoes ? <IncluirItemEvento eventoId={id} ataFechada={Boolean(ev.ataFechadaEm)} opcoes={opcoes} areas={areasAtivas.map((a) => ({ id: a.id, nome: a.nome }))} /> : undefined}
        >
          {linhas.length > 0 && (
            <div className="overflow-x-auto border-b border-line-soft px-cartao py-2.5">
              <Pills rotulo="Como ver os itens" className="max-md:flex-nowrap" itens={LEITURAS.map((l) => ({ label: l.rotulo, ativo: leitura === l.chave, href: l.chave === "lista" ? `/eventos/${id}#itens` : `/eventos/${id}?itens=${l.chave}#itens` }))} />
            </div>
          )}
          {linhas.length === 0 ? (
            <EmptyState compact title={cancelado ? "Nenhum item" : "Nenhum item ainda"} description={cancelado ? "Evento cancelado: não terá ata nem pedidos." : editavel ?"Os pedidos das áreas entram aqui sozinhos. O que for decidido fora de um pedido entra por “Incluir item”." : "Quando as áreas enviarem necessidades, os itens aparecem aqui."} />
          ) : osAgora ? (
            <div className="flex flex-col gap-4 bg-subtle p-3 sm:p-4">
              <OsVisoes os={osAgora} grupos={gruposMaterial} visao={leitura as VisaoOs} semNavegacao titulo="Itens do evento" hrefVisao={(v) => `/eventos/${id}?itens=${v}#itens`} edicao={edicaoOs} />
            </div>
          ) : (
            <ListaItensEvento eventoId={id} linhas={linhas} editavel={editavel} ataFechada={Boolean(ev.ataFechadaEm)} opcoes={opcoes} podeCadastrar={pode(usuario, "catalogo.gerenciar")} origem={origem} quem={(l) => (podeVerOrigem(l) ? (l.origemPor ?? null) : null)} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {galeria.length > 0 ? (
          <Section titulo="Galeria dos projetos" sub="O que vai ser montado. Abra um projeto para ver as peças e quem pediu.">
            <ul className="m-0 grid list-none grid-cols-2 gap-3 px-cartao py-4 sm:grid-cols-3 2xl:grid-cols-4">
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
        ) : (
          atividade
        )}
        <div className="flex flex-col gap-5">
          {galeria.length > 0 && atividade}
          {atalhos}
        </div>
      </div>
    </div>
  );
}
