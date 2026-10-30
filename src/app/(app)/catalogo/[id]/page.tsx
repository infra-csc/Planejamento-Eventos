import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterPeca } from "@/server/services/catalogo";
import { NaoEncontradoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { ListaDados, PageHeader, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Codigo, Numero } from "@/components/ui/numero";
import { AnexosPeca } from "@/components/catalogo/anexos-peca";
import { hrefPeca, voltaDaBiblioteca } from "@/lib/url";

export const metadata: Metadata = { title: "Peça" };

/**
 * A peça só para ler (fotos com zoom, PDFs e dados), para quem vê o catálogo mas não o gerencia. Antes a lista
 * mostrava o selo "PDF" e a foto, mas a linha não abria nada (auditoria 30/10, parte C N9). Quem gerencia vai
 * direto para a edição, que já mostra tudo isso.
 */
export default async function PecaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volta?: string }> }) {
  const usuario = await requirePermissao("catalogo.ver");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const volta = voltaDaBiblioteca(sp.volta);
  if (pode(usuario, "catalogo.gerenciar")) redirect(hrefPeca(`/catalogo/${id}/editar`, volta));
  const p = await obterPeca(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
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
        description={p.descricao ?? undefined}
        breadcrumbs={[{ label: "Biblioteca", href: volta }, { label: p.codigo }]}
        className="!mb-0"
      />
      <Section titulo="Fotos e anexos" sub={p.anexos.length ? [nFotos && `${nFotos} ${nFotos === 1 ? "foto" : "fotos"}`, nPdfs && `${nPdfs} PDF`].filter(Boolean).join(" · ") : undefined}>
        <AnexosPeca pecaId={p.id} anexos={p.anexos} podeGerenciar={false} />
      </Section>
      <Section titulo="Dados da peça">
        <ListaDados
          itens={[
            { label: "Setor", valor: SETOR_LABEL[p.setor] },
            { label: "Família", valor: p.familia || "—" },
            { label: "Unidade", valor: p.unidade },
            ...(p.estoqueProprio > 0 ? [{ label: "Estoque próprio", valor: <Numero valor={p.estoqueProprio} unidade={p.unidade} /> }] : []),
            { label: "Nas solicitações", valor: p.disponivelEmSolicitacoes ? (p.permiteEmProjeto ? "Sim" : "Sim, só fora de projeto") : "Não" },
          ]}
        />
      </Section>
      {p.usos.length > 0 && (
        <Section titulo="Em projetos" sub={`${p.usos.length} ${p.usos.length === 1 ? "projeto ativo usa" : "projetos ativos usam"} esta peça`}>
          <ul className="m-0 list-none divide-y divide-line-row p-0">
            {p.usos.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-cartao py-2.5 text-corpo">
                <Link href={`/projetos/${u.id}`} className="link min-w-0 truncate">
                  <Codigo className="mr-2 text-pequeno">{u.codigo}</Codigo>
                  {u.nome}
                </Link>
                <span className="numero shrink-0 text-pequeno text-muted">× {u.quantidade}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
