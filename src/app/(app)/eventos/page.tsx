import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarEventos, type EventoLista } from "@/server/services/eventos";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL, statusExibicao } from "@/domain/evento";
import { diaMesHora, diaMesISO, hojeISO, periodoCurto } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { EventoStatusBadge } from "@/components/ui/badge";
import { PageHeader, RotuloGrupo } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { BuscaUrl } from "@/components/ui/busca-url";
import { CaptionOculta } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { BarrasFase } from "@/components/eventos/fases";

export const metadata: Metadata = { title: "Eventos" };

const FASES = [
  ["TODOS", "Todos"],
  ["PREPARACAO", "Preparação"],
  ["EM_REUNIAO", "Em reunião"],
  ["ABERTO", "Aberto"],
  ["ENCERRADO", "Encerrado"],
  ["REALIZADO", "Realizados"],
  ["CANCELADO", "Cancelado"],
] as const;

function marco(e: EventoLista) {
  if (e.status === "PREPARACAO") return `reunião ${diaMesHora(e.dataReuniao)}`;
  if (e.status === "EM_REUNIAO") return "reunião agora";
  if (e.status === "ABERTO") return e.dataCarga ? `carga ${diaMesISO(e.dataCarga)}` : "sem data de carga";
  if (e.status === "CANCELADO") return "cancelado";
  return e.versaoOs ? `OS final v${e.versaoOs}` : "sem OS";
}

function Linha({ e, hoje }: { e: EventoLista; hoje: string }) {
  const st = statusExibicao(e.status, e.dataFim, hoje);
  const rotulo = st === "REALIZADO" ? "Realizado" : EVENTO_STATUS_LABEL[st];
  return (
    <LinhaLink href={`/eventos/${e.id}`} rotulo={`Abrir ${e.codigo} — ${e.nome}`}>
      <th scope="row" className="border-b border-line-row px-[18px] py-3.5 text-left font-normal">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-medium text-ink">{e.nome}</span>
          <EventoStatusBadge status={st} />
          {e.reabertoVezes > 0 && <span className="rounded-[5px] bg-warning-bg px-[7px] py-px text-[11px] font-medium text-warning">reaberto {e.reabertoVezes}×</span>}
        </span>
        <span className="mt-[3px] block text-[12.5px] text-muted">
          <span className="font-mono">{e.codigo}</span> · {[e.cliente, e.local].filter(Boolean).join(" · ")}
        </span>
      </th>
      <td className="w-[148px] border-b border-line-row px-2.5 py-3.5">
        <BarrasFase status={e.status} rotuloStatus={rotulo} />
      </td>
      <td className="w-[150px] border-b border-line-row px-2.5 py-3.5">
        <span className="block font-mono text-[12.5px] text-ink">{periodoCurto(e.dataInicio, e.dataFim)}</span>
        <span className="block text-[11.5px] text-muted">{marco(e)}</span>
      </td>
      <td className="w-[130px] border-b border-line-row py-3.5 pl-2.5 pr-[18px] text-right">
        <span className={e.solicitacoesAbertas > 0 ? "block text-[12.5px] font-medium text-warning" : "block text-[12.5px] font-medium text-meta"}>
          {e.solicitacoesAbertas > 0 ? `${e.solicitacoesAbertas} aguardando` : "—"}
        </span>
        <span className="block text-[11.5px] text-meta">{e.responsavel.nome}</span>
      </td>
    </LinhaLink>
  );
}

export default async function EventosPage({ searchParams }: { searchParams: Promise<{ q?: string; fase?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const hoje = hojeISO();
  const todos = await listarEventos(usuario);
  const fase = FASES.some(([v]) => v === sp.fase) ? sp.fase! : "TODOS";
  const termo = (sp.q ?? "").trim().toLowerCase();

  const filtrados = todos.filter((e) => {
    if (fase !== "TODOS" && statusExibicao(e.status, e.dataFim, hoje) !== fase) return false;
    if (!termo) return true;
    return `${e.nome} ${e.codigo} ${e.cliente} ${e.local}`.toLowerCase().includes(termo);
  });

  const grupos: Array<{ titulo: string; teste: (e: EventoLista) => boolean }> = [
    { titulo: "Exige ação agora", teste: (e) => e.status === "EM_REUNIAO" || (e.solicitacoesAbertas > 0 && e.status !== "CANCELADO") },
    { titulo: "Em andamento", teste: (e) => e.status === "PREPARACAO" || e.status === "ABERTO" },
    { titulo: "Encerrados e cancelados", teste: () => true },
  ];
  const usados = new Set<string>();
  const secoes = grupos
    .map((g) => {
      const lista = filtrados.filter((e) => !usados.has(e.id) && g.teste(e));
      lista.forEach((e) => usados.add(e.id));
      return { titulo: g.titulo, lista };
    })
    .filter((g) => g.lista.length > 0);

  const params = { q: sp.q, fase: sp.fase };

  return (
    <>
      <PageHeader
        title="Eventos"
        description="A fase do evento define o que cada área pode fazer. Tudo que exige ação sua aparece em destaque na linha."
        actions={
          pode(usuario, "evento.criar") && (
            <ButtonLink href="/eventos/novo" variant="primary" size="lg" className="no-underline">
              Novo evento
            </ButtonLink>
          )
        }
      />

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <BuscaUrl placeholder="Buscar por nome, código, cliente ou local" />
        <Pills
          rotulo="Filtrar por fase"
          itens={FASES.map(([v, label]) => ({
            label,
            n: v === "TODOS" ? todos.length : todos.filter((e) => statusExibicao(e.status, e.dataFim, hoje) === v).length,
            href: hrefCom("/eventos", params, { fase: v === "TODOS" ? null : v }),
            ativo: fase === v,
          }))}
        />
      </div>

      {secoes.map((g) => (
        <section key={g.titulo} className="mb-[22px]">
          <RotuloGrupo contagem={`${g.lista.length} ${g.lista.length === 1 ? "evento" : "eventos"}`}>{g.titulo}</RotuloGrupo>
          <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
            <table className="w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
              <CaptionOculta>{g.titulo}</CaptionOculta>
              <tbody>
                {g.lista.map((e) => (
                  <Linha key={e.id} e={e} hoje={hoje} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {secoes.length === 0 && (
        <div className="rounded-[10px] border border-line bg-surface p-14 text-center">
          <p className="m-0 text-[14px] font-medium">{todos.length === 0 ? "Nenhum evento cadastrado" : "Nenhum evento corresponde aos filtros"}</p>
          <p className="mt-[5px] text-[13px] text-muted">{todos.length === 0 ? "Quando a logística criar um evento, ele aparece aqui." : "Ajuste a busca ou volte para todas as fases."}</p>
        </div>
      )}
    </>
  );
}
