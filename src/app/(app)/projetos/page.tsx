import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermissao } from "@/server/auth/session";
import { listarProjetos } from "@/server/services/projetos";
import { pode } from "@/domain/permissions";
import { EmptyState, PageHeader, Panel, TableWrap } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FiltersBar } from "@/components/ui/filters";

export const metadata: Metadata = { title: "Projetos padrão" };

export default async function ProjetosPage({ searchParams }: { searchParams: Promise<{ q?: string; inativos?: string }> }) {
  const usuario = await requirePermissao("projeto.ver");
  const sp = await searchParams;
  const projetos = await listarProjetos(usuario, { busca: sp.q, incluirInativos: sp.inativos === "1" });
  const gerencia = pode(usuario, "projeto.gerenciar");

  return (
    <>
      <PageHeader
        title="Projetos padrão"
        description="Biblioteca de estruturas com lista de peças (BOM). Um projeto × quantidade no evento vira peças na OS, sem cálculo manual."
        actions={
          gerencia && (
            <ButtonLink href="/projetos/novo" variant="primary">
              <Plus className="size-4" /> Novo projeto
            </ButtonLink>
          )
        }
      />
      <FiltersBar className="mb-4" search={{ name: "q", placeholder: "Buscar por nome, código ou categoria" }} selects={[{ name: "inativos", label: "Inativos", options: [{ value: "1", label: "Incluir inativos" }], all: "Somente ativos" }]} />
      <Panel padded={false}>
        {projetos.length === 0 ? (
          <EmptyState
            title={sp.q ? "Nenhum projeto corresponde à busca" : "Nenhum projeto padrão cadastrado"}
            description={gerencia ? "Cadastre o primeiro projeto com sua lista de peças. Ex.: Pórtico boca 6,60m." : "A Cenografia administra a biblioteca de projetos."}
            action={gerencia && !sp.q ? <ButtonLink href="/projetos/novo" variant="primary">Novo projeto</ButtonLink> : undefined}
          />
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-14"></th>
                  <th>Projeto</th>
                  <th className="hidden sm:table-cell">Categoria</th>
                  <th className="num">Tipos de peça</th>
                  <th className="num">Peças no total</th>
                  <th className="hidden md:table-cell">Versão</th>
                  <th className="hidden md:table-cell">Anexos</th>
                </tr>
              </thead>
              <tbody>
                {projetos.map((p) => (
                  <tr key={p.id} className="is-link">
                    <td>
                      {p.capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/anexos/${p.capa.id}`} alt="" className="size-10 rounded-sm border border-line object-cover" />
                      ) : (
                        <div className="size-10 rounded-sm border border-dashed border-line" aria-hidden />
                      )}
                    </td>
                    <td>
                      <Link href={`/projetos/${p.id}`} className="block">
                        <span className="font-medium text-ink">{p.nome}</span>
                        {!p.ativo && (
                          <Badge tone="neutral" className="ml-2">
                            inativo
                          </Badge>
                        )}
                        <span className="block text-xs text-ink-muted">{p.codigo}</span>
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell">{p.categoria || "—"}</td>
                    <td className="num tabular">{p.tiposPeca}</td>
                    <td className="num tabular">{p.totalPecas}</td>
                    <td className="hidden md:table-cell tabular">v{p.versaoAtual}</td>
                    <td className="hidden md:table-cell text-ink-muted">
                      {p.anexos.filter((a) => a.tipo === "IMAGEM").length} img · {p.anexos.filter((a) => a.tipo === "PDF").length} PDF
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
