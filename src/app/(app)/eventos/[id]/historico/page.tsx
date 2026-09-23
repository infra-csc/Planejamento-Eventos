import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento } from "@/server/services/eventos";
import { classificarHistorico } from "@/domain/historico";
import { EmptyState, Section } from "@/components/ui/layout";
import { iconeHistorico, LinhaTempoAgrupada } from "@/components/eventos/linha-tempo-agrupada";

export const metadata: Metadata = { title: "Histórico" };

/** Itens da ata/OS têm página própria: o registro de um item leva até ela. */
const hrefDe = (eventoId: string, h: { entidade: string; entidadeId: string | null }) => (h.entidade === "evento_item" && h.entidadeId ? `/eventos/${eventoId}/itens/${h.entidadeId}` : undefined);

export default async function HistoricoEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const historico = await obterHistoricoEvento(usuario, id);
  return (
    <Section titulo="Histórico do evento" sub={`${historico.length} ${historico.length === 1 ? "registro" : "registros"} · tudo que mudou a ata ou a OS, com autor, hora e motivo`} className="max-w-[840px]">
      <LinhaTempoAgrupada
        vazio={<EmptyState compact title="Nada registrado ainda" description="Envios, respostas, ajustes na ata e mudanças de fase aparecem aqui." />}
        entradas={historico.map((h) => {
          const c = classificarHistorico(h);
          return { id: h.id, em: h.criadoEm, titulo: c.titulo, detalhe: c.detalhe || null, autor: h.usuario?.nome ?? null, href: hrefDe(id, h), ...iconeHistorico(h.entidade, h.acao) };
        })}
      />
    </Section>
  );
}
