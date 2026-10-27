import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterHistoricoEvento } from "@/server/services/eventos";
import { classificarHistorico } from "@/domain/historico";
import { EmptyState, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { iconeHistorico, LinhaTempoAgrupada } from "@/components/eventos/linha-tempo-agrupada";

export const metadata: Metadata = { title: "Histórico" };

/** Itens da ata/OS e solicitações têm página própria: o registro leva até ela. */
const hrefDe = (eventoId: string, h: { entidade: string; entidadeId: string | null }, abreSolicitacao: boolean) =>
  h.entidade === "evento_item" && h.entidadeId ? `/eventos/${eventoId}/itens/${h.entidadeId}` : abreSolicitacao && h.entidade === "solicitacao" && h.entidadeId ? `/solicitacoes/${h.entidadeId}` : undefined;

/**
 * Filtros do histórico pelo assunto do registro. Um evento passa de 50 registros na primeira semana: quem procura
 * "quem mexeu nesta quantidade" ou "quando a SOL-0005 foi devolvida" não precisa ler as fases e a carga junto.
 */
const FILTROS = [
  { chave: "todos", rotulo: "Tudo", entidades: null },
  { chave: "itens", rotulo: "Itens e ajustes", entidades: ["evento_item"] },
  { chave: "solicitacoes", rotulo: "Solicitações", entidades: ["solicitacao", "solicitacao_item"] },
  { chave: "fases", rotulo: "Fases e OS", entidades: ["evento"] },
  { chave: "outros", rotulo: "Carga, arena e ativação", entidades: [] },
] as const;
type Filtro = (typeof FILTROS)[number]["chave"];
const CONHECIDAS: readonly string[] = FILTROS.flatMap((f) => f.entidades ?? []);
const doFiltro = (f: (typeof FILTROS)[number], entidade: string) => (f.entidades == null ? true : f.entidades.length === 0 ? !CONHECIDAS.includes(entidade) : (f.entidades as readonly string[]).includes(entidade));

export default async function HistoricoEventoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const historico = await obterHistoricoEvento(usuario, id);
  // Quem não vê tudo já recebe só as solicitações da própria área; quem vê tudo abre só se vê todas as solicitações.
  const abreSolicitacao = pode(usuario, "solicitacao.ver_todas") || !pode(usuario, "historico.ver_tudo");
  const filtro = FILTROS.find((f) => f.chave === (sp.tipo as Filtro)) ?? FILTROS[0];
  const visiveis = historico.filter((h) => doFiltro(filtro, h.entidade));
  // Só os assuntos que existem neste evento (e sempre "Tudo").
  const pilulas = FILTROS.map((f) => ({ f, n: historico.filter((h) => doFiltro(f, h.entidade)).length })).filter(({ f, n }) => f.chave === "todos" || n > 0);
  return (
    <Section titulo="Histórico do evento" sub={`${historico.length} ${historico.length === 1 ? "registro" : "registros"} · tudo que mudou a ata ou a OS, com autor, hora e motivo`} className="max-w-[840px]">
      {pilulas.length > 2 && (
        <div className="overflow-x-auto border-b border-line-soft px-cartao py-2.5">
          <Pills
            rotulo="Filtrar o histórico"
            className="max-md:flex-nowrap"
            itens={pilulas.map(({ f, n }) => ({ label: f.rotulo, n, ativo: f.chave === filtro.chave, href: f.chave === "todos" ? `/eventos/${id}/historico` : `/eventos/${id}/historico?tipo=${f.chave}` }))}
          />
        </div>
      )}
      <LinhaTempoAgrupada
        vazio={
          filtro.chave === "todos" ? (
            <EmptyState compact title="Nada registrado ainda" description="Envios, respostas, ajustes na ata e mudanças de fase aparecem aqui." />
          ) : (
            <EmptyState compact title="Nenhum registro deste tipo" description="Escolha “Tudo” para ver o histórico completo do evento." />
          )
        }
        entradas={visiveis.map((h) => {
          const c = classificarHistorico(h);
          return { id: h.id, em: h.criadoEm, titulo: c.titulo, detalhe: c.detalhe || null, autor: h.usuario?.nome ?? null, href: hrefDe(id, h, abreSolicitacao), ...iconeHistorico(h.entidade, h.acao) };
        })}
      />
    </Section>
  );
}
