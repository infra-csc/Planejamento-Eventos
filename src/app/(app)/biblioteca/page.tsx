import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { contarUsoProjetos, listarProjetos, obterProjeto } from "@/server/services/projetos";
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
import { CaptionOculta, Paginacao, Th, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { EditarProjetoModal } from "@/components/projetos/editar-projeto-modal";
import { RolarAoSelecionar } from "@/components/biblioteca/rolar-ao-selecionar";
import { combinaBusca } from "@/lib/busca";

export const metadata: Metadata = { title: "Biblioteca" };

type SP = { aba?: string; p?: string; q?: string; setor?: string; ordem?: string; dir?: string; pagina?: string };

type Aba = "projetos" | "pecas" | "fora";

/**
 * Abas por query string (`?aba=`): o TabsNav decide a aba ativa só pelo pathname, que aqui é o mesmo
 * nas duas. Mesmo desenho do TabsNav, com a aba ativa vinda do parâmetro.
 */
function Abas({ aba, nProjetos, nPecas, nFora }: { aba: Aba; nProjetos: number; nPecas: number; nFora: number | null }) {
  const itens = [
    { chave: "projetos", label: "Projetos padrão", n: nProjetos, href: "/biblioteca" },
    { chave: "pecas", label: "Catálogo de peças", n: nPecas, href: "/biblioteca?aba=pecas" },
    // Só quem cadastra/vincula vê a fila do que as áreas descreveram à mão.
    ...(nFora == null ? [] : [{ chave: "fora", label: "Fora do catálogo", n: nFora, href: "/biblioteca?aba=fora" }]),
  ];
  return <TabsNav rotulo="Seções da biblioteca" tabs={itens.map((t) => ({ href: t.href, label: t.label, n: t.n, ativo: aba === t.chave }))} />;
}

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const podeVincular = pode(usuario, "ata.consolidar");
  const aba: Aba = sp.aba === "pecas" ? "pecas" : sp.aba === "fora" && podeVincular ? "fora" : "projetos";
  const [projetos, pecasTodas, foraCatalogo] = await Promise.all([listarProjetos(usuario), listarPecas(usuario), podeVincular ? listarItensForaDoCatalogo(usuario) : Promise.resolve(null)]);

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

  const cabecalho = (
    <>
      <PageHeader title="Biblioteca" description="Projetos padrão com lista de peças e o catálogo mestre. Um projeto × quantidade na ata vira peças na OS, sem conta manual." actions={acoes} />
      <Abas aba={aba} nProjetos={projetos.length} nPecas={pecasTodas.length} nFora={foraCatalogo ? foraCatalogo.length : null} />
    </>
  );

  if (aba === "fora" && foraCatalogo) {
    const opcoes = await opcoesReferenciasResumidas();
    return (
      <>
        {cabecalho}
        <Section
          titulo="Itens que as áreas descreveram à mão"
          sub="Enquanto não viram peça ou projeto do catálogo, não somam peças na OS: a separação é manual. Vincule a algo que já existe ou cadastre a peça."
        >
          <FilaForaCatalogo itens={foraCatalogo} opcoes={opcoes} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
        </Section>
      </>
    );
  }

  if (aba === "projetos") {
    // Busca e paginação em memória (a lista de projetos já vem inteira do serviço).
    const termo = (sp.q ?? "").trim().toLowerCase();
    const encontrados = termo ? projetos.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${p.categoria ?? ""} ${p.descricao ?? ""}`, termo)) : projetos;
    const pag = paginar(encontrados, sp.pagina, 12);
    const params = { q: sp.q, pagina: sp.pagina };
    const selecionado = projetos.find((p) => p.id === sp.p) ?? pag.itens[0];
    const [uso, detalhe] = await Promise.all([contarUsoProjetos(), selecionado ? obterProjeto(usuario, selecionado.id) : null]);
    const atual = detalhe?.versaoAtualObj;
    const anterior = detalhe?.versoes.find((v) => v.numero === (detalhe.versaoAtual ?? 1) - 1);
    const bom = [...(atual?.itens ?? [])].sort((a, b) => SETORES.indexOf(a.peca.setor) - SETORES.indexOf(b.peca.setor) || a.peca.codigo.localeCompare(b.peca.codigo));

    return (
      <>
        {cabecalho}
        {projetos.length > 0 && (
          <div className="mb-cartao flex flex-wrap items-center gap-2.5">
            <BuscaUrl key="busca-projetos" placeholder="Buscar por código, nome ou categoria" />
          </div>
        )}
        {projetos.length === 0 ? (
          <div className="rounded-cartao border border-line bg-surface">
            <EmptyState title="Nenhum projeto padrão cadastrado" description="A cenografia cadastra os projetos com sua lista de peças." />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
            <div className="overflow-hidden rounded-cartao border border-line bg-surface">
              {pag.total === 0 ? (
                <EmptyState title="Nenhum projeto corresponde à busca" description="Ajuste a busca para ver os projetos padrão." />
              ) : (
                <>
                  {/* table-fixed: a tabela nunca passa da largura do cartão (antes as colunas da direita sumiam atrás do painel). */}
                  <table className="w-full table-fixed border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
                    <CaptionOculta>Projetos padrão</CaptionOculta>
                    <thead>
                      <tr>
                        <Th largura={92}>
                          <span className="sr-only">Foto</span>
                        </Th>
                        <Th>Projeto</Th>
                        <Th largura={120} className="hidden 2xl:table-cell">
                          Categoria
                        </Th>
                        <Th largura={104} alinhar="right" className="hidden lg:table-cell">
                          Uso
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pag.itens.map((p) => {
                        const sel = p.id === selecionado?.id;
                        const n = uso.get(p.id) ?? 0;
                        return (
                          <LinhaLink key={p.id} href={hrefCom("/biblioteca", params, { p: p.id })} rotulo={`Ver ${p.codigo} — ${p.nome}`} scroll={false} className={cn(sel && "bg-selected")}>
                            <td className="relative border-b border-line-row py-3.5 pl-cartao pr-1">
                              {sel && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
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
                            <th scope="row" aria-current={sel ? "true" : undefined} className="border-b border-line-row px-3 py-3.5 text-left font-normal">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="line-clamp-2 min-w-0 text-corpo font-medium leading-[1.25] text-ink" title={p.nome}>
                                  {p.nome}
                                </span>
                                <ChipMono tom="control">v{p.versaoAtual}</ChipMono>
                              </span>
                              {/* Quantas peças o projeto leva: na própria linha, onde não tem como cortar. */}
                              <span className="mt-0.5 block text-pequeno text-ink-3">
                                <span className="font-mono">{p.codigo}</span> · {p.tiposPeca} {p.tiposPeca === 1 ? "tipo de peça" : "tipos de peça"} · <span className="font-mono">{p.totalPecas}</span> {p.totalPecas === 1 ? "peça" : "peças"}
                              </span>
                              {p.descricao && (
                                <span className="mt-0.5 block truncate text-pequeno text-muted" title={p.descricao}>
                                  {p.descricao}
                                </span>
                              )}
                            </th>
                            <td className="hidden truncate border-b border-line-row px-3 py-3.5 text-pequeno text-ink-3 2xl:table-cell">{p.categoria || "—"}</td>
                            <td className={cn("hidden whitespace-nowrap border-b border-line-row py-3.5 pl-3 pr-cartao text-right text-pequeno lg:table-cell", n > 0 ? "text-ink-2" : "text-meta")}>{n > 0 ? `em ${n} ${n === 1 ? "evento" : "eventos"}` : "sem uso"}</td>
                          </LinhaLink>
                        );
                      })}
                    </tbody>
                  </table>
                  <Paginacao {...pag} hrefPagina={(n) => hrefCom("/biblioteca", params, { pagina: n === 1 ? null : n, p: sp.p })} />
                </>
              )}
            </div>

            {detalhe && atual && (
              <div id="detalhe" className="scroll-mt-20 lg:sticky lg:top-topo-fixo">
                <RolarAoSelecionar alvoId="detalhe" selecionado={sp.p} />
                <Section
                  titulo={detalhe.nome}
                  sub={`Lista de peças · v${detalhe.versaoAtual} · ${bom.reduce((a, i) => a + i.quantidade, 0)} unidades por projeto`}
                  acoes={
                    <span className="flex items-center gap-3">
                      {pode(usuario, "projeto.gerenciar") && (
                        <EditarProjetoModal
                          projeto={{ id: detalhe.id, nome: detalhe.nome, categoria: detalhe.categoria, descricao: detalhe.descricao, versaoAtual: detalhe.versaoAtual, itens: bom.map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade })) }}
                          anexos={detalhe.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))}
                        />
                      )}
                      <Link href={`/projetos/${detalhe.id}`} className="link text-pequeno">
                        Abrir
                      </Link>
                    </span>
                  }
                >
                  {detalhe.anexos.some((a) => a.tipo === "IMAGEM") && (
                    <div className="flex gap-2 overflow-x-auto border-b border-line-soft px-cartao py-3">
                      {detalhe.anexos
                        .filter((a) => a.tipo === "IMAGEM")
                        .map((a) => (
                          <ImagemZoom key={a.id} src={`/api/anexos/${a.id}`} alt={a.nomeArquivo} legenda={`${detalhe.nome} · ${a.nomeArquivo}`} className="h-[84px] w-28 shrink-0 overflow-hidden rounded-controle border border-line" />
                        ))}
                    </div>
                  )}
                  <div>
                    {bom.map((i) => {
                      const novo = anterior && !anterior.itens.some((x) => x.pecaId === i.pecaId);
                      return (
                        <div key={i.id} className="flex items-baseline gap-2.5 border-b border-line-faint px-cartao py-2 last:border-b-0">
                          <span className="w-[86px] shrink-0 font-mono text-pequeno text-ink-2">{i.peca.codigo}</span>
                          <span className="min-w-0 flex-1 text-pequeno text-ink">
                            {i.peca.nome}
                            {novo && (
                              <Tag tom="accent" className="ml-1.5 font-medium">
                                novo na v{detalhe.versaoAtual}
                              </Tag>
                            )}
                          </span>
                          <span className="font-mono text-pequeno font-semibold">{i.quantidade}</span>
                        </div>
                      );
                    })}
                  </div>
                  {(detalhe.versaoAtual > 1 || detalhe.usosDefasados.length > 0) && (
                    <p className="m-0 border-t border-line-soft bg-subtle px-cartao py-3 text-pequeno leading-[1.5] text-ink-3">
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
  const termo = (sp.q ?? "").trim().toLowerCase();
  const setor = (SETORES as readonly string[]).includes(sp.setor ?? "") ? (sp.setor as Setor) : null;
  const buscadas = termo ? pecasTodas.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${p.familia}`, termo)) : pecasTodas;
  const filtradas = setor ? buscadas.filter((p) => p.setor === setor) : buscadas;
  const ordenadas = ordenar(
    filtradas,
    { codigo: (p) => p.codigo, nome: (p) => p.nome.toLowerCase(), setor: (p) => SETORES.indexOf(p.setor), familia: (p) => (p.familia ?? "").toLowerCase(), estoque: (p) => p.estoqueProprio, bom: (p) => emBom.get(p.id) ?? 0 },
    sp.ordem,
    sp.dir,
  );
  const pag = paginar(ordenadas, sp.pagina, 12);
  const params = { aba: "pecas", q: sp.q, setor: sp.setor, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina };
  const gerencia = pode(usuario, "catalogo.gerenciar");
  const th = (chave: string, label: string, largura?: number, alinhar?: "left" | "right") => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return <ThOrdenavel label={label} ativo={sp.ordem === chave} dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined} href={hrefCom("/biblioteca", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })} largura={largura} alinhar={alinhar} />;
  };

  const celulas = (p: (typeof pag.itens)[number]) => (
    <>
      <td className="border-b border-line-row px-cartao py-2.5 font-mono text-pequeno font-medium text-ink">{p.codigo}</td>
      <th scope="row" className="border-b border-line-row px-2.5 py-2.5 text-left text-corpo font-normal text-ink">
        {p.nome}
        {!p.permiteEmProjeto && <span className="ml-2 text-rotulo text-muted">só fora de projeto</span>}
      </th>
      <td className="border-b border-line-row px-2.5 py-2.5 text-pequeno text-ink-2">{SETOR_LABEL[p.setor]}</td>
      <td className="border-b border-line-row px-2.5 py-2.5 text-pequeno text-ink-3">{p.familia || "—"}</td>
      <td className="border-b border-line-row px-2.5 py-2.5 text-right font-mono text-pequeno">
        {p.estoqueProprio > 0 ? p.estoqueProprio : "—"} <span className="text-rotulo text-muted">{p.unidade}</span>
      </td>
      <td className="border-b border-line-row py-2.5 pl-2.5 pr-cartao text-right font-mono text-pequeno text-ink-3">{emBom.get(p.id) ?? 0}</td>
    </>
  );

  return (
    <>
      {cabecalho}
      <div className="mb-cartao flex flex-wrap items-center gap-2.5">
        <BuscaUrl placeholder="Buscar por código, nome ou família" />
        <Pills
          rotulo="Filtrar por setor"
          itens={[
            { label: "Todos", n: buscadas.length, href: hrefCom("/biblioteca", params, { setor: null, pagina: null }), ativo: !setor },
            ...SETORES.map((s) => ({ label: SETOR_LABEL[s], n: buscadas.filter((p) => p.setor === s).length, href: hrefCom("/biblioteca", params, { setor: s, pagina: null }), ativo: setor === s })),
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        {pag.total === 0 ? (
          <EmptyState title="Nenhuma peça corresponde aos filtros" description="Ajuste a busca ou volte para todos os setores." />
        ) : (
          <>
            <table className="w-full border-collapse">
              <CaptionOculta>Catálogo de peças</CaptionOculta>
              <thead>
                <tr className="bg-subtle">
                  {th("codigo", "Código", 120)}
                  {th("nome", "Peça")}
                  {th("setor", "Setor", 160)}
                  {th("familia", "Família", 120)}
                  {th("estoque", "Estoque", 100, "right")}
                  {th("bom", "Em projetos", 110, "right")}
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
            <Paginacao {...pag} hrefPagina={(n) => hrefCom("/biblioteca", params, { pagina: n === 1 ? null : n })} />
          </>
        )}
      </div>
    </>
  );
}
