import type { Metadata } from "next";
import { CarregamentoTela, type GrupoCarregamento } from "@/components/eventos/carregamento-tela";
import { EmptyState, Section } from "@/components/ui/layout";
import { linhasCarregamento, mudancasCarregamento, type LinhaCarregamento } from "@/domain/carregamento";
import { GRUPO_LABEL, GRUPOS_MATERIAL, grupoDoCodigo } from "@/domain/grupos-material";
import { pode } from "@/domain/permissions";
import { requireUsuario } from "@/server/auth/session";
import { obterEventoCache } from "@/server/cache";
import { obterCarregamento } from "@/server/services/carregamento";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { calcularOsAoVivo } from "@/server/services/os";

export const metadata: Metadata = { title: "Carregamento" };

/** Aba Carregamento do evento: o que foi de fato no caminhão. Todos veem; logística e administrador alteram. A OS não muda. */
export default async function CarregamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id);
  if (!ev.ataFechadaEm) {
    return (
      <Section>
        <EmptyState icone="caminhao" title="O carregamento abre quando a ata fecha" description="Até lá, o que vai no caminhão ainda pode mudar na reunião de OS." />
      </Section>
    );
  }
  const podeEditar = pode(usuario, "ata.ajustar") && ev.status !== "CANCELADO";
  const [os, ajustes, mapa, opcoes] = await Promise.all([calcularOsAoVivo(id), obterCarregamento(id), mapaGruposPecas(), podeEditar ? opcoesReferenciasResumidas() : null]);
  const linhas = linhasCarregamento(os, ajustes);

  const porGrupo = new Map<string, LinhaCarregamento[]>();
  for (const l of linhas) {
    const g = l.codigo && l.setor ? grupoDoCodigo(mapa, l.codigo, l.setor) : "FORA";
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), l]);
  }
  const porNome = (a: LinhaCarregamento, b: LinhaCarregamento) => a.nome.localeCompare(b.nome, "pt-BR");
  const grupos: GrupoCarregamento[] = GRUPOS_MATERIAL.filter((g) => porGrupo.has(g)).map((g) => ({ chave: g, rotulo: GRUPO_LABEL[g], linhas: porGrupo.get(g)!.sort(porNome) }));
  if (porGrupo.has("FORA")) grupos.push({ chave: "FORA", rotulo: "Itens fora do catálogo", linhas: porGrupo.get("FORA")!.sort(porNome) });

  return (
    <CarregamentoTela
      eventoId={id}
      grupos={grupos}
      mudancas={mudancasCarregamento(linhas).sort(porNome)}
      podeEditar={podeEditar}
      podeExportar={pode(usuario, "os.exportar")}
      opcoesPecas={(opcoes?.pecas ?? []).map((p) => ({ value: p.id, label: p.nome, descricao: p.codigo }))}
    />
  );
}
