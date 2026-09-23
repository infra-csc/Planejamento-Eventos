import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterProjeto } from "@/server/services/projetos";
import { listarPecas } from "@/server/services/catalogo";
import { NaoEncontradoError } from "@/domain/errors";
import { PageHeader } from "@/components/ui/layout";
import { Badge, ChipMono } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";
import { ProjetoForm } from "@/components/projetos/projeto-form";

export const metadata: Metadata = { title: "Editar projeto" };

export default async function EditarProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("projeto.gerenciar");
  const { id } = await params;
  const [p, pecas] = await Promise.all([
    obterProjeto(usuario, id).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
    listarPecas(usuario),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader
        tamanho="sm"
        eyebrow={
          <>
            <Codigo>{p.codigo}</Codigo>
            <ChipMono tom="control">v{p.versaoAtual}</ChipMono>
            {!p.ativo && <Badge tom="muted">Inativo</Badge>}
          </>
        }
        title={`Editar ${p.nome}`}
        description="Alterar a lista de peças cria uma nova versão; alterar só nome, categoria ou descrição não."
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca" }, { label: p.codigo, href: `/projetos/${p.id}` }, { label: "Editar" }]}
      />
      <ProjetoForm
        valores={{ id: p.id, nome: p.nome, categoria: p.categoria, descricao: p.descricao, versaoAtual: p.versaoAtual, itens: (p.versaoAtualObj?.itens ?? []).map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade })) }}
        pecas={pecas}
        cancelarHref={`/projetos/${p.id}`}
      />
    </div>
  );
}
