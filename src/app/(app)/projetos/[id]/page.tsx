import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual, requirePermissao } from "@/server/auth/session";
import { historicoProjeto } from "@/server/services/projetos";
import { obterProjetoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { NaoEncontradoError } from "@/domain/errors";
import { SETORES } from "@/domain/constantes";
import { diaMesHora } from "@/lib/format";
import { Aviso, ListaDados, Meta, PageHeader, Section } from "@/components/ui/layout";
import { Badge, ChipMono } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { AnexosManager } from "@/components/projetos/anexos-manager";
import { AtivoToggle } from "@/components/projetos/ativo-toggle";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const p = await obterProjetoCache(usuario, id).catch(() => null);
  return { title: p ? p.nome : "Projeto padrão" };
}

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("projeto.ver");
  const { id } = await params;
  const [p, historico] = await Promise.all([
    obterProjetoCache(usuario, id).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
    historicoProjeto(id),
  ]);
  const gerencia = pode(usuario, "projeto.gerenciar");
  const itens = p.versaoAtualObj?.itens ?? [];
  const total = itens.reduce((a, i) => a + i.quantidade, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca" }, { label: p.codigo }]}
        eyebrow={
          <>
            <span className="font-mono">{p.codigo}</span>
            <ChipMono tom="control">v{p.versaoAtual}</ChipMono>
            {!p.ativo && <Badge tom="muted">inativo</Badge>}
          </>
        }
        title={p.nome}
        description={p.descricao || undefined}
        meta={
          <>
            <Meta rotulo="Código" valor={p.codigo} mono />
            {p.categoria && <Meta rotulo="Categoria" valor={p.categoria} />}
          </>
        }
        actions={
          gerencia && (
            <>
              <AtivoToggle id={p.id} ativo={p.ativo} />
              <ButtonLink href={`/projetos/${p.id}/editar`} variant="primary" size="lg" className="no-underline">
                Editar
              </ButtonLink>
            </>
          )
        }
      />

      {p.usosDefasados.length > 0 && (
        <Aviso tom="warning" titulo="Eventos usando versões anteriores" className="mb-cartao">
          {p.usosDefasados.map((u, i) => (
            <span key={u.eventoId}>
              {i > 0 && " · "}
              <Link href={`/eventos/${u.eventoId}/ata`} className="link">
                {u.codigo} {u.nome}
              </Link>{" "}
              (v{u.versao})
            </span>
          ))}
          . A logística decide na ata de cada evento se atualiza para a v{p.versaoAtual}.
        </Aviso>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex flex-col gap-5">
          <Section titulo="Fotos e desenhos" sub="Render, modulação e PDF técnico do projeto. Até 8 MB por arquivo.">
            <AnexosManager projetoId={p.id} anexos={p.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))} podeGerenciar={gerencia} />
          </Section>

          <Section titulo={`Lista de peças · v${p.versaoAtual}`} sub={`${itens.length} ${itens.length === 1 ? "tipo de peça" : "tipos de peça"} · ${total} ${total === 1 ? "unidade" : "unidades"} por projeto`}>
            {/* Rolagem própria no celular: sem ela, colunas como Total ficavam cortadas pelo cartão. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <CaptionOculta>Lista de peças</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th largura={120}>Código</Th>
                    <Th>Peça</Th>
                    <Th largura={160}>Setor</Th>
                    <Th largura={90} alinhar="right">
                      Qtd.
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {SETORES.flatMap((setor) =>
                    itens
                      .filter((i) => i.peca.setor === setor)
                      .sort((a, b) => a.peca.codigo.localeCompare(b.peca.codigo))
                      .map((i) => (
                        <tr key={i.id} className="hover:bg-subtle">
                          <td className="border-b border-line-row px-cartao py-2.5 font-mono text-pequeno">{i.peca.codigo}</td>
                          <th scope="row" className="border-b border-line-row px-2.5 py-2.5 text-left text-corpo font-normal">
                            {i.peca.nome}
                            {!i.peca.ativo && <span className="ml-2 text-rotulo text-danger">peça inativa</span>}
                          </th>
                          <td className="border-b border-line-row px-2.5 py-2.5 text-pequeno text-ink-3">{SETOR_LABEL[setor]}</td>
                          <td className="border-b border-line-row py-2.5 pl-2.5 pr-cartao text-right font-mono text-corpo font-semibold">
                            {i.quantidade} <span className="text-rotulo font-normal text-muted">{i.peca.unidade}</span>
                          </td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section titulo="Versões">
            {p.versoes.map((v) => (
              <div key={v.id} className="relative border-b border-line-row px-cartao py-3 last:border-b-0">
                {v.numero === p.versaoAtual && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-corpo font-semibold">v{v.numero}</span>
                  <span className="flex-1 font-mono text-rotulo text-muted">{diaMesHora(v.criadoEm)}</span>
                  {v.numero === p.versaoAtual && <Badge tom="accent">atual</Badge>}
                </div>
                {v.observacao && <p className="mb-0 mt-1 text-pequeno text-ink-2">{v.observacao}</p>}
                <p className="mb-0 mt-0.5 text-rotulo text-muted">
                  {v.itens.length} tipos · {v.itens.reduce((a, i) => a + i.quantidade, 0)} unidades · {v.criadoPor?.nome ?? "—"}
                </p>
              </div>
            ))}
          </Section>
          <Section titulo="Dados">
            <ListaDados
              itens={[
                { label: "Criado por", valor: p.criadoPor?.nome ?? "—" },
                { label: "Criado em", valor: diaMesHora(p.criadoEm) },
                { label: "Última alteração", valor: diaMesHora(p.atualizadoEm) },
              ]}
            />
          </Section>
          <Section titulo="Histórico">
            <div className="px-cartao py-3">
              {historico.length === 0 && <p className="m-0 text-pequeno text-muted">Sem registros</p>}
              {historico.slice(0, 8).map((h) => (
                <div key={h.id} className="py-1.5">
                  <p className="m-0 text-pequeno text-ink">{h.descricao}</p>
                  <p className="m-0 text-rotulo text-meta">
                    {h.usuario?.nome ?? "Sistema"} · {diaMesHora(h.criadoEm)}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
