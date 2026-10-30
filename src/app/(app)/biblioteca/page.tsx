import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarGruposComUso, listarGruposProjetos, listarProjetos, obterProjeto, usoProjetosPorEvento } from "@/server/services/projetos";
import { GerenciarGrupos } from "@/components/projetos/gerenciar-grupos";
import { contarPecasEmBom, listarPecas } from "@/server/services/catalogo";
import { listarItensForaDoCatalogo } from "@/server/services/fora-catalogo";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { FilaForaCatalogo } from "@/components/eventos/fila-fora-catalogo";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";
import { cn } from "@/lib/cn";
import { hrefCom, hrefPeca, ordenar, paginar, proximaOrdem } from "@/lib/url";
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
import { combinaBusca, normalizarBusca } from "@/lib/busca";
import { BarraSelecaoLote, CheckboxSelecaoLote, CheckboxSelecionarPagina, SelecaoEmLote } from "@/components/biblioteca/selecao-em-lote";
import { FiltroGrupoProjeto } from "@/components/projetos/filtro-grupo-projeto";
import { FiltroAlteracao, FiltroSituacao } from "@/components/biblioteca/filtros-biblioteca";
import { dentroDoFiltroAlteracao, lerFiltroAlteracao } from "@/lib/filtro-alteracao";
import { formatarDataHora, formatarDia } from "@/lib/format";

export const metadata: Metadata = { title: "Biblioteca" };

type SP = { aba?: string; p?: string; q?: string; setor?: string; ordem?: string; dir?: string; pagina?: string; evento?: string; grupo?: string; alterado?: string; alteradoDe?: string; alteradoAte?: string; situacao?: string };

type Situacao = "ativos" | "inativos" | null;
/** Quem gerencia vê só os ativos por padrão; "todos" mostra ativos e inativos. Os demais só recebem ativos do serviço. */
const lerSituacao = (v: string | undefined, gerencia: boolean): Situacao => (!gerencia || v === "todos" ? null : v === "inativos" ? "inativos" : "ativos");
/** A situação saiu do padrão (só ativos)? */
const situacaoAlterada = (v: string | undefined, gerencia: boolean) => gerencia && (v === "todos" || v === "inativos");
const naSituacao = (ativo: boolean, s: Situacao) => !s || (s === "ativos") === ativo;

type Aba = "projetos" | "pecas" | "fora";

