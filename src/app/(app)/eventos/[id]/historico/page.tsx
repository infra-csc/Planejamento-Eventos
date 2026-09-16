import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento } from "@/server/services/eventos";
import { classificarHistorico, COR_HISTORICO } from "@/domain/historico";
import { diaMesHora } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EmptyState, Section } from "@/components/ui/layout";

export default async function HistoricoEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const historico = await obterHistoricoEvento(usuario, id);
  return (
    <Section titulo="Histórico do evento" sub="Tudo que mudou a ata ou a OS, com autor, hora e justificativa." className="max-w-[840px]">
      <div className="px-[18px] py-4">
        {historico.length === 0 && <EmptyState compact title="Nada registrado ainda" description="Envios, respostas, ajustes na ata e mudanças de fase aparecem aqui." />}
        {historico.map((h) => {
          const c = classificarHistorico(h);
          return (
            <div key={h.id} className="flex gap-3.5 border-b border-line-faint py-2.5 last:border-b-0">
              <span className="shrink-0 basis-[78px] pt-0.5 font-mono text-[11.5px] text-meta">{diaMesHora(h.criadoEm)}</span>
              <span aria-hidden className={cn("mt-[7px] block size-[7px] shrink-0", c.tipo === "marco" ? "rounded-[2px]" : "rounded-full")} style={{ background: COR_HISTORICO[c.tipo] }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] text-ink">{c.titulo}</span>
                {c.detalhe && <span className="mt-px block text-[12.5px] text-ink-3">{c.detalhe}</span>}
                <span className="mt-0.5 block text-[11.5px] text-meta">{h.usuario?.nome ?? "Sistema"}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
