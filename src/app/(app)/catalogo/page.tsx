import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermissao } from "@/server/auth/session";
import { listarPecas } from "@/server/services/catalogo";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { SETORES, type Setor } from "@/server/db/schema";
import { EmptyState, PageHeader, Panel, TableWrap } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FiltersBar } from "@/components/ui/filters";
import { PecaAtivoBotao } from "@/components/catalogo/peca-ativo-botao";

export const metadata: Metadata = { title: "Catálogo de peças" };

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ q?: string; setor?: string; inativas?: string }> }) {
  const usuario = await requirePermissao("catalogo.ver");
  const sp = await searchParams;
  const setor = (SETORES as readonly string[]).includes(sp.setor ?? "") ? (sp.setor as Setor) : undefined;
  const pecas = await listarPecas(usuario, { busca: sp.q, setor, incluirInativas: sp.inativas === "1" });
  const gerencia = pode(usuario, "catalogo.gerenciar");

  return (
    <>
      <PageHeader
        title="Catálogo de peças"
        description="Cadastro mestre: cada peça existe uma vez e é reutilizada por todos os projetos. O estoque próprio alimenta a consolidação por período."
        actions={
          gerencia && (
            <ButtonLink href="/catalogo/nova" variant="primary">
              <Plus className="size-4" /> Nova peça
            </ButtonLink>
          )
        }
      />
      <FiltersBar
        className="mb-4"
        search={{ name: "q", placeholder: "Buscar por código, nome ou família" }}
        selects={[
          { name: "setor", label: "Setor", options: SETORES.map((s) => ({ value: s, label: SETOR_LABEL[s] })) },
          { name: "inativas", label: "Inativas", options: [{ value: "1", label: "Incluir inativas" }], all: "Somente ativas" },
        ]}
      />
      <Panel padded={false}>
        {pecas.length === 0 ? (
          <EmptyState title={sp.q || sp.setor ? "Nenhuma peça corresponde aos filtros" : "Catálogo vazio"} description="Cadastre as peças de box truss (400, 600, 700…), tenda e marcenaria." action={gerencia && !sp.q ? <ButtonLink href="/catalogo/nova" variant="primary">Nova peça</ButtonLink> : undefined} />
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Peça</th>
                  <th className="hidden sm:table-cell">Setor</th>
                  <th className="hidden md:table-cell">Família</th>
                  <th className="num">Estoque próprio</th>
                  <th className="hidden lg:table-cell">Em BOM?</th>
                  {gerencia && <th className="w-px"></th>}
                </tr>
              </thead>
              <tbody>
                {pecas.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium tabular">
                      {gerencia ? (
                        <Link href={`/catalogo/${p.id}/editar`} className="hover:underline">
                          {p.codigo}
                        </Link>
                      ) : (
                        p.codigo
                      )}
                    </td>
                    <td>
                      {p.nome}
                      {!p.ativo && <Badge className="ml-2">inativa</Badge>}
                      {p.descricao && <span className="block text-xs text-ink-muted">{p.descricao}</span>}
                    </td>
                    <td className="hidden sm:table-cell">{SETOR_LABEL[p.setor]}</td>
                    <td className="hidden md:table-cell text-ink-secondary">{p.familia || "—"}</td>
                    <td className="num tabular">
                      {p.estoqueProprio} <span className="text-xs text-ink-muted">{p.unidade}</span>
                    </td>
                    <td className="hidden lg:table-cell text-ink-muted">{p.permiteEmProjeto ? "sim" : "sempre avulsa"}</td>
                    {gerencia && (
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link href={`/catalogo/${p.id}/editar`} className="rounded-md px-2 py-1 text-[13px] text-ink-secondary hover:bg-black/5">
                            Editar
                          </Link>
                          <PecaAtivoBotao id={p.id} ativo={p.ativo} nome={p.nome} />
                        </div>
                      </td>
                    )}
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
