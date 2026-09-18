import Link from "next/link";
import type { DadosPainel } from "@/server/services/dashboard";
import { statusExibicao } from "@/domain/evento";
import { diaMesHora, hojeISO, periodoCurto, tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ChipMono, EventoStatusBadge, Tag } from "@/components/ui/badge";
import { EmptyState, Marcador, Section } from "@/components/ui/layout";

type Painel = Extract<DadosPainel, { tipo: "requisitante" }>;
type EventoCartao = Painel["eventos"][number];
type Mudanca = Painel["mudancas"][number];

/** Um cartão por evento: fase, datas, o que a área tem lá dentro e o que mudou desde a ata. */
function Cartao({ e }: { e: EventoCartao }) {
  const proximo = e.status === "PREPARACAO" ? `reunião ${diaMesHora(e.dataReuniao)}` : e.status === "EM_REUNIAO" ? "reunião acontecendo" : e.status === "ABERTO" ? `evento ${periodoCurto(e.dataInicio, e.dataFim)}` : `evento ${periodoCurto(e.dataInicio, e.dataFim)}`;
  const alerta = e.rascunhos > 0 ? { texto: `${e.rascunhos} ${e.rascunhos === 1 ? "rascunho ou devolvida" : "rascunhos ou devolvidas"}`, tom: "danger" as const } : e.aguardando > 0 ? { texto: `${e.aguardando} aguardando a logística`, tom: "warning" as const } : null;
  return (
    <Link href={`/eventos/${e.id}`} className="flex flex-col gap-2.5 rounded-cartao border border-line bg-surface px-4 py-3.5 no-underline transition-colors hover:border-accent-border hover:bg-subtle">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-destaque font-semibold leading-[1.25] text-ink">{e.nome}</span>
          <span className="mt-0.5 block text-pequeno text-muted">
            <span className="font-mono">{e.codigo}</span>
            {e.local ? ` · ${e.local}` : ""}
          </span>
        </div>
        <EventoStatusBadge status={statusExibicao(e.status, e.dataFim, hojeISO())} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <span>
          <span className="block font-mono text-titulo font-medium leading-none text-ink">{e.meusItens}</span>
          <span className="mt-1 block text-rotulo text-muted">{e.meusItens === 1 ? "item da sua área" : "itens da sua área"}</span>
        </span>
        <span>
          <span className="block font-mono text-titulo font-medium leading-none text-ink">{e.itensNoEvento}</span>
          <span className="mt-1 block text-rotulo text-muted">no evento todo</span>
        </span>
        <span>
          <span className={cn("block font-mono text-titulo font-medium leading-none", e.depoisDaAta > 0 ? "text-accent" : "text-ink")}>{e.depoisDaAta}</span>
          <span className="mt-1 block text-rotulo text-muted">{e.ataFechada ? "depois da ata" : "ata em construção"}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-pequeno text-ink-3">
        <span>{proximo}</span>
        {alerta && <Tag tom={alerta.tom}>{alerta.texto}</Tag>}
      </div>
    </Link>
  );
}

function LinhaMudanca({ m }: { m: Mudanca }) {
  return (
    <Link href={m.href} className="flex items-start gap-3 border-b border-line-row px-cartao py-2.5 no-underline last:border-b-0 hover:bg-subtle">
      <Marcador tom={m.novo ? "success" : m.saiu ? "danger" : "warning"} />
      <span className="min-w-0 flex-1">
        <span className="block text-corpo leading-[1.4] text-ink">{m.texto}</span>
        <span className="mt-0.5 block text-pequeno text-muted">
          {m.eventoNome}
          {m.area ? ` · ${m.area}` : ""}
          {m.autor ? ` · ${m.autor}` : ""} · {tempoRelativo(m.quando)}
        </span>
      </span>
      <ChipMono tom={m.novo ? "success" : m.saiu ? "danger" : "warning"}>{m.novo ? "novo" : m.saiu ? "saiu" : "ajuste"}</ChipMono>
    </Link>
  );
}

/** Painel do solicitante: os eventos em que a área está e o que mudou neles. */
export function EventosSolicitante({ eventos, mudancas }: { eventos: EventoCartao[]; mudancas: Mudanca[] }) {
  return (
    <>
      <div>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-secao font-semibold text-ink">Seus eventos</h2>
          <Link href="/eventos" className="link text-pequeno">
            Todos os eventos
          </Link>
        </div>
        {eventos.length === 0 ? (
          <div className="rounded-cartao border border-line bg-surface">
            <EmptyState compact title="Sua área ainda não tem itens em nenhum evento" description="Quando um evento estiver em preparação, envie as necessidades da área e ele aparece aqui." action={<Link href="/eventos?fase=PREPARACAO" className="link">Ver eventos em preparação</Link>} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {eventos.map((e) => (
              <Cartao key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>

      <Section titulo="O que mudou nos seus eventos" sub="Itens que entraram, saíram ou foram ajustados depois do pedido — inclusive os de outras áreas.">
        {mudancas.length === 0 ? <EmptyState compact title="Nenhuma mudança recente" description="Ajustes e inclusões da logística aparecem aqui assim que acontecem." /> : mudancas.map((m) => <LinhaMudanca key={m.id} m={m} />)}
      </Section>
    </>
  );
}
