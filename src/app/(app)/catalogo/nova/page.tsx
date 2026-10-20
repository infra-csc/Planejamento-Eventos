import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterPeca } from "@/server/services/catalogo";
import { listarGruposProjetos } from "@/server/services/projetos";
import { NaoEncontradoError } from "@/domain/errors";
import { PageHeader } from "@/components/ui/layout";
import { PecaForm } from "@/components/catalogo/peca-form";
import { hrefPeca, voltaDaBiblioteca } from "@/lib/url";

export const metadata: Metadata = { title: "Nova peça" };

/**
 * Cadastra uma peça do zero ou a partir de outra (?de=<id>): setor, família, unidade, origem e descrição
 * vêm da original, para registrar uma variação sem digitar tudo de novo. Código e fotos são da peça nova.
 */
export default async function NovaPecaPage({ searchParams }: { searchParams: Promise<{ volta?: string; de?: string }> }) {
  const usuario = await requirePermissao("catalogo.gerenciar");
  const sp = await searchParams;
  const [grupos, origem] = await Promise.all([
    listarGruposProjetos(usuario),
    sp.de
      ? obterPeca(usuario, sp.de).catch((e) => {
          if (e instanceof NaoEncontradoError) notFound();
          throw e;
        })
      : null,
  ]);
  const volta = voltaDaBiblioteca(sp.volta);
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Biblioteca · catálogo de peças"
        title={origem ? `Duplicar ${origem.codigo}` : "Nova peça"}
        description={
          origem
            ? `Dados de ${origem.codigo} · ${origem.nome}. Dê um código novo, mude o nome (diga o que varia) e ajuste o que for diferente. Fotos e anexos você inclui depois de cadastrar.`
            : "Peças do catálogo entram nos projetos padrão, nas solicitações e nas OS de cada setor. Depois de cadastrar, você inclui as fotos e os anexos."
        }
        breadcrumbs={[{ label: "Biblioteca", href: volta }, ...(origem ? [{ label: origem.codigo, href: hrefPeca(`/catalogo/${origem.id}/editar`, volta) }] : []), { label: origem ? "Duplicar" : "Nova" }]}
      />
      <PecaForm
        valores={
          origem
            ? {
                codigo: `${origem.codigo}-`,
                nome: origem.nome,
                setor: origem.setor,
                familia: origem.familia,
                unidade: origem.unidade,
                descricao: origem.descricao,
                estoqueProprio: origem.estoqueProprio,
                permiteEmProjeto: origem.permiteEmProjeto,
                prova: origem.prova,
              }
            : {}
        }
        grupos={grupos}
        cancelarHref={volta}
      />
    </div>
  );
}
