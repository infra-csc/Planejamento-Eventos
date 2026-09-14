import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual, requirePermissao } from "@/server/auth/session";
import { historicoProjeto, obterProjeto } from "@/server/services/projetos";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { NaoEncontradoError } from "@/domain/errors";
import { SETORES } from "@/server/db/schema";
import { diaMesHora } from "@/lib/format";
import { Aviso, ListaDados, PageHeader, Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { AnexosManager } from "@/components/projetos/anexos-manager";
import { AtivoToggle } from "@/components/projetos/ativo-toggle";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const p = await obterProjeto(usuario, id).catch(() => null);
  return { title: p ? p.nome : "Projeto padrão" };
}

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("projeto.ver");
  const { id } = await params;
  const p = await obterProjeto(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  const gerencia = pode(usuario, "projeto.gerenciar");
  const historico = await historicoProjeto(id);
  const itens = p.versaoAtualObj?.itens ?? [];
  const total = itens.reduce((a, i) => a + i.quantidade, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca" }, { label: p.codigo }]}
        title={
          <span className="flex items-center gap-2.5">
            {p.nome}
            <span className="rounded-[5px] bg-control px-1.5 font-mono text-[12px] font-normal text-ink-3">v{p.versaoAtual}</span>
            {!p.ativo && <span className="rounded-[5px] bg-neutral-bg px-1.5 text-[12px] font-normal text-muted">inativo</span>}
          </span>
        }
        description={p.descricao || undefined}
        meta={
          <>
            <span>
              <span className="text-muted">Código</span> <span className="font-mono">{p.codigo}</span>
            </span>
            {p.categoria && (
              <span>
                <span className="text-muted">Categoria</span> {p.categoria}
              </span>
            )}
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
        <Aviso tom="warning" titulo="Eventos usando versões anteriores" className="mb-[18px]">
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

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5">
        <div className="flex flex-col gap-5">
          <Section titulo={`Lista de peças · v${p.versaoAtual}`} sub={`${itens.length} tipos de peça · ${total} unidades por projeto`}>
            <table className="w-full border-collapse">
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
                        <td className="border-b border-line-row px-[18px] py-2.5 font-mono text-[12.5px]">{i.peca.codigo}</td>
                        <th scope="row" className="border-b border-line-row px-2.5 py-2.5 text-left text-[13.5px] font-normal">
                          {i.peca.nome}
                          {!i.peca.ativo && <span className="ml-2 text-[11.5px] text-danger">peça inativa</span>}
                        </th>
                        <td className="border-b border-line-row px-2.5 py-2.5 text-[12.5px] text-ink-3">{SETOR_LABEL[setor]}</td>
                        <td className="border-b border-line-row py-2.5 pl-2.5 pr-[18px] text-right font-mono text-[13px] font-semibold">
                          {i.quantidade} <span className="text-[11px] font-normal text-muted">{i.peca.unidade}</span>
                        </td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </Section>

          <Section titulo="Imagens e anexo técnico" sub="Imagens de referência e PDF do projeto. Até 8 MB por arquivo.">
            <AnexosManager projetoId={p.id} anexos={p.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))} podeGerenciar={gerencia} />
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section titulo="Versões">
            {p.versoes.map((v) => (
              <div key={v.id} className="border-b border-line-row px-4 py-3 last:border-b-0" style={{ boxShadow: v.numero === p.versaoAtual ? "inset 3px 0 0 #8e2740" : undefined }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[13px] font-semibold">v{v.numero}</span>
                  <span className="flex-1 font-mono text-[11.5px] text-muted">{diaMesHora(v.criadoEm)}</span>
                  {v.numero === p.versaoAtual && <span className="text-[11px] font-medium text-accent">atual</span>}
                </div>
                {v.observacao && <p className="mb-0 mt-1 text-[12.5px] text-ink-2">{v.observacao}</p>}
                <p className="mb-0 mt-0.5 text-[11.5px] text-muted">
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
            <div className="px-[18px] py-3">
              {historico.length === 0 && <p className="m-0 text-[12.5px] text-muted">Sem registros.</p>}
              {historico.slice(0, 8).map((h) => (
                <div key={h.id} className="py-1.5">
                  <p className="m-0 text-[12.5px] text-ink">{h.descricao}</p>
                  <p className="m-0 text-[11.5px] text-meta">
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