/** Abas por query string (`?aba=`) no topo do cartão da tabela, com a contagem de cada seção. */
function Abas({ aba, nProjetos, nPecas, nFora }: { aba: Aba; nProjetos: number; nPecas: number; nFora: number | null }) {
  const itens = [
    { chave: "projetos", label: "Projetos", n: nProjetos, href: "/biblioteca" },
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

// Celular: grade de 2 colunas (busca e evento na linha toda, listas curtas aos pares), como em /solicitacoes; antes era
// um filtro por linha, 6 linhas antes da lista (auditoria 28/10, nº 41).
const barraCls = "mb-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center";
const cartaoCls = "overflow-hidden rounded-cartao border border-line bg-surface";

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const podeVincular = pode(usuario, "ata.consolidar");
  const aba: Aba = sp.aba === "pecas" ? "pecas" : sp.aba === "fora" && podeVincular ? "fora" : "projetos";
  const [projetos, pecasTodas, foraCatalogo, gruposProjeto] = await Promise.all([listarProjetos(usuario, { incluirInativos: pode(usuario, "projeto.gerenciar") }), listarPecas(usuario), podeVincular ? listarItensForaDoCatalogo(usuario) : Promise.resolve(null), listarGruposProjetos(usuario)]);
  const busca = sp.q?.trim().slice(0, 80) || null;
  const termo = (busca ?? "").toLowerCase();
  const alteracao = lerFiltroAlteracao(sp);
  // Filtros de data/situação: mesmos parâmetros nas duas abas; a chave remonta o campo quando a URL muda por um link.
  const filtrosExtra = { alterado: sp.alterado, alteradoDe: sp.alteradoDe, alteradoAte: sp.alteradoAte, situacao: sp.situacao };
  const chaveAlteracao = [sp.alterado ?? "", sp.alteradoDe ?? "", sp.alteradoAte ?? ""].join("|");
  const limparExtras = { alterado: null, alteradoDe: null, alteradoAte: null, situacao: null };
  // A lista como está agora: a página da peça volta para cá ao salvar ou cancelar.
  const voltaAqui = hrefCom("/biblioteca", sp as Record<string, string | undefined>);

  const acoes =
    aba === "projetos"
      ? pode(usuario, "projeto.gerenciar") && (
          <ButtonLink href="/projetos/novo" variant="primary" size="lg" className="no-underline">
            Novo projeto
          </ButtonLink>
        )
      : pode(usuario, "catalogo.gerenciar") && (
          <ButtonLink href={hrefPeca("/catalogo/nova", voltaAqui)} variant="primary" size="lg" className="no-underline">
            Nova peça
          </ButtonLink>
        );

  const cabecalho = <PageHeader title="Biblioteca" divisor actions={acoes} />;
  // A aba aberta conta o que a lista mostra (busca e filtros); as outras, o que se vê ao clicar nelas. Antes a aba
  // dizia "435" e a lista "Nada encontrado" (auditoria 28/10, nº 57).
  const abasCom = (n: { projetos?: number; pecas?: number; fora?: number } = {}) => <Abas aba={aba} nProjetos={n.projetos ?? projetos.filter((p) => p.ativo).length} nPecas={n.pecas ?? pecasTodas.length} nFora={foraCatalogo ? (n.fora ?? foraCatalogo.length) : null} />;

  // O que está esperando alguém: itens descritos à mão que ainda não somam peças na OS.
  // Quem não vê a aba "Fora do catálogo" não precisa do atalho; quem vê já tem a contagem nela.
  const atalhoFora =
    foraCatalogo && foraCatalogo.length > 0 && aba !== "fora" && !podeVincular ? (
      <Link href="/biblioteca?aba=fora" className="col-span-2 inline-flex items-center gap-1.5 text-pequeno font-medium text-warning no-underline hover:underline max-md:min-h-10 sm:ml-auto">
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
            <BuscaUrl largura={320} key="busca-fora" placeholder="Buscar por item, evento ou área" ariaLabel="Buscar item fora do catálogo" className="col-span-2" />
          </div>
        )}
        <div className={cartaoCls}>
          <ContagemAoVivo oculto n={pag.total} singular="item fora do catálogo" plural="itens fora do catálogo" complemento={busca ? `busca “${busca}”` : null} />
          {abasCom({ fora: pag.total })}
          {foraCatalogo.length > 0 && (
            <p className="m-0 border-b border-line-soft px-cartao py-2.5 text-pequeno text-muted">Itens que as áreas descreveram à mão. Enquanto não viram peça ou projeto do catálogo, não somam peças na OS: a separação é manual. Vincule a algo que já existe ou cadastre a peça.</p>
          )}
          {foraCatalogo.length > 0 && pag.total === 0 ? (
            <EmptyState icone="busca" title={`Nada encontrado para “${busca}”`} description="Confira a descrição ou tente o código do evento." action={<Link href={hrefCom("/biblioteca", params, { q: null, pagina: null })} className="link text-corpo">Limpar busca</Link>} />
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
    const grupoId = sp.grupo?.trim() || null;
    const situacao = lerSituacao(sp.situacao, pode(usuario, "projeto.gerenciar"));
    const filtrados = projetos.filter((p) => naSituacao(p.ativo, situacao) && dentroDoFiltroAlteracao(p.atualizadoEm, alteracao));
    const ordenadosAlteracao = alteracao?.recentesPrimeiro ? [...filtrados].sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime()) : filtrados;
    const noGrupo = grupoId === "padrao" ? ordenadosAlteracao.filter((p) => !p.grupoId) : grupoId ? ordenadosAlteracao.filter((p) => p.grupoId === grupoId) : ordenadosAlteracao;
    const noEvento = eventoId ? noGrupo.filter((p) => uso.get(p.id)?.eventos.some((e) => e.id === eventoId)) : noGrupo;
    // Com busca, o nome (ou código) exato vem primeiro e é ele que abre no painel; sem exato, o painel só abre com um
    // resultado ou com o clique. Antes abria o 1º em ordem alfabética e a pessoa duplicou o projeto errado (nº 40).
    const alvoExato = busca ? normalizarBusca(busca).trim() : "";
    const ehExato = (p: { nome: string; codigo: string }) => Boolean(alvoExato) && (normalizarBusca(p.nome).trim() === alvoExato || normalizarBusca(p.codigo).trim() === alvoExato);
    const combinam = termo ? noEvento.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${p.categoria ?? ""} ${p.descricao ?? ""} ${p.grupo?.nome ?? ""}`, termo)) : noEvento;
    const encontrados = alvoExato ? [...combinam.filter(ehExato), ...combinam.filter((p) => !ehExato(p))] : combinam;
    const semProjetoNoGrupo = Boolean(grupoId && noGrupo.length === 0);
    const semProjetoNoEvento = Boolean(eventoId && noGrupo.length > 0 && noEvento.length === 0);
    const filtroExtraAtivo = Boolean(alteracao || situacaoAlterada(sp.situacao, pode(usuario, "projeto.gerenciar")));
    // Lista vazia só porque o padrão esconde os inativos: oferecer vê-los em vez de "limpar".
    const soInativosOcultos = !busca && !filtroExtraAtivo && situacao === "ativos" && noEvento.length === 0 && projetos.length > 0 && !semProjetoNoGrupo && !semProjetoNoEvento;
    const pag = paginar(encontrados, sp.pagina, 12);
    const params = { q: sp.q, pagina: sp.pagina, evento: sp.evento, grupo: sp.grupo, ...filtrosExtra };
    const selecionado = encontrados.find((p) => p.id === sp.p) ?? (busca ? (encontrados.find(ehExato) ?? (encontrados.length === 1 ? encontrados[0] : undefined)) : pag.itens[0]);
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
            {projetos.length > 0 && <BuscaUrl largura={360} key="busca-projetos" placeholder="Buscar por código, nome ou categoria" ariaLabel="Buscar projeto padrão" className="col-span-2" />}
            {/* Evento com largura fixa: fluido, "Todos os eventos" esticava 1.040 px numa linha só (nº 41). */}
            {eventosFiltro.length > 0 && <FiltroEvento eventos={eventosFiltro} rotuloOculto className="col-span-2" />}
            {projetos.length > 0 && <FiltroGrupoProjeto grupos={gruposProjeto} className={pode(usuario, "projeto.gerenciar") ? undefined : "col-span-2"} />}
            {projetos.length > 0 && pode(usuario, "projeto.gerenciar") && <FiltroSituacao />}
            {projetos.length > 0 && <FiltroAlteracao key={chaveAlteracao} className={pode(usuario, "projeto.gerenciar") ? undefined : "col-span-2"} />}
            {pode(usuario, "projeto.gerenciar") && <GerenciarGrupos grupos={await listarGruposComUso(usuario)} />}
            {atalhoFora}
          </div>
        )}
        {projetos.length === 0 ? (
          <div className={cartaoCls}>
            {abasCom()}
            <EmptyState title="Nenhum projeto padrão cadastrado" description="A cenografia cadastra os projetos com sua lista de peças." />
          </div>
        ) : (
          // Sem painel (busca sem resultado ou sem exato), a lista ocupa a largura toda: antes sobravam 350 px vazios (nº 125).
          <div className={cn("grid grid-cols-1 gap-5 lg:items-start", detalhe && "lg:grid-cols-[minmax(0,1fr)_330px]")}>
            <div className={cartaoCls}>
              <SelecaoEmLote
                key={JSON.stringify(["projetos", sp.q ?? "", sp.evento ?? "", sp.grupo ?? "", chaveAlteracao, sp.situacao ?? "", sp.pagina ?? "", pag.itens.map((p) => p.id)])}
                tipo="projetos"
                modoReativar={situacao === "inativos"}
                gerencia={pode(usuario, "projeto.gerenciar")}
                organizacao={{ grupos: gruposProjeto, categorias: [...new Set(projetos.map((x) => x.categoria).filter(Boolean))] }}
                itens={pag.itens.map((p) => ({ id: p.id, nome: p.nome, ativo: p.ativo }))}
              >
              <ContagemAoVivo oculto n={pag.total} singular="projeto" plural="projetos" complemento={[busca ? `busca “${busca}”` : null, eventoFiltrado ? `no evento ${eventoFiltrado.codigo}` : null, grupoId === "padrao" ? "grupo Padrão" : gruposProjeto.find((g) => g.id === grupoId)?.nome ? `grupo ${gruposProjeto.find((g) => g.id === grupoId)!.nome}` : null, alteracao?.descricao ?? null, situacao === "inativos" ? "só inativos" : pode(usuario, "projeto.gerenciar") && !situacao ? "ativos e inativos" : null].filter(Boolean).join(", ") || null} />
              {abasCom({ projetos: pag.total })}
              {pag.total > 0 && <BarraSelecaoLote gerencia={pode(usuario, "projeto.gerenciar")} />}
              {eventoFiltrado && (
                <p className="m-0 border-b border-line-soft bg-subtle px-cartao py-2 text-pequeno text-ink-2">
                  Projetos na ata de <Codigo>{eventoFiltrado.codigo}</Codigo> {eventoFiltrado.nome}: <Numero valor={noEvento.length} />. A coluna Uso mostra as unidades pedidas neste evento.
                </p>
              )}
              {pag.total === 0 ? (
                <EmptyState title={busca ? `Nada encontrado para “${busca}”` : semProjetoNoGrupo ? "Nenhum projeto neste grupo" : semProjetoNoEvento ? "Nenhum projeto na ata deste evento" : alteracao ? `Nenhum projeto ${alteracao.descricao.replace(/^alterados/, "alterado")}` : soInativosOcultos ? "Nenhum projeto ativo" : "Nenhum projeto encontrado"} description={busca ? "Confira o código, nome, categoria ou grupo." : alteracao && !semProjetoNoGrupo && !semProjetoNoEvento ? "Escolha outro período de alteração ou volte para qualquer data." : semProjetoNoGrupo ? "Escolha outro grupo ou volte para todos. Os grupos são independentes dos eventos e continuam disponíveis mesmo sem projetos associados." : semProjetoNoEvento ? "Quando as solicitações forem atendidas, os projetos aparecem aqui." : "Ajuste os filtros para encontrar projetos."} icone={busca ? "busca" : undefined} action={soInativosOcultos ? <Link href={hrefCom("/biblioteca", params, { situacao: "todos", pagina: null, p: null })} className="link text-corpo">Ver também os inativos</Link> : busca || grupoId || filtroExtraAtivo ? <Link href={hrefCom("/biblioteca", params, { q: null, grupo: null, pagina: null, p: null, ...limparExtras })} className="link text-corpo">Limpar filtros</Link> : undefined} />
              ) : (
                <>
                  {/* table-fixed: a tabela acompanha a largura do cartão ao lado do painel; abaixo do mínimo, rola na horizontal. */}
                  <div className="overflow-x-auto">
                    <table data-responsiva className="w-full min-w-[300px] table-fixed border-collapse sm:min-w-[390px] [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
                      <CaptionOculta>Projetos padrão</CaptionOculta>
                      <thead>
                        <tr className="bg-subtle">
                          {pode(usuario, "projeto.gerenciar") && (
                            <Th largura={44} className="px-2">
                              <CheckboxSelecionarPagina />
                            </Th>
                          )}
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
                              {pode(usuario, "projeto.gerenciar") && (
                                <td className="border-b border-line-row px-2 py-3.5 text-center">
                                  <CheckboxSelecaoLote id={p.id} nome={p.nome} ativo={p.ativo} />
                                </td>
                              )}
                              <td className="relative hidden border-b border-line-row py-3.5 pl-cartao pr-1 sm:table-cell">
                                {marca}
                                {/* A linha inteira é clicável: aqui a foto é só miniatura; o zoom fica no painel de detalhe. */}
                                {/* Sem foto, o espaço fica vazio (antes, a mesma caixa cinza com ícone em quase toda linha). */}
                                {p.capa && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={`/api/anexos/${p.capa.id}?w=320`} alt="" loading="lazy" decoding="async" className="block h-10 w-14 shrink-0 rounded-controle border border-line bg-white object-contain" />
                                )}
                              </td>
                              <th scope="row" aria-current={sel ? "true" : undefined} className="relative border-b border-line-row py-3.5 pl-cartao pr-3 text-left font-normal sm:pl-3">
                                {marca && <span className="sm:hidden">{marca}</span>}
                                {/* Selo só do que foge do comum: grupo que não é o Padrão e versão depois da 1ª. A descrição
                                    (antes uma 3ª linha cortada) e a data da última alteração ficam no title e no painel ao lado. */}
                                <span className="flex min-w-[220px] flex-wrap items-start gap-2">
                                  <span className="line-clamp-2 min-w-0 text-corpo font-medium text-ink" title={[p.nome, p.descricao, `alterado em ${formatarDataHora(p.atualizadoEm)}`].filter(Boolean).join(" — ")}>
                                    {p.nome}
                                  </span>
                                  {p.grupo && <Tag tom="info" className="shrink-0">{p.grupo.nome}</Tag>}
                                  {p.versaoAtual > 1 && (
                                    <ChipMono tom="control" className="shrink-0">
                                      v{p.versaoAtual}
                                    </ChipMono>
                                  )}
                                  {!p.ativo && <Tag tom="warning" className="shrink-0">inativo</Tag>}
                                  {!p.disponivelEmSolicitacoes && (
                                    <Tag tom="muted" className="shrink-0">
                                      fora das solicitações
                                    </Tag>
                                  )}
                                </span>
                                {/* Quantas peças o projeto leva: na própria linha, onde não tem como cortar. */}
                                <span className="mt-0.5 block text-pequeno text-ink-3">
                                  <Codigo>{p.codigo}</Codigo>
                                  {p.categoria && <span className="2xl:hidden"> · {p.categoria}</span>} · <Numero valor={p.totalPecas} /> {p.totalPecas === 1 ? "peça" : "peças"}
                                  <span className="xl:hidden"> · {textoUso(p.id)}</span>
                                </span>
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
              </SelecaoEmLote>
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
                          projeto={{ id: detalhe.id, nome: detalhe.nome, categoria: detalhe.categoria, descricao: detalhe.descricao, grupoEvento: detalhe.grupo?.nome ?? null, versaoAtual: detalhe.versaoAtual, disponivelEmSolicitacoes: detalhe.disponivelEmSolicitacoes, itens: bom.map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade, codigo: i.peca.codigo, nome: i.peca.nome })) }}
                          anexos={detalhe.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))}
                          categorias={[...new Set(projetos.map((x) => x.categoria).filter(Boolean))]}
                          grupos={gruposProjeto}
                          usos={(uso.get(detalhe.id)?.eventos ?? []).map((e) => ({ codigo: e.codigo, status: e.status }))}
                        />
                      )}
                      {pode(usuario, "projeto.gerenciar") && (
                        <Link href={`/projetos/novo?de=${detalhe.id}`} className="link text-pequeno max-md:inline-flex max-md:min-h-10 max-md:items-center">
                          Duplicar
                        </Link>
                      )}
                      <Link href={`/projetos/${detalhe.id}`} className="link text-pequeno max-md:inline-flex max-md:min-h-10 max-md:items-center">
                        Abrir
                      </Link>
                    </span>
                  }
                >
                  <div className="border-b border-line-soft px-cartao py-2.5 text-pequeno">
                    <span className="text-muted">Grupo da biblioteca: </span>
                    <Tag tom={detalhe.grupo ? "info" : "muted"}>{detalhe.grupo?.nome ?? "Padrão"}</Tag>
                    <span className="mt-1 block text-ink-3">
                      <span className="text-muted">Última alteração: </span>
                      {formatarDataHora(detalhe.atualizadoEm)}
                    </span>
                  </div>
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
                      {/* O texto dizia "aparecem marcados na ata", mas salvar a versão nova já atualiza os eventos (parte C N2). */}
                      {detalhe.versaoAtual > 1 ? `A versão nova vale nos eventos que usam o projeto; fica na anterior só onde a logística ajustou peças uma a uma.` : ""}
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
  const buscadas = termo ? pecasLista.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${p.familia} ${p.prova ?? ""}`, termo)) : pecasLista;
  const situacaoPecas = lerSituacao(sp.situacao, gerencia);
  const noSetor = setor ? buscadas.filter((p) => p.setor === setor) : buscadas;
  const filtradas = noSetor.filter((p) => naSituacao(p.ativo, situacaoPecas) && dentroDoFiltroAlteracao(p.atualizadoEm, alteracao));
  // Pílulas de setor contam já com data e situação aplicadas.
  const paraContagem = buscadas.filter((p) => naSituacao(p.ativo, situacaoPecas) && dentroDoFiltroAlteracao(p.atualizadoEm, alteracao));
  const extraPecas = Boolean(alteracao || situacaoAlterada(sp.situacao, gerencia));
  const inativasOcultas = !busca && !extraPecas && situacaoPecas === "ativos" && noSetor.length > 0 && filtradas.length === 0;
  const ordenadas = ordenar(
    filtradas,
    { codigo: (p) => p.codigo, nome: (p) => p.nome.toLowerCase(), setor: (p) => SETORES.indexOf(p.setor), familia: (p) => (p.familia ?? "").toLowerCase(), estoque: (p) => p.estoqueProprio, bom: (p) => emBom.get(p.id) ?? 0, alterado: (p) => new Date(p.atualizadoEm).getTime() },
    sp.ordem ?? (alteracao?.recentesPrimeiro ? "alterado" : undefined),
    sp.ordem ? sp.dir : "desc",
  );
  const pag = paginar(ordenadas, sp.pagina, 12);
  const temEstoque = pecasLista.some((p) => p.estoqueProprio > 0);
  const params = { aba: "pecas", q: sp.q, setor: sp.setor, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina, ...filtrosExtra };
  const th = (chave: string, label: string, largura?: number, alinhar?: "left" | "right", className?: string) => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return <ThOrdenavel label={label} ativo={sp.ordem === chave} dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined} href={hrefCom("/biblioteca", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })} largura={largura} alinhar={alinhar} className={className} />;
  };

  const algumaFoto = pag.itens.some((p) => p.capaFotoId);
  const celulas = (p: (typeof pag.itens)[number]) => (
    <>
      {gerencia && (
        <td className="border-b border-line-row px-2 py-3 text-center">
          <CheckboxSelecaoLote id={p.id} nome={`${p.codigo} · ${p.nome}`} ativo={p.ativo} />
        </td>
      )}
      <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-3 sm:table-cell">
        <Codigo>{p.codigo}</Codigo>
      </td>
      <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
        <span className="flex items-center gap-3">
        {/* Capa (primeira foto): miniatura de 160 px. Sem foto, espaço vazio só se alguma linha da página tem foto
            (para alinhar); antes era um quadro tracejado em quase toda linha. */}
        {p.capaFotoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/pecas/anexos/${p.capaFotoId}?w=160`} alt="" loading="lazy" decoding="async" className="size-11 shrink-0 rounded-controle border border-line bg-white object-cover" />
        ) : (
          algumaFoto && <span aria-hidden className="hidden size-11 shrink-0 sm:block" />
        )}
        <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:min-w-[220px]">
          <Codigo className="text-rotulo text-ink-3 sm:hidden">{p.codigo}</Codigo>
          <span className="line-clamp-2 text-corpo font-medium text-ink" title={p.nome}>
            {p.nome}
          </span>
          {p.prova && <Tag tom="info">prova: {p.prova}</Tag>}
          {p.nPdfs > 0 && <Tag tom="muted">{p.nPdfs === 1 ? "PDF" : `${p.nPdfs} PDFs`}</Tag>}
          {!p.permiteEmProjeto && <Tag tom="muted">só fora de projeto</Tag>}
          {!p.disponivelEmSolicitacoes && <Tag tom="muted">fora das solicitações</Tag>}
          {!p.ativo && <Tag tom="warning">inativa</Tag>}
        </span>
        <span className="mt-0.5 block text-pequeno text-muted xl:hidden">
          {SETOR_LABEL[p.setor]} · {p.familia || "sem família"}
          <span className="numero sm:hidden"> · em {emBom.get(p.id) ?? 0} {(emBom.get(p.id) ?? 0) === 1 ? "projeto" : "projetos"}</span>
          <span className="lg:hidden"> · alterada em {formatarDia(p.atualizadoEm)}</span>
        </span>
        </span>
        </span>
      </th>
      <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 xl:table-cell">{SETOR_LABEL[p.setor]}</td>
      <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-3 xl:table-cell">
        <span className="line-clamp-2" title={p.familia || undefined}>
          {p.familia || "—"}
        </span>
      </td>
      {temEstoque && (
        <td className="whitespace-nowrap border-b border-line-row px-3 py-3 text-right text-pequeno text-ink">
          {p.estoqueProprio > 0 ? <Numero valor={p.estoqueProprio} unidade={p.unidade} /> : <span className="numero text-meta">—</span>}
        </td>
      )}
      <td className="hidden whitespace-nowrap border-b border-line-row px-3 py-3 text-right text-pequeno text-ink-3 lg:table-cell" title={`Última alteração: ${formatarDataHora(p.atualizadoEm)}`}>
        {formatarDia(p.atualizadoEm)}
      </td>
      {/* px-3 também na última coluna: alinha com o cabeçalho ordenável. */}
      <td className="hidden border-b border-line-row px-3 py-3 text-right text-pequeno text-ink-3 sm:table-cell">
        <Numero valor={emBom.get(p.id) ?? 0} />
      </td>
      {gerencia && (
        <td className="whitespace-nowrap border-b border-line-row py-1.5 pl-1 pr-cartao text-right text-ink-3">
          <span className="inline-flex items-center justify-end gap-1">
            <span className={p.ativo ? "max-sm:hidden transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100" : undefined}>
              <PecaAtivoBotao id={p.id} ativo={p.ativo} nome={`${p.codigo} · ${p.nome}`} size="xs" />
            </span>
            <SetaAbrir />
          </span>
        </td>
      )}
    </>
  );

  const vazio: [string, string] = inativasOcultas
    ? ["Nenhuma peça ativa", "As peças desta lista estão inativas. Veja também as inativas para reativá-las."]
    : !busca && extraPecas && noSetor.length > 0
    ? [alteracao ? `Nenhuma peça ${alteracao.descricao.replace(/^alterados/, "alterada")}` : situacaoPecas === "inativos" ? "Nenhuma peça inativa" : "Nenhuma peça ativa", "Escolha outro período ou situação, ou volte para qualquer data."]
    : busca
    ? [`Nada encontrado para “${busca}”`, setor ? "Confira o termo ou volte para todos os setores." : "Confira o código ou tente outra palavra do nome ou da família."]
    : setor
      ? [`Nenhuma peça em ${SETOR_LABEL[setor]}`, "Escolha outro setor ou volte para todos."]
      : ["Nenhuma peça cadastrada", "O catálogo mestre reúne as peças usadas nos projetos e nas OS."];

  return (
    <>
      {cabecalho}
      <div className={barraCls}>
        {/* 300 px: com 240 o texto de exemplo cortava em "família ou p" (parte C N26). */}
        <BuscaUrl largura={300} key="busca-pecas" placeholder="Buscar peça, família ou prova" ariaLabel="Buscar peça do catálogo por código, nome, família ou prova" className="col-span-2" />
        {/* Celular: os setores rolam de lado numa linha só, em vez de quebrar a trilha. */}
        <div className="col-span-2 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Pills
          rotulo="Filtrar por setor"
          className="max-md:flex-nowrap"
          itens={[
            { label: "Todos", n: paraContagem.length, href: hrefCom("/biblioteca", params, { setor: null, pagina: null }), ativo: !setor },
            // Rótulo curto na pílula ("Estrutura", "Arena"): com o nome inteiro, os filtros quebravam em duas linhas.
            ...SETORES.map((s) => ({ label: SETOR_LABEL[s].replace(/ \(.*\)$| e percurso$/, ""), n: paraContagem.filter((p) => p.setor === s).length, href: hrefCom("/biblioteca", params, { setor: s, pagina: null }), ativo: setor === s })),
          ]}
        />
        </div>
        <FiltroAlteracao key={chaveAlteracao} />
        {gerencia && <FiltroSituacao feminino />}
        {atalhoFora}
      </div>
      <div className={cartaoCls}>
        <SelecaoEmLote
          key={JSON.stringify(["pecas", sp.q ?? "", sp.setor ?? "", chaveAlteracao, sp.situacao ?? "", sp.ordem ?? "", sp.dir ?? "", sp.pagina ?? "", pag.itens.map((p) => p.id)])}
          tipo="pecas"
          modoReativar={situacaoPecas === "inativos"}
          gerencia={gerencia}
          itens={pag.itens.map((p) => ({ id: p.id, nome: `${p.codigo} · ${p.nome}`, ativo: p.ativo }))}
        >
        <ContagemAoVivo oculto n={pag.total} singular="peça" plural="peças" complemento={[setor ? SETOR_LABEL[setor] : null, busca ? `busca “${busca}”` : null, alteracao?.descricao.replace(/^alterados/, "alteradas") ?? null, situacaoPecas === "inativos" ? "só inativas" : gerencia && !situacaoPecas ? "ativas e inativas" : null].filter(Boolean).join(" · ")} />
        {abasCom({ pecas: pag.total })}
        {pag.total > 0 && <BarraSelecaoLote gerencia={gerencia} />}
        {pag.total === 0 ? (
          <EmptyState
            title={vazio[0]}
            description={vazio[1]}
            icone={busca ? "busca" : undefined}
            action={
              inativasOcultas ? (
                <Link href={hrefCom("/biblioteca", params, { situacao: "todos", pagina: null })} className="link text-corpo">
                  Ver também as inativas
                </Link>
              ) : busca || setor || extraPecas ? (
                <Link href={hrefCom("/biblioteca", params, { q: null, setor: null, pagina: null, ...limparExtras })} className="link text-corpo">
                  {extraPecas ? "Limpar filtros" : busca && setor ? "Limpar busca e setor" : busca ? "Limpar busca" : "Ver todos os setores"}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table data-responsiva className="w-full border-collapse max-sm:[overflow-wrap:anywhere] sm:min-w-[620px]">
                <CaptionOculta>Catálogo de peças</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    {gerencia && (
                      <Th largura={44} className="px-2">
                        <CheckboxSelecionarPagina />
                      </Th>
                    )}
                    {th("codigo", "Código", 120, "left", "hidden sm:table-cell")}
                    {th("nome", "Peça")}
                    <Th className="hidden xl:table-cell" largura={150}>
                      Setor
                    </Th>
                    <Th className="hidden xl:table-cell" largura={130}>
                      Família
                    </Th>
                    {temEstoque && th("estoque", "Estoque", 100, "right")}
                    {th("alterado", "Alterada", 112, "right", "hidden lg:table-cell")}
                    {th("bom", "Em projetos", 118, "right", "hidden sm:table-cell")}
                    {gerencia && (
                      <Th largura={120} className="max-sm:!w-11">
                        <span className="sr-only">Inativar, reativar ou editar</span>
                      </Th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Quem só vê o catálogo também abre a peça (página de leitura, com fotos e PDFs): antes a linha
                      mostrava o selo "PDF" e não abria nada (auditoria 30/10, parte C N9). */}
                  {pag.itens.map((p) =>
                    gerencia ? (
                      <LinhaLink key={p.id} className="group" href={hrefPeca(`/catalogo/${p.id}/editar`, voltaAqui)} rotulo={`Editar ${p.codigo} — ${p.nome}`}>
                        {celulas(p)}
                      </LinhaLink>
                    ) : (
                      <LinhaLink key={p.id} href={hrefPeca(`/catalogo/${p.id}`, voltaAqui)} rotulo={`Ver ${p.codigo} — ${p.nome}`}>
                        {celulas(p)}
                      </LinhaLink>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <Paginacao {...pag} hrefPagina={(n) => hrefCom("/biblioteca", params, { pagina: n === 1 ? null : n })} />
          </>
        )}
        </SelecaoEmLote>
      </div>
    </>
  );
}
