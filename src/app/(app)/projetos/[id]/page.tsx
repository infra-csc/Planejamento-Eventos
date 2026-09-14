import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil } from "lucide-react";
import { getUsuarioAtual, requirePermissao } from "@/server/auth/session";
import { historicoProjeto, obterProjeto } from "@/server/services/projetos";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { NaoEncontradoError } from "@/domain/errors";
import { KeyValue, Notice, PageHeader, Panel, TableWrap } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnexosManager } from "@/components/projetos/anexos-manager";
import { AtivoToggle } from "@/components/projetos/ativo-toggle";
import { formatarDataHora } from "@/lib/format";
import { SETORES } from "@/server/db/schema";

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
        breadcrumbs={[{ label: "Projetos padrão", href: "/projetos" }, { label: p.codigo }]}
        title={
          <>
            {p.nome}
            {!p.ativo && <Badge>inativo</Badge>}
          </>
        }
        description={p.descricao || undefined}
        meta={
          <>
            <span>
              <span className="text-ink-muted">Código:</span> {p.codigo}
            </span>
            {p.categoria && (
              <span>
                <span className="text-ink-muted">Categoria:</span> {p.categoria}
              </span>
            )}
            <span>
              <span className="text-ink-muted">Versão atual:</span> v{p.versaoAtual}
            </span>
          </>
        }
        actions={
          gerencia && (
            <>
              <AtivoToggle id={p.id} ativo={p.ativo} />
              <ButtonLink href={`/projetos/${p.id}/editar`} variant="primary">
                <Pencil className="size-4" /> Editar
              </ButtonLink>
            </>
          )
        }
      />

      {p.usosDefasados.length > 0 && (
        <Notice tone="warning" className="mb-4" title="Eventos usando versões anteriores">
          {p.usosDefasados.map((u) => (
            <span key={u.eventoId} className="mr-3">
              <Link href={`/eventos/${u.eventoId}/ata`} className="underline">
                {u.codigo} {u.nome}
              </Link>{" "}
              (v{u.versao})
            </span>
          ))}
          <span className="block">A logística decide na ata de cada evento se atualiza para v{p.versaoAtual}.</span>
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title={`Lista de peças (BOM) · v${p.versaoAtual}`} description={`${itens.length} tipos de peça · ${total} unidades por projeto`} padded={false}>
            <TableWrap>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th>Código</th>
                    <th>Peça</th>
                    <th className="num">Qtd. por projeto</th>
                  </tr>
                </thead>
                <tbody>
                  {SETORES.flatMap((setor) =>
                    itens
                      .filter((i) => i.peca.setor === setor)
                      .sort((a, b) => a.peca.codigo.localeCompare(b.peca.codigo))
                      .map((i) => (
                        <tr key={i.id}>
                          <td className="text-ink-muted">{SETOR_LABEL[setor]}</td>
                          <td className="font-medium tabular">{i.peca.codigo}</td>
                          <td>
                            {i.peca.nome}
                            {!i.peca.ativo && <Badge className="ml-2">peça inativa</Badge>}
                          </td>
                          <td className="num tabular font-medium">
                            {i.quantidade} <span className="text-xs font-normal text-ink-muted">{i.peca.unidade}</span>
                          </td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </TableWrap>
          </Panel>

          <Panel title="Imagens e anexo técnico" description="Imagens de referência e PDF do projeto. Até 8 MB por arquivo." padded={false}>
            <AnexosManager projetoId={p.id} anexos={p.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))} podeGerenciar={gerencia} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Versões">
            <ol className="space-y-2 text-[13px]">
              {p.versoes.map((v) => (
                <li key={v.id} className={v.numero === p.versaoAtual ? "font-medium text-ink" : "text-ink-secondary"}>
                  v{v.numero} · {formatarDataHora(v.criadoEm)} · {v.criadoPor?.nome ?? "—"}
                  {v.observacao && <span className="block text-xs font-normal text-ink-muted">{v.observacao}</span>}
                  <span className="block text-xs font-normal text-ink-muted">{v.itens.length} tipos · {v.itens.reduce((a, i) => a + i.quantidade, 0)} unidades</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Dados">
            <KeyValue columns={1} items={[{ label: "Criado por", value: `${p.criadoPor?.nome ?? "—"} · ${formatarDataHora(p.criadoEm)}` }, { label: "Última alteração", value: formatarDataHora(p.atualizadoEm) }]} />
          </Panel>
          <Panel title="Histórico">
            {historico.length === 0 ? (
              <p className="text-sm text-ink-muted">Sem registros.</p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {historico.slice(0, 8).map((h) => (
                  <li key={h.id}>
                    <p className="text-ink">{h.descricao}</p>
                    <p className="text-xs text-ink-muted">
                      {h.usuario?.nome ?? "Sistema"} · {formatarDataHora(h.criadoEm)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {p.anexos.some((a) => a.tipo === "PDF") && (
            <Panel title="Anexo técnico">
              {p.anexos
                .filter((a) => a.tipo === "PDF")
                .map((a) => (
                  <a key={a.id} href={`/api/anexos/${a.id}`} target="_blank" className="flex items-center gap-2 text-sm text-info hover:underline">
                    <FileText className="size-4" /> {a.nomeArquivo}
                  </a>
                ))}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
