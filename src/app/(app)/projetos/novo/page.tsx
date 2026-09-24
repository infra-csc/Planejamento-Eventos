import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { listarPecas } from "@/server/services/catalogo";
import { listarProjetos, obterProjeto } from "@/server/services/projetos";
import { NaoEncontradoError } from "@/domain/errors";
import { PageHeader } from "@/components/ui/layout";
import { ProjetoForm } from "@/components/projetos/projeto-form";

export const metadata: Metadata = { title: "Novo projeto padrão" };

/**
 * Cria um projeto do zero ou a partir de outro (?de=<id>): a lista de peças, a categoria e a
 * descrição vêm do original — é como a cenografia registra as variações (mesma estrutura, um
 * trecho a mais, outro pé).
 */
export default async function NovoProjetoPage({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const usuario = await requirePermissao("projeto.gerenciar");
  const { de } = await searchParams;
  const [pecas, projetos, origem] = await Promise.all([
    listarPecas(usuario),
    listarProjetos(usuario),
    de
      ? obterProjeto(usuario, de).catch((e) => {
          if (e instanceof NaoEncontradoError) notFound();
          throw e;
        })
      : null,
  ]);
  const categorias = [...new Set(projetos.map((p) => p.categoria).filter(Boolean))];
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Biblioteca · projeto padrão"
        title={origem ? `Duplicar ${origem.nome}` : "Novo projeto padrão"}
        description={origem ? "Mesma lista de peças do original. Mude o nome (diga o que varia) e ajuste o que for diferente; o código é gerado ao salvar." : "Um conjunto de peças que as áreas pedem de uma vez. O código é gerado ao salvar."}
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca" }, ...(origem ? [{ label: origem.codigo, href: `/projetos/${origem.id}` }] : []), { label: origem ? "Duplicar" : "Novo" }]}
      />
      <ProjetoForm
        valores={
          origem
            ? {
                nome: `${origem.nome} — `,
                categoria: origem.categoria,
                descricao: origem.descricao,
                disponivelEmSolicitacoes: origem.disponivelEmSolicitacoes,
                itens: (origem.versaoAtualObj?.itens ?? []).map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade })),
                origem: { codigo: origem.codigo, nome: origem.nome },
              }
            : { itens: [] }
        }
        pecas={pecas}
        categorias={categorias}
        cancelarHref={origem ? `/projetos/${origem.id}` : "/biblioteca"}
      />
    </div>
  );
}
