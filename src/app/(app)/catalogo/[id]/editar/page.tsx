import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterPeca } from "@/server/services/catalogo";
import { NaoEncontradoError } from "@/domain/errors";
import { SETOR_LABEL } from "@/domain/os";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";
import { PecaForm } from "@/components/catalogo/peca-form";
import { PecaAtivoBotao } from "@/components/catalogo/peca-ativo-botao";

export const metadata: Metadata = { title: "Editar peça" };

export default async function EditarPecaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("catalogo.gerenciar");
  const { id } = await params;
  const p = await obterPeca(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  return (
    <div className="max-w-3xl">
      <PageHeader
        tamanho="sm"
        eyebrow={
          <>
            <Codigo>{p.codigo}</Codigo>
            <span>{SETOR_LABEL[p.setor]}</span>
            {!p.ativo && <Badge tom="muted">Inativa</Badge>}
          </>
        }
        title={p.nome}
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca?aba=pecas" }, { label: p.codigo }]}
        actions={<PecaAtivoBotao id={p.id} ativo={p.ativo} nome={`${p.codigo} · ${p.nome}`} size="lg" />}
      />
      <PecaForm valores={p} usos={p.usos} cancelarHref="/biblioteca?aba=pecas" />
    </div>
  );
}
