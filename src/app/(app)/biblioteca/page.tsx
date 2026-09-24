import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarProjetos, obterProjeto, usoProjetosPorEvento } from "@/server/services/projetos";
import { contarPecasEmBom, listarPecas } from "@/server/services/catalogo";
import { listarItensForaDoCatalogo } from "@/server/services/fora-catalogo";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { FilaForaCatalogo } from "@/components/eventos/fila-fora-catalogo";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";
import { cn } from "@/lib/cn";
import { hrefCom, ordenar, paginar, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { ChipMono, Tag } from "@/components/ui/badge";
import { TabsNav } from "@/components/ui/tabs-nav";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { BuscaUrl } from "@/components/ui/busca-url";
import { FiltroEvento } from "@/components/ui/filtro-evento";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import type { EventoStatus } from "@/server/db/schema";
import { ContagemAoVivo } from "@/components/ui/contagem-ao-vivo";
import { CaptionOculta, Paginacao, Th, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { EditarProjetoModal } from "@/components/projetos/editar-projeto-modal";
import { RolarAoSelecionar } from "@/components/biblioteca/rolar-ao-selecionar";
import { PecaAtivoBotao } from "@/components/catalogo/peca-ativo-botao";
import { combinaBusca } from "@/lib/busca";

export const metadata: Metadata = { title: "Biblioteca" };

type SP = { aba?: string; p?: string; q?: string; setor?: string; ordem?: string; dir?: string; pagina?: string; evento?: string };

type Aba = "projetos" | "pecas" | "fora";

/** Abas por query string (`?aba=`) no topo do cartão da tabela, com a contagem de cada seção. */
function Abas({ aba, nProjetos, nPecas, nFora }: { aba: Aba; nProjetos: number; nPecas: number; nFora: number | null }) {
  const itens = [
    { chave: "projetos", label: "Projetos padrão", n: nProjetos, href: "/biblioteca" },
    { chave: "pecas", label: "Catálogo de peças", n: nPecas, href: "/biblioteca?aba=pecas" },
    // Só quem cadastra/vincula vê a fila do que as áreas descreveram à mão.
    ...(nFora == null ? [] : [{ chave: "fora", label: "Fora do catálogo", n: nFora, href: "/biblioteca?aba=fora" }]),
  ];
  return <TabsNav rotulo="Seções da biblioteca" className="mb-0 px-2 pt-1" tabs={itens.map((t) => ({ href: t.href, label: t.label, n: t.n, ativo: aba === t.chave }))} />;
}

/** Seta › da última coluna: a linha abre algo (detalhe do projeto, edição da peça). */
function SetaAbrir({ ativo }: { ativo?: boolean }) {
  return <Icone nome="chevron-direita" className={cn("inline-block align-middle", ativo && "text-accent")} />;
}

const barraCls = "mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center";
const cartaoCls = "overflow-hidden rounded-cartao border border-line bg-surface";

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const podeVincular = pode(usuario, "ata.consolidar");
  const aba: Aba = sp.aba === "pecas" ? "pecas" : sp.aba === "fora" && podeVincular ? "fora" : "projetos";
  const [projetos, pecasTodas, foraCatalogo] = await Promise.all([listarProjetos(usuario), listarPecas(usuario), podeVincular ? listarItensForaDoCatalogo(usuario) : Promise.resolve(null)]);
  const busca = sp.q?.trim().slice(0, 80) || null;
  const termo = (busca ?? "").toLowerCase();

  const acoes =
    aba === "projetos"
      ? pode(usuario, "projeto.gerenciar") && (
          <ButtonLink href="/projetos/novo" variant="primary" size="lg" className="no-underline">
            Novo projeto
          </ButtonLink>
        )
      : pode(usuario, "catalogo.gerenciar") && (
          <ButtonLink href="/catalogo/nova" variant="primary" size="lg" className="no-underline">
            Nova peça
          </ButtonLink>
        );

  const cabecalho = <PageHeader title="Biblioteca" divisor actions={acoes} />;
  const abas = <Abas aba={aba} nProjetos={projetos.length} nPecas={pecasTodas.length} nFora={foraCatalogo ? foraCatalogo.length : null} />;

  // O que está esperando alguém: itens descritos à mão que ainda não somam peças na OS.
  const atalhoFora =
    foraCatalogo && foraCatalogo.length > 0 && aba !== "fora" ? (
      <Link href="/biblioteca?aba=fora" className="inline-flex items-center gap-1.5 text-pequeno font-medium text-warning no-underline hover:underline sm:ml-auto">
        <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full bg-warning" />
        {foraCatalogo.length} {foraCatalogo.length === 1 ? "item fora do catálogo" : "itens fora do catálogo"}
      </Link>
    ) : null;

  if (aba === "fora" && foraCatalogo) {
    const opcoes = await opcoesReferenciasResumidas();
    const encontrados = termo ? foraCatalogo.filter((i) => combinaBusca(`${i.descricao ?? ""} ${i.eventoCodigo} ${i.eventoNome} ${i.area ?? ""} ${i.destino ?? ""} ${i.solicitante ?? ""}`, termo)) : foraCatalogo;
    const pag = paginar(encontrados, sp.pagina, 25);
    const params = { aba: "fora", q: sp.q, pagina: sp.pagina };
    return (
      <>
        {cabecalho}
        {foraCatalogo.length > 0 && (
          <div className={barraCls}>
            <BuscaUrl key="busca-fora" placeholder="Buscar por item, evento ou área" ariaLabel="Buscar item fora do catálogo" />
          </div>
        )}
        <div className={cartaoCls}>
          <ContagemAoVivo oculto n={pag.total} singular="item fora do catálogo" plural="itens fora do catálogo" complemento={busca ? `busca “${busca}”` : null} />
          {abas}
          {foraCatalogo.length > 0 && (
            <p className="m-0 border-b border-line-soft px-cartao py-2.5 text-pequeno text-muted">Itens que as áreas descreveram à mão. Enquanto não viram peça ou projeto do catálogo, não somam peças na OS: a separação é manual. Vincule a algo que já existe ou cadastre a peça.</p>
          )}
          {foraCatalogo.length > 0 && pag.total === 0 ? (
            <EmptyState title={`Nada encontrado para “${busca}”`} description="Confira a descrição ou tente o código do evento." />
          ) : (
            <>
              <FilaForaCatalogo itens={pag.itens} opcoes={opcoes} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
              <Paginacao {...pag} hrefPagina={(n) => hrefCom("/biblioteca", params, { pagina: n === 1 ? null : n })} />
            </>
          )}
        </div>
      </>
    );
  }

  if (aba === "projetos") {
    // Busca e paginação em memória (a lista de projetos já vem inteira do serviço).
    const uso = await usoProjetosPorEvento();
    // Filtro por evento: só os projetos que estão na ata daquele evento, com as unidades pedidas.
    const eventoId = sp.evento?.trim() || null;
    const noEvento = eventoId ? projetos.filter((p) => uso.get(p.id)?.eventos.some((e) => e.id === eventoId)) : projetos;
    const encontrados = termo ? noEvento.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${p.categoria ?? ""} ${p.descricao ?? ""}`, termo)) : noEvento;
    const pag = paginar(encontrados, sp.pagina, 12);
    const params = { q: sp.q, pagina: sp.pagina, evento: sp.evento };
    const selecionado = encontrados.find((p) => p.id === sp.p) ?? pag.itens[0];
    const detalhe = selecionado ? await obterProjeto(usuario, selecionado.id) : null;
    // Eventos para o filtro: os que têm algum projeto na ata, do mais recente para o mais antigo.
    const eventosFiltro = [...new Map([...uso.values()].flatMap((u) => u.eventos).map((e) => [e.id, e])).values()].sort((a, b) => b.dataInicio.localeCompare(a.dataInicio)).map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, n: projetos.filter((p) => uso.get(p.id)?.eventos.some((x) => x.id === e.id)).length }));
    const eventoFiltrado = eventoId ? eventosFiltro.find((e) => e.id === eventoId) : null;
    const atual = detalhe?.versaoAtualObj;
    const anterior = detalhe?.versoes.find((v) => v.numero === (detalhe.versaoAtual ?? 1) - 1);
    const bom = [...(atual?.itens ?? [])].sort((a, b) => SETORES.indexOf(a.peca.setor) - SETORES.indexOf(b.peca.setor) || a.peca.codigo.localeCompare(b.peca.codigo));
    const textoUso = (id: string) => {
      const u = uso.get(id);
      if (eventoId) {
        const q = u?.eventos.find((e) => e.id === eventoId)?.quantidade ?? 0;
        return `${q} ${q === 1 ? "unidade" : "unidades"} no evento`;
      }
      return u ? `em ${u.n} ${u.n === 1 ? "evento" : "eventos"}` : "sem uso";
    };

    return (
      <>
        {cabecalho}
        {(projetos.length > 0 || atalhoFora) && (
          <div className={barraCls}>
            {projetos.length > 0 && <BuscaUrl key="busca-projetos" placeholder="Buscar por código, nome ou categoria" ariaLabel="Buscar projeto padrão" />}
            {eventosFiltro.length > 0 && <FiltroEvento eventos={eventosFiltro} rotuloOculto />}
            {atalhoFora}
          </div>
        )}
        {projetos.length === 0 ? (
          <div className={cartaoCls}>
            {abas}
            <EmptyState title="Nenhum projeto padrão cadastrado" description="A cenografia cadastra os projetos com sua lista de peças." />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
            <div className={cartaoCls}>
              <ContagemAoVivo oculto n={pag.total} singular="projeto padrão" plural="projetos padrão" complemento={[busca ? `busca “${busca}”` : null, eventoFiltrado ? `no evento ${eventoFiltrado.codigo}` : null].filter(Boolean).join(", ") || null} />
              {abas}
              {eventoFiltrado && (
                <p className="m-0 border-b border-line-soft bg-subtle px-cartao py-2 text-pequeno text-ink-2">
                  Projetos na ata de <Codigo>{eventoFiltrado.codigo}</Codigo> {eventoFiltrado.nome}: <Numero valor={noEvento.length} />. A coluna Uso mostra as unidades pedidas neste evento.
                </p>
              )}
              {pag.total === 0 ? (
                <EmptyState title={busca ? `Nada encontrado para “${busca}”` : "Nenhum projeto na ata deste evento"} description={busca ? "Confira o código ou tente outra palavra do nome ou da categoria." : "Quando as solicitações forem atendidas, os projetos aparecem aqui."} />
              ) : (
                <>
                  {/* table-fixed: a tabela acompanha a largura do cartão ao lado do painel; abaixo do mínimo, rola na horizontal. */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] table-fixed border-collapse sm:min-w-[390px] [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
                      <CaptionOculta>Projetos padrão</CaptionOculta>
                      <thead>
                        <tr className="bg-subtle">
                          <Th largura={92} className="hidden sm:table-cell">
                            <span className="sr-only">Foto</span>
                          </Th>
                          <Th className="pl-cartao sm:pl-3">Projeto</Th>
                          <Th largura={120} className="hidden 2xl:table-cell">
                            Categoria
                          </Th>
                          <Th largura={112} alinhar="right" className="hidden xl:table-cell">
                            Uso
                          </Th>
                          <Th largura={44}>
                            <span className="sr-only">Abrir</span>
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {pag.itens.map((p) => {
                          const sel = p.id === selecionado?.id;
                          const n = uso.get(p.id)?.n ?? 0;
                          const marca = sel && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />;
                          return (
                            <LinhaLink key={p.id} href={hrefCom("/biblioteca", params, { p: p.id })} rotulo={`Ver ${p.codigo} — ${p.nome}`} scroll={false} className={cn(sel && "bg-selected")}>
                              <td className="relative hidden border-b border-line-row py-3.5 pl-cartao pr-1 sm:table-cell">
                                {marca}
                                {/* A linha inteira é clicável: aqui a foto é só miniatura; o zoom fica no painel de detalhe. */}
                                {p.capa ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={`/api/anexos/${p.capa.id}?w=320`} alt="" loading="lazy" decoding="async" className="block h-10 w-14 shrink-0 rounded-controle border border-line bg-white object-contain" />
                                ) : (
                                  <span aria-hidden className="grid h-10 w-14 shrink-0 place-items-center rounded-controle border border-dashed border-line-strong text-rotulo text-meta">
                                    sem foto
                                  </span>
                                )}
                              </td>
                              <th scope="row" aria-current={sel ? "true" : undefined} className="relative border-b border-line-row py-3.5 pl-cartao pr-3 text-left font-normal sm:pl-3">
                                {marca && <span className="sm:hidden">{marca}</span>}
                                <span className="flex min-w-[220px] items-start gap-2">
                                  <span className="line-clamp-2 min-w-0 text-corpo font-medium text-ink" title={p.nome}>
                                    {p.nome}
                                  </span>
                                  <ChipMono tom="control" className="shrink-0">
                                    v{p.versaoAtual}
                                  </ChipMono>
                                  {!p.disponivelEmSolicitacoes && (
                                    <Tag tom="muted" className="shrink-0">
                                      fora das solicitações
                                    </Tag>
                                  )}
                                </span>
                                {/* Quantas peças o projeto leva: na própria linha, onde não tem como cortar. */}
                                <span className="mt-0.5 block text-pequeno text-ink-3">
                                  <Codigo>{p.codigo}</Codigo>
                                  {p.categoria && <span className="2xl:hidden"> · {p.categoria}</span>} · <Numero valor={p.tiposPeca} /> {p.tiposPeca === 1 ? "tipo de peça" : "tipos de peça"} · <Numero valor={p.totalPecas} /> {p.totalPecas === 1 ? "peça" : "peças"}
                                  <span className="xl:hidden"> · {textoUso(p.id)}</span>
                                </span>
                                {p.descricao && (
                                  <span className="mt-0.5 block truncate text-pequeno text-muted" title={p.descricao}>
                                    {p.descricao}
                                  </span>
                                )}
                              </th>
                              <td className="hidden truncate border-b border-line-row px-3 py-3.5 text-pequeno text-ink-3 2xl:table-cell" title={p.categoria || undefined}>
                                {p.categoria || "—"}
                              </td>
                              <td className={cn("numero hidden whitespace-nowrap border-b border-line-row px-3 py-3.5 text-right text-pequeno xl:table-cell", n > 0 ? "text-ink-2" : "text-meta")}>{textoUso(p.id)}</td>
                              <td className="border-b border-line-row py-3.5 pl-1 pr-cartao text-right text-ink-3">
                                <SetaAbrir ativo={sel} />
                              </td>
                            </LinhaLink>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Paginacao {...pag} hrefPagina={(n) => hrefCom("/biblioteca", params, { pagina: n === 1 ? null : n, p: sp.p })} />
                </>
              )}
            </div>

            {detalhe && atual && (
              <div id="detalhe" className="alvo-ancora lg:sticky lg:top-topo-fixo">
                <RolarAoSelecionar alvoId="detalhe" selecionado={sp.p} />
                <Section
                  titulo={detalhe.nome}
                  sub={
                    <>
                      <Codigo>{detalhe.codigo}</Codigo> · <Codigo>v{detalhe.versaoAtual}</Codigo> · <Numero valor={bom.reduce((a, i) => a + i.quantidade, 0)} /> unidades por projeto
                    </>
                  }
                  acoes={
                    <span className="flex items-center gap-3">
                      {pode(usuario, "projeto.gerenciar") && (
                        <EditarProjetoModal
                          projeto={{ id: detalhe.id, nome: detalhe.nome, categoria: detalhe.categoria, descricao: detalhe.descricao, versaoAtual: detalhe.versaoAtual, disponivelEmSolicitacoes: detalhe.disponivelEmSolicitacoes, itens: bom.map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade })) }}
                          anexos={detalhe.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))}
                          categorias={[...new Set(projetos.map((x) => x.categoria).filter(Boolean))]}
                        />
                      )}
                      {pode(usuario, "projeto.gerenciar") && (
                        <Link href={`/projetos/novo?de=${detalhe.id}`} className="link text-pequeno">
                          Duplicar
                        </Link>
                      )}
                      <Link href={`/projetos/${detalhe.id}`} className="link text-pequeno">
                        Abrir
                      </Link>
                    </span>
                  }
                >
                  {(uso.get(detalhe.id)?.eventos.length ?? 0) > 0 && (
                    <div className="border-b border-line-soft px-cartao py-2.5 text-pequeno">
                      <span className="text-muted">Em uso em: </span>
                      {uso.get(detalhe.id)!.eventos.map((e, i) => (
                        <span key={e.id}>
                          {i > 0 && <span className="text-meta"> · </span>}
                          <Link href={`/eventos/${e.id}/ata`} className="link" title={`${e.nome} · ${EVENTO_STATUS_LABEL[e.status as EventoStatus]}`}>
                            <Codigo>{e.codigo}</Codigo> {e.nome}
                          </Link>
                          <span className="text-muted"> (<Numero valor={e.quantidade} />)</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {detalhe.anexos.some((a) => a.tipo === "IMAGEM") && (
                    <div className="flex gap-2 overflow-x-auto border-b border-line-soft px-cartao py-3">
                      {detalhe.anexos
                        .filter((a) => a.tipo === "IMAGEM")
                        .map((a) => (
                          <ImagemZoom key={a.id} src={`/api/anexos/${a.id}`} alt={a.nomeArquivo} legenda={`${detalhe.nome} · ${a.nomeArquivo}`} className="h-[84px] w-28 shrink-0 overflow-hidden rounded-controle border border-line" />
                        ))}
                    </div>
                  )}
                  {bom.length > 0 ? (
                    <>
                    {/* Cabeçalho visual das colunas (a lista em si é lida item a item). */}
                    <div aria-hidden className="flex items-center gap-2.5 border-b border-line-soft bg-subtle px-cartao py-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                      <span className="w-[86px] shrink-0">Código</span>
                      <span className="flex-1">Peça</span>
                      <span>Qtd.</span>
                    </div>
                    <ul aria-label={`Lista de peças de ${detalhe.nome}`} className="m-0 list-none p-0">
                      {bom.map((i) => {
                        const novo = anterior && !anterior.itens.some((x) => x.pecaId === i.pecaId);
                        return (
                          <li key={i.id} className="flex items-baseline gap-2.5 border-b border-line-faint px-cartao py-2 last:border-b-0">
                            <Codigo className="w-[86px] shrink-0 truncate text-pequeno text-ink-2">{i.peca.codigo}</Codigo>
                            <span className="min-w-0 flex-1 text-pequeno text-ink">
                              {i.peca.nome}
                              {novo && (
                                <Tag tom="info" className="ml-1.5">
                                  novo na v{detalhe.versaoAtual}
                                </Tag>
                              )}
                            </span>
                            <Numero valor={i.quantidade} className="shrink-0 text-right text-pequeno font-semibold text-ink" />
                          </li>
                        );
                      })}
                    </ul>
                    </>
                  ) : (
                    <EmptyState compact title="Nenhuma peça nesta versão" description="Abra o projeto para montar a lista de peças." />
                  )}
                  {(detalhe.versaoAtual > 1 || detalhe.usosDefasados.length > 0) && (
                    <p className="m-0 border-t border-line-soft bg-subtle px-cartao py-3 text-pequeno text-ink-3">
                      {detalhe.versaoAtual > 1 && atual.observacao ? `A v${detalhe.versaoAtual}: ${atual.observacao} ` : ""}
                      {detalhe.versaoAtual > 1 ? `Eventos que ainda usam versões anteriores aparecem marcados na ata.` : ""}
                      {detalhe.usosDefasados.length > 0 && <span className="mt-1 block text-warning">Em versão anterior: {detalhe.usosDefasados.map((u) => `${u.codigo} (v${u.versao})`).join(", ")}.</span>}
                    </p>
                  )}
                </Section>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // Catálogo de peças
  const emBom = await contarPecasEmBom();
  const gerencia = pode(usuario, "catalogo.gerenciar");
  // Quem gerencia o catálogo vê também as peças inativas (marcadas), para poder reativá-las.
  const pecasLista = gerencia ? await listarPecas(usuario, { incluirInativas: true }) : pecasTodas;
  const setor = (SETORES as readonly string[]).includes(sp.setor ?? "") ? (sp.setor as Setor) : null;
  const buscadas = termo ? pecasLista.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${p.familia}`, termo)) : pecasLista;
  const filtradas = setor ? buscadas.filter((p) => p.setor === setor) : buscadas;
  const ordenadas = ordenar(
    filtradas,
    { codigo: (p) => p.codigo, nome: (p) => p.nome.toLowerCase(), setor: (p) => SETORES.indexOf(p.setor), familia: (p) => (p.familia ?? "").toLowerCase(), estoque: (p) => p.estoqueProprio, bom: (p) => emBom.get(p.id) ?? 0 },
    sp.ordem,
    sp.dir,
  );
  const pag = paginar(ordenadas, sp.pagina, 12);
  const params = { aba: "pecas", q: sp.q, setor: sp.setor, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina };
  const th = (chave: string, label: string, largura?: number, alinhar?: "left" | "right") => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return <ThOrdenavel label={label} ativo={sp.ordem === chave} dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined} href={hrefCom("/biblioteca", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })} largura={largura} alinhar={alinhar} />;
  };

  const celulas = (p: (typeof pag.itens)[number]) => (
    <>
      <td className="border-b border-line-row px-3 py-3 text-pequeno font-medium text-ink">
        <Codigo>{p.codigo}</Codigo>
      </td>
      <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
        <span className="flex min-w-[220px] flex-wrap items-center gap-x-2 gap-y-1">
          <span className="line-clamp-2 text-corpo font-medium text-ink" title={p.nome}>
            {p.nome}
          </span>
          {!p.permiteEmProjeto && <Tag tom="muted">só fora de projeto</Tag>}
          {!p.disponivelEmSolicitacoes && <Tag tom="muted">fora das solicitações</Tag>}
          {!p.ativo && <Tag tom="warning">inativa</Tag>}
        </span>
        <span className="mt-0.5 block text-pequeno text-muted xl:hidden">
          {SETOR_LABEL[p.setor]} · {p.familia || "sem família"}
        </span>
      </th>
      <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 xl:table-cell">{SETOR_LABEL[p.setor]}</td>
      <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-3 xl:table-cell">
        <span className="line-clamp-2" title={p.familia || undefined}>
          {p.familia || "—"}
        </span>
      </td>
      <td className="whitespace-nowrap border-b border-line-row px-3 py-3 text-right text-pequeno text-ink">
        {p.estoqueProprio > 0 ? <Numero valor={p.estoqueProprio} unidade={p.unidade} /> : <span className="numero text-meta">—</span>}
      </td>
      {/* px-3 também na última coluna: alinha com o cabeçalho ordenável. */}
      <td className="border-b border-line-row px-3 py-3 text-right text-pequeno text-ink-3">
        <Numero valor={emBom.get(p.id) ?? 0} />
      </td>
      {gerencia && (
        <td className="whitespace-nowrap border-b border-line-row py-1.5 pl-1 pr-cartao text-right text-ink-3">
          <span className="inline-flex items-center justify-end gap-1">
            <PecaAtivoBotao id={p.id} ativo={p.ativo} nome={`${p.codigo} · ${p.nome}`} size="xs" />
            <SetaAbrir />
          </span>
        </td>
      )}
    </>
  );

  const vazio: [string, string] = busca
    ? [`Nada encontrado para “${busca}”`, setor ? "Confira o termo ou volte para todos os setores." : "Confira o código ou tente outra palavra do nome ou da família."]
    : setor
      ? [`Nenhuma peça em ${SETOR_LABEL[setor]}`, "Escolha outro setor ou volte para todos."]
      : ["Nenhuma peça cadastrada", "O catálogo mestre reúne as peças usadas nos projetos e nas OS."];

  return (
    <>
      {cabecalho}
      <div className={barraCls}>
        <BuscaUrl key="busca-pecas" placeholder="Buscar por código, nome ou família" ariaLabel="Buscar peça do catálogo" />
        <Pills
          rotulo="Filtrar por setor"
          itens={[
            { label: "Todos", n: buscadas.length, href: hrefCom("/biblioteca", params, { setor: null, pagina: null }), ativo: !setor },
            ...SETORES.map((s) => ({ label: SETOR_LABEL[s], n: buscadas.filter((p) => p.setor === s).length, href: hrefCom("/biblioteca", params, { setor: s, pagina: null }), ativo: setor === s })),
          ]}
        />
        {atalhoFora}
      </div>
      <div className={cartaoCls}>
        <ContagemAoVivo oculto n={pag.total} singular="peça" plural="peças" complemento={[setor ? SETOR_LABEL[setor] : null, busca ? `busca “${busca}”` : null].filter(Boolean).join(" · ")} />
        {abas}
        {pag.total === 0 ? (
          <EmptyState title={vazio[0]} description={vazio[1]} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <CaptionOculta>Catálogo de peças</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    {th("codigo", "Código", 120)}
                    {th("nome", "Peça")}
                    <Th className="hidden xl:table-cell" largura={150}>
                      Setor
                    </Th>
                    <Th className="hidden xl:table-cell" largura={130}>
                      Família
                    </Th>
                    {th("estoque", "Estoque", 100, "right")}
                    {th("bom", "Em projetos", 118, "right")}
                    {gerencia && (
                      <Th largura={120}>
                        <span className="sr-only">Inativar, reativar ou editar</span>
                      </Th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pag.itens.map((p) =>
                    gerencia ? (
                      <LinhaLink key={p.id} href={`/catalogo/${p.id}/editar`} rotulo={`Editar ${p.codigo} — ${p.nome}`}>
                        {celulas(p)}
                      </LinhaLink>
                    ) : (
                      <tr key={p.id} className="hover:bg-subtle">
                        {celulas(p)}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <Paginacao {...pag} hrefPagina={(n) => hrefCom("/biblioteca", params, { pagina: n === 1 ? null : n })} />
          </>
        )}
      </div>
    </>
  );
}
