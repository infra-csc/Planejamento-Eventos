import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { contarUsoProjetos, listarProjetos, obterProjeto } from "@/server/services/projetos";
import { contarPecasEmBom, listarPecas } from "@/server/services/catalogo";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";
import { cn } from "@/lib/cn";
import { hrefCom, ordenar, paginar, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { BuscaUrl } from "@/components/ui/busca-url";
import { CaptionOculta, Paginacao, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { ImagemZoom } from "@/components/ui/imagem-zoom";

export const metadata: Metadata = { title: "Biblioteca" };

type SP = { aba?: string; p?: string; q?: string; setor?: string; ordem?: string; dir?: string; pagina?: string };

function Abas({ aba, nProjetos, nPecas }: { aba: "projetos" | "pecas"; nProjetos: number; nPecas: number }) {
  const itens = [
    { chave: "projetos", label: "Projetos padrão", n: nProjetos, href: "/biblioteca" },
    { chave: "pecas", label: "Catálogo de peças", n: nPecas, href: "/biblioteca?aba=pecas" },
  ];
  return (
    <nav aria-label="Seções da biblioteca" className="mb-[18px] flex gap-5 border-b border-line">
      {itens.map((t) => (
        <Link
          key={t.chave}
          href={t.href}
          aria-current={aba === t.chave ? "page" : undefined}
          className={cn("-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[13.5px] no-underline", aba === t.chave ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
        >
          {t.label}
          <span className="rounded-[5px] bg-control px-1.5 font-mono text-[11px] text-ink-3">{t.n}</span>
        </Link>
      ))}
    </nav>
  );
}

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const aba = sp.aba === "pecas" ? "pecas" : "projetos";
  const [projetos, pecasTodas] = await Promise.all([listarProjetos(usuario), listarPecas(usuario)]);

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
      <Abas aba={aba} nProjetos={projetos.length} nPecas={pecasTodas.length} />
    </>
  );

  if (aba === "projetos") {
    const uso = await contarUsoProjetos();
    const selecionado = projetos.find((p) => p.id === sp.p) ?? projetos[0];
    const detalhe = selecionado ? await obterProjeto(usuario, selecionado.id) : null;
    const atual = detalhe?.versaoAtualObj;
    const anterior = detalhe?.versoes.find((v) => v.numero === (detalhe.versaoAtual ?? 1) - 1);
    const bom = [...(atual?.itens ?? [])].sort((a, b) => SETORES.indexOf(a.peca.setor) - SETORES.indexOf(b.peca.setor) || a.peca.codigo.localeCompare(b.peca.codigo));

    return (
      <>
        {cabecalho}
        {projetos.length === 0 ? (
          <div className="rounded-[10px] border border-line bg-surface px-[18px] py-14 text-center">
            <p className="m-0 text-[14px] font-medium">Nenhum projeto padrão cadastrado</p>
            <p className="mt-1 text-[13px] text-muted">A cenografia cadastra os projetos com sua lista de peças.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
            <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
              {projetos.map((p) => {
                const sel = p.id === selecionado?.id;
                const n = uso.get(p.id) ?? 0;
                return (
                  <div key={p.id} className={cn("flex items-center gap-4 border-b border-line-row px-[18px] py-3.5 last:border-b-0 hover:bg-subtle", sel && "bg-selected shadow-[inset_3px_0_0_var(--color-accent)]")}>
                    {p.capa ? (
                      <ImagemZoom src={`/api/anexos/${p.capa.id}`} alt={p.nome} className="h-10 w-14 shrink-0 overflow-hidden rounded-[6px] border border-line" />
                    ) : (
                      <span aria-hidden className="grid h-10 w-14 shrink-0 place-items-center rounded-[6px] border border-dashed border-line-strong text-[10px] text-meta">
                        sem foto
                      </span>
                    )}
                    <Link href={hrefCom("/biblioteca", {}, { p: p.id })} scroll={false} aria-current={sel ? "true" : undefined} className="min-w-0 flex-1 no-underline">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 text-[14px] font-medium leading-[1.25] text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{p.nome}</span>
                        <span className="rounded-[5px] bg-control px-1.5 font-mono text-[11px] text-ink-3">v{p.versaoAtual}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                        <span className="font-mono">{p.codigo}</span>
                        {p.descricao ? ` · ${p.descricao}` : ""}
                      </span>
                    </Link>
                    <span className="w-[92px] shrink-0 text-[12.5px] text-ink-3 max-xl:hidden">{p.categoria || "—"}</span>
                    <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px] text-ink-2 max-xl:hidden">{p.tiposPeca} tipos</span>
                    <span className="w-[72px] shrink-0 text-right font-mono text-[12.5px] text-ink-2">{p.totalPecas} pç</span>
                    <span className={cn("w-[84px] shrink-0 text-right text-[12px] max-lg:hidden", n > 0 ? "text-ink-2" : "text-meta")}>{n > 0 ? `em ${n} ${n === 1 ? "evento" : "eventos"}` : "sem uso"}</span>
                  </div>
                );
              })}
            </div>

            {detalhe && atual && (
              <div className="lg:sticky lg:top-[76px]">
                <Section
                  titulo={detalhe.nome}
                  sub={`Lista de peças · v${detalhe.versaoAtual} · ${bom.reduce((a, i) => a + i.quantidade, 0)} unidades por projeto`}
                  acoes={
                    <span className="flex items-center gap-3">
                      {pode(usuario, "projeto.gerenciar") && (
                        <Link href={`/projetos/${detalhe.id}/editar`} className="link text-[12.5px]">
                          Editar
                        </Link>
                      )}
                      <Link href={`/projetos/${detalhe.id}`} className="link text-[12.5px]">
                        Abrir
                      </Link>
                    </span>
                  }
                >
                  {detalhe.anexos.some((a) => a.tipo === "IMAGEM") && (
                    <div className="flex gap-2 overflow-x-auto border-b border-line-soft px-[18px] py-3">
                      {detalhe.anexos
                        .filter((a) => a.tipo === "IMAGEM")
                        .map((a) => (
                          <ImagemZoom key={a.id} src={`/api/anexos/${a.id}`} alt={a.nomeArquivo} legenda={`${detalhe.nome} · ${a.nomeArquivo}`} className="h-[84px] w-28 shrink-0 overflow-hidden rounded-[7px] border border-line" />
                        ))}
                    </div>
                  )}
                  <div>
                    {bom.map((i) => {
                      const novo = anterior && !anterior.itens.some((x) => x.pecaId === i.pecaId);
                      return (
                        <div key={i.id} className="flex items-baseline gap-2.5 border-b border-line-faint px-[18px] py-2 last:border-b-0">
                          <span className="w-[86px] shrink-0 font-mono text-[12px] text-ink-2">{i.peca.codigo}</span>
                          <span className="min-w-0 flex-1 text-[12.5px] text-ink">
                            {i.peca.nome}
                            {novo && <span className="ml-1.5 rounded-[5px] bg-accent-bg px-1.5 py-px text-[10.5px] font-medium text-accent">novo na v{detalhe.versaoAtual}</span>}
                          </span>
                          <span className="font-mono text-[12.5px] font-semibold">{i.quantidade}</span>
                        </div>
                      );
                    })}
                  </div>
                  {(detalhe.versaoAtual > 1 || detalhe.usosDefasados.length > 0) && (
                    <p className="m-0 border-t border-line-soft bg-subtle px-[18px] py-3 text-[12px] leading-[1.5] text-ink-3">
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
  const buscadas = termo ? pecasTodas.filter((p) => `${p.codigo} ${p.nome} ${p.familia}`.toLowerCase().includes(termo)) : pecasTodas;
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
      <td className="border-b border-line-row px-[18px] py-2.5 font-mono text-[12.5px] font-medium text-ink">{p.codigo}</td>
      <th scope="row" className="border-b border-line-row px-2.5 py-2.5 text-left text-[13.5px] font-normal text-ink">
        {p.nome}
        {!p.permiteEmProjeto && <span className="ml-2 text-[11.5px] text-muted">sempre avulsa</span>}
      </th>
      <td className="border-b border-line-row px-2.5 py-2.5 text-[12.5px] text-ink-2">{SETOR_LABEL[p.setor]}</td>
      <td className="border-b border-line-row px-2.5 py-2.5 text-[12.5px] text-ink-3">{p.familia || "—"}</td>
      <td className="border-b border-line-row px-2.5 py-2.5 text-right font-mono text-[12.5px]">
        {p.estoqueProprio > 0 ? p.estoqueProprio : "—"} <span className="text-[11px] text-muted">{p.unidade}</span>
      </td>
      <td className="border-b border-line-row py-2.5 pl-2.5 pr-[18px] text-right font-mono text-[12.5px] text-ink-3">{emBom.get(p.id) ?? 0}</td>
    </>
  );

  return (
    <>
      {cabecalho}
      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <BuscaUrl placeholder="Buscar por código, nome ou família" />
        <Pills
          rotulo="Filtrar por setor"
          itens={[
            { label: "Todos", n: buscadas.length, href: hrefCom("/biblioteca", params, { setor: null, pagina: null }), ativo: !setor },
            ...SETORES.map((s) => ({ label: SETOR_LABEL[s], n: buscadas.filter((p) => p.setor === s).length, href: hrefCom("/biblioteca", params, { setor: s, pagina: null }), ativo: setor === s })),
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        {pag.total === 0 ? (
          <div className="px-[18px] py-14 text-center">
            <p className="m-0 text-[14px] font-medium">Nenhuma peça corresponde aos filtros</p>
            <p className="mt-1 text-[13px] text-muted">Ajuste a busca ou volte para todos os setores.</p>
          </div>
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
                  {th("bom", "Em BOM", 90, "right")}
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
