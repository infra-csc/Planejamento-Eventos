import Link from "next/link";
import type { DadosPainel } from "@/server/services/dashboard";
import { statusExibicao } from "@/domain/evento";
import { diaMesHora, hojeISO, periodoCurto, tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EventoStatusBadge } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { EmptyState, Marcador, Section } from "@/components/ui/layout";
import { Codigo, Numero } from "@/components/ui/numero";

type Painel = Extract<DadosPainel, { tipo: "requisitante" }>;
type EventoCartao = Painel["eventos"][number];
type Mudanca = Painel["mudancas"][number];

const TOM_MUDANCA = (m: Mudanca) => (m.novo ? "success" : m.saiu ? "danger" : "warning") as "success" | "danger" | "warning";
const ROTULO_MUDANCA = (m: Mudanca) => (m.novo ? "entrou" : m.saiu ? "saiu" : "ajuste");

function Numeral({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <span className="min-w-0">
      <Numero valor={valor} className="block text-titulo font-semibold text-ink" />
      <span className="block text-rotulo text-muted">{rotulo}</span>
    </span>
  );
}

/**
 * Um cartão por evento: fase (o único selo), próximo marco, o que a área tem lá dentro e, em destaque
 * no rodapé, o que mudou por último. O rodapé é o único bloco colorido do cartão.
 */
function Cartao({ e, mudancas }: { e: EventoCartao; mudancas: Mudanca[] }) {
  const proximo: { icone: NomeIcone; texto: string } =
    e.status === "PREPARACAO"
      ? { icone: "calendario", texto: `Reunião de OS ${diaMesHora(e.dataReuniao)}` }
      : e.status === "EM_REUNIAO"
        ? { icone: "relogio", texto: "Reunião acontecendo agora" }
        : { icone: "calendario", texto: `Evento ${periodoCurto(e.dataInicio, e.dataFim)}` };
  const pendencia =
    e.rascunhos > 0
      ? { icone: "alerta" as const, cor: "text-danger", texto: `${e.rascunhos} ${e.rascunhos === 1 ? "rascunho ou devolvida" : "rascunhos ou devolvidas"}` }
      : e.aguardando > 0
        ? { icone: "relogio" as const, cor: "text-warning", texto: `${e.aguardando} aguardando a logística` }
        : null;
  const ultima = mudancas[0];
  return (
    <Link href={`/eventos/${e.id}`} className="group flex flex-col overflow-hidden rounded-cartao border border-line bg-surface no-underline transition-colors hover:border-line-strong">
      <div className="flex flex-col gap-3 px-4 pb-3.5 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-destaque font-semibold text-ink group-hover:underline">{e.nome}</span>
            <span className="mt-0.5 block truncate text-pequeno text-muted">
              <Codigo>{e.codigo}</Codigo>
              {e.local ? ` · ${e.local}` : ""}
            </span>
          </div>
          <EventoStatusBadge status={statusExibicao(e.status, e.dataFim, hojeISO())} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Numeral valor={e.meusItens} rotulo={e.meusItens === 1 ? "item da área" : "itens da área"} />
          <Numeral valor={e.itensNoEvento} rotulo="no evento" />
          <Numeral valor={e.depoisDaAta} rotulo={e.ataFechada ? "após a ata" : "ata aberta"} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-pequeno text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Icone nome={proximo.icone} className="text-ink-3" />
            <span className="numero">{proximo.texto}</span>
          </span>
          {pendencia && (
            <span className="inline-flex items-center gap-1.5">
              <Icone nome={pendencia.icone} className={pendencia.cor} />
              {pendencia.texto}
            </span>
          )}
        </div>
      </div>

      {/* "O que mudou": o destaque do cartão. Sem mudança, uma linha neutra. */}
      {ultima ? (
        <div className="mt-auto flex items-start gap-2.5 border-t border-info-border bg-info-bg px-4 py-2.5">
          <Icone nome="camadas" className="mt-0.5 text-info" />
          <span className="min-w-0 flex-1">
            <span className="block text-rotulo font-medium text-info">
              {mudancas.length === 1 ? "Mudou" : `${mudancas.length} mudanças`} · {tempoRelativo(ultima.quando)}
            </span>
            <span className="line-clamp-2 text-pequeno text-ink">
              <span className="font-medium">{ROTULO_MUDANCA(ultima)}:</span> {ultima.texto}
            </span>
          </span>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2 border-t border-line-soft px-4 py-2.5 text-pequeno text-muted">
          <Icone nome="check" className="text-ink-3" />
          Sem mudanças recentes
        </div>
      )}
    </Link>
  );
}

/** Painel do solicitante: um cartão por evento em que a área está. */
export function EventosSolicitante({ eventos, mudancas }: { eventos: EventoCartao[]; mudancas: Mudanca[] }) {
  const porEvento = new Map<string, Mudanca[]>();
  for (const m of mudancas) porEvento.set(m.eventoId, [...(porEvento.get(m.eventoId) ?? []), m]);
  return (
    <section aria-labelledby="painel-eventos">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 id="painel-eventos" className="m-0 text-secao font-semibold tracking-[-0.01em] text-ink">
          Seus eventos
        </h2>
        <Link href="/eventos" className="link text-pequeno">
          Todos os eventos
        </Link>
      </div>
      {eventos.length === 0 ? (
        <div className="rounded-cartao border border-line bg-surface">
          <EmptyState
            compact
            title="Sua área ainda não está em nenhum evento"
            description="Envie as necessidades da área para um evento em preparação."
            action={
              <Link href="/eventos?fase=PREPARACAO" className="link text-corpo">
                Ver eventos em preparação
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {eventos.map((e) => (
            <Cartao key={e.id} e={e} mudancas={porEvento.get(e.id) ?? []} />
          ))}
        </div>
      )}
    </section>
  );
}

function LinhaMudanca({ m }: { m: Mudanca }) {
  return (
    <Link href={m.href} className="flex items-start gap-3 border-b border-line-row px-cartao py-2.5 no-underline last:border-b-0 hover:bg-subtle">
      <Marcador tom={TOM_MUDANCA(m)} />
      <span className="min-w-0 flex-1">
        <span className="block text-corpo text-ink">{m.texto}</span>
        <span className="mt-0.5 block text-pequeno text-muted">
          {[m.eventoNome, m.area, m.autor, tempoRelativo(m.quando)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className={cn("shrink-0 text-rotulo font-medium", m.novo ? "text-success" : m.saiu ? "text-danger" : "text-warning")}>{ROTULO_MUDANCA(m)}</span>
    </Link>
  );
}

/** Linha do tempo das mudanças nos eventos da área (inclusive de outras áreas, sem o motivo interno). */
export function MudancasSolicitante({ mudancas }: { mudancas: Mudanca[] }) {
  return (
    <div id="o-que-mudou" className="scroll-mt-topo-fixo">
      <Section titulo="O que mudou" sub="Itens que entraram, saíram ou foram ajustados.">
        {mudancas.length === 0 ? (
          <EmptyState compact title="Nenhuma mudança recente" description="Ajustes da logística aparecem aqui assim que acontecem." />
        ) : (
          mudancas.map((m) => <LinhaMudanca key={m.id} m={m} />)
        )}
      </Section>
    </div>
  );
}
