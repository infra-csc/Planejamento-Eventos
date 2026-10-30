import Link from "next/link";
import type { DadosPainel } from "@/server/services/dashboard";
import { statusExibicao } from "@/domain/evento";
import { diaMesHora, hojeISO, isoSP, periodoCurto, tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EventoStatusBadge } from "@/components/ui/badge";
import { EmptyState, Section } from "@/components/ui/layout";
import { LinhaLink } from "@/components/ui/linha-link";
import { Numero } from "@/components/ui/numero";
import { CaptionOculta, Th } from "@/components/ui/tabela";

type Painel = Extract<DadosPainel, { tipo: "requisitante" }>;
type EventoLinha = Painel["eventos"][number];
type Mudanca = Painel["mudancas"][number];

const ROTULO_MUDANCA = (m: Mudanca) => (m.novo ? "entrou" : m.saiu ? "saiu" : "ajuste");
const COR_MUDANCA = (m: Mudanca) => (m.novo ? "text-success" : m.saiu ? "text-danger" : "text-warning");

/** O próximo marco do evento para quem pede: a reunião (antes da ata) ou as datas do evento. */
function proximoMarco(e: EventoLinha) {
  // Reunião que passou sem começar e reunião aberta de outro dia (ata por fechar): não é "agora".
  const hoje = hojeISO();
  const diaReuniao = isoSP(e.dataReuniao);
  if (e.status === "PREPARACAO") return diaReuniao < hoje ? { texto: `Reunião não iniciada (${diaMesHora(e.dataReuniao)})`, atencao: true } : { texto: `Reunião de OS ${diaMesHora(e.dataReuniao)}`, atencao: false };
  if (e.status === "EM_REUNIAO") return { texto: diaReuniao < hoje ? "Reunião aberta, ata por fechar" : "Reunião acontecendo agora", atencao: diaReuniao < hoje };
  return { texto: `Evento ${periodoCurto(e.dataInicio, e.dataFim)}`, atencao: false };
}

/**
 * Painel do solicitante: os eventos em que a área está, uma linha por evento (nome · fase · próximo marco ·
 * itens da área). Antes eram cartões com três números grandes, a pendência e a última mudança — a pendência
 * repetia "Suas solicitações" e a mudança repetia "O que mudou", logo ao lado.
 */
export function EventosSolicitante({ eventos }: { eventos: EventoLinha[] }) {
  return (
    <Section
      titulo="Seus eventos"
      acoes={
        <Link href="/eventos" className="link text-pequeno">
          Todos os eventos
        </Link>
      }
    >
      {eventos.length === 0 ? (
        <EmptyState
          compact
          // Só entram eventos que ainda não terminaram: "ainda não está em nenhum evento" contradizia a
          // lista de solicitações, que mostra os pedidos da área em eventos já passados.
          title="Nenhum evento em andamento com pedidos da sua área"
          description="Envie as necessidades da área para um evento em preparação. Eventos que já terminaram ficam em Eventos."
          action={
            <Link href="/eventos?fase=PREPARACAO" className="link text-corpo">
              Ver eventos em preparação
            </Link>
          }
        />
      ) : (
        <div className="@container">
          <table data-responsiva className="w-full table-fixed border-collapse">
            <CaptionOculta>Seus eventos</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th>Evento</Th>
                <Th className="hidden @lg:table-cell @lg:w-[150px]">Situação</Th>
                {/* Mais espaço para o nome do evento, que cortava com colunas sobrando (auditoria 28/10, nº 28). */}
                <Th className="hidden @lg:table-cell @lg:w-[26%]">Próximo</Th>
                <Th alinhar="right" className="w-[64px]">
                  Itens<span className="sr-only"> da sua área</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const marco = proximoMarco(e);
                const status = statusExibicao(e.status, e.dataFim, hojeISO());
                return (
                  <LinhaLink key={e.id} href={`/eventos/${e.id}`} rotulo={`Abrir ${e.nome}`}>
                    <th scope="row" className="max-w-0 border-b border-line-row py-2.5 pl-cartao pr-3 text-left font-normal">
                      <span className="line-clamp-2 break-words text-corpo font-medium text-ink" title={`${e.codigo} · ${e.nome}${e.local ? ` · ${e.local}` : ""}`}>
                        {e.nome}
                      </span>
                      {/* Celular: fase e próximo marco descem para baixo do nome. */}
                      <span className="mt-1 flex min-w-0 items-center gap-2 @lg:hidden">
                        <EventoStatusBadge status={status} />
                        <span className={cn("numero truncate text-pequeno", marco.atencao ? "text-warning" : "text-ink-2")}>{marco.texto}</span>
                      </span>
                    </th>
                    <td className="hidden border-b border-line-row px-3 py-2.5 @lg:table-cell">
                      <EventoStatusBadge status={status} />
                    </td>
                    <td className="hidden max-w-0 border-b border-line-row px-3 py-2.5 @lg:table-cell">
                      <span className={cn("numero block truncate text-pequeno", marco.atencao ? "text-warning" : "text-ink-2")} title={marco.texto}>
                        {marco.texto}
                      </span>
                    </td>
                    <td className="border-b border-line-row py-2.5 pl-3 pr-cartao text-right text-corpo text-ink">
                      <Numero valor={e.meusItens} />
                    </td>
                  </LinhaLink>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function LinhaMudanca({ m }: { m: Mudanca }) {
  const contexto = [m.eventoNome, m.area, m.autor, tempoRelativo(m.quando)].filter(Boolean).join(" · ");
  return (
    <Link href={m.href} className="block border-b border-line-row px-cartao py-2.5 no-underline transition-colors duration-150 last:border-b-0 hover:bg-subtle">
      <span className="line-clamp-2 text-corpo text-ink">{m.texto}</span>
      {/* O tipo vai em palavra (não só na cor), no começo da linha de contexto. Cortada, a linha inteira fica no
          title e, no celular (sem title), desce para 2 linhas (auditoria 28/10, nº 128). */}
      <span className="mt-0.5 block text-pequeno text-muted max-md:line-clamp-2 md:truncate" title={`${ROTULO_MUDANCA(m)} · ${contexto}`}>
        <span className={cn("font-medium", COR_MUDANCA(m))}>{ROTULO_MUDANCA(m)}</span>
        {" · "}
        {contexto}
      </span>
    </Link>
  );
}

/** O que mudou nos eventos da área (inclusive de outras áreas, sem o motivo interno). Some quando não há nada. */
export function MudancasSolicitante({ mudancas }: { mudancas: Mudanca[] }) {
  if (mudancas.length === 0) return null;
  return (
    <div id="o-que-mudou" className="alvo-ancora">
      <Section titulo="O que mudou">
        {mudancas.map((m) => (
          <LinhaMudanca key={m.id} m={m} />
        ))}
      </Section>
    </div>
  );
}
