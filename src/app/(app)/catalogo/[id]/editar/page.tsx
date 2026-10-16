import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterPeca } from "@/server/services/catalogo";
import { listarGruposProjetos } from "@/server/services/projetos";
import { NaoEncontradoError } from "@/domain/errors";
import { SETOR_LABEL } from "@/domain/os";
import { Aviso, PageHeader, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";
import { PecaForm } from "@/components/catalogo/peca-form";
import { PecaAtivoBotao } from "@/components/catalogo/peca-ativo-botao";
import { AnexosPeca } from "@/components/catalogo/anexos-peca";
import { voltaDaBiblioteca } from "@/lib/url";

export const metadata: Metadata = { title: "Editar peça" };

export default async function EditarPecaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string; volta?: string }> }) {
  const usuario = await requirePermissao("catalogo.gerenciar");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p, grupos] = await Promise.all([
    obterPeca(usuario, id).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
    listarGruposProjetos(usuario),
  ]);
  const volta = voltaDaBiblioteca(sp.volta);
  const nFotos = p.anexos.filter((a) => a.tipo === "IMAGEM").length;
  const nPdfs = p.anexos.length - nFotos;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader
        tamanho="sm"
        eyebrow={
          <>
            <Codigo>{p.codigo}</Codigo>
            <span>{SETOR_LABEL[p.setor]}</span>
            <span>{p.prova ? `Prova: ${p.prova}` : "Do galpão"}</span>
            {!p.ativo && <Badge tom="muted">Inativa</Badge>}
          </>
        }
        title={p.nome}
        breadcrumbs={[{ label: "Biblioteca", href: volta }, { label: p.codigo }]}
        actions={<PecaAtivoBotao id={p.id} ativo={p.ativo} nome={`${p.codigo} · ${p.nome}`} size="lg" />}
        className="!mb-0"
      />
      {sp.nova && (
        <Aviso tom="success" titulo="Peça cadastrada">
          Agora inclua as fotos da peça e, se tiver, o desenho técnico em PDF.
        </Aviso>
      )}
      <div id="fotos" className="scroll-mt-20">
        <Section titulo="Fotos e anexos" sub={p.anexos.length ? [nFotos && `${nFotos} ${nFotos === 1 ? "foto" : "fotos"}`, nPdfs && `${nPdfs} PDF`].filter(Boolean).join(" · ") + ". A primeira foto é a capa na Biblioteca." : "Fotos da peça e o desenho técnico (PDF)."}>
          <AnexosPeca pecaId={p.id} anexos={p.anexos} podeGerenciar />
        </Section>
      </div>
      <PecaForm valores={p} usos={p.usos} grupos={grupos} cancelarHref={volta} />
    </div>
  );
}
