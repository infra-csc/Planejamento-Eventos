import { notFound } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { contarItensPendentesPreReuniao, resumoAbasEvento, solicitacoesPendentes } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { pode } from "@/domain/permissions";
import { statusExibicao } from "@/domain/evento";
import { NaoEncontradoError } from "@/domain/errors";
import { diaMes, diaMesHora, diaMesISO, hojeISO, periodoCurto } from "@/lib/format";
import { EventoStatusBadge } from "@/components/ui/badge";
import { Aviso } from "@/components/ui/layout";
import { TabsNav, type Aba } from "@/components/ui/tabs-nav";
import { DefinirTrilha } from "@/components/shell/trilha";
import { LinhaTempo } from "@/components/eventos/fases";
import { AcoesEvento } from "@/components/eventos/acoes-evento";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  // `template`: páginas com título próprio (Editar evento) ganham o código do evento e o sufixo do app.
  return ev ? { title: { default: `${ev.codigo} ${ev.nome}`, template: `%s · ${ev.codigo} · Norte Mkt` } } : { title: "Evento" };
}

const plural = (n: number, s: string, p: string) => (n === 0 ? null : `${n} ${n === 1 ? s : p}`);

export default async function EventoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  // Só contagens: este layout roda em todas as abas do evento.
  const [resumo, pendentesPre, abertas] = await Promise.all([resumoAbasEvento(usuario, id), contarItensPendentesPreReuniao(id), solicitacoesPendentes(await getDb(), id)]);
  const st = statusExibicao(ev.status, ev.dataFim, hojeISO());
  const base = `/eventos/${ev.id}`;
  const { versaoOs, preEnviadas } = resumo;
  const linhas = { length: resumo.linhas };
  const sols = { length: resumo.solicitacoes };
  const alteracoesAbertas = abertas.filter((s) => s.tipo === "ALTERACAO").length;

  const passos = [
    {
      titulo: "Preparação",
      quando: `áreas enviam até ${diaMes(ev.dataReuniao)}`,
      detalhe: plural(preEnviadas, "solicitação pré-reunião", "solicitações pré-reunião") ?? "nenhuma solicitação pré-reunião",
    },
    {
      titulo: "Reunião de OS",
      quando: diaMesHora(ev.dataReuniao),
      detalhe: ev.ataFechadaEm ? `ata fechada com ${linhas.length} ${linhas.length === 1 ? "linha" : "linhas"}` : ev.status === "EM_REUNIAO" ? "acontecendo agora" : "aguardando",
    },
    {
      titulo: "Aberto a alterações",
      quando: ev.ataFechadaEm ? `desde ${diaMes(ev.ataFechadaEm)}` : "depois da reunião",
      detalhe:
        ev.status === "ABERTO"
          ? (plural(alteracoesAbertas, "alteração em aberto", "alterações em aberto") ?? "nenhuma alteração em aberto")
          : ev.ataFechadaEm
            ? "encerrado para novas"
            : ev.janelaAlteracoesAte
              ? `janela até ${diaMesISO(ev.janelaAlteracoesAte)}`
              : "abre com o fechamento da ata",
    },
    {
      titulo: "Encerrado",
      quando: ev.encerradoEm ? diaMes(ev.encerradoEm) : `evento em ${diaMesISO(ev.dataInicio)}`,
      detalhe: ev.encerradoEm ? `OS final v${versaoOs}` : "nada entra depois disso",
    },
  ];

  const abas: Aba[] = [
    { href: base, label: "Visão geral", exact: true },
    { href: `${base}/ata`, label: "Ata", n: linhas.length },
    ...(pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO") ? [{ href: `${base}/reuniao`, label: "Consolidar ata" }] : []),
    { href: `${base}/solicitacoes`, label: "Solicitações", n: sols.length },
    ...(pode(usuario, "os.ver") ? [{ href: `${base}/os`, label: "OS", n: versaoOs ? `v${versaoOs}` : null }] : []),
    { href: `${base}/historico`, label: "Histórico" },
  ];

  return (
    <>
      <DefinirTrilha itens={[{ label: "Eventos", href: "/eventos" }, { label: `${ev.codigo} · ${ev.nome}` }]} />
      <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[12.5px] text-muted">{ev.codigo}</span>
            <EventoStatusBadge status={st} />
            {ev.reabertoVezes > 0 && <span className="rounded-[5px] bg-warning-bg px-[7px] py-px text-[11px] font-medium text-warning">reaberto {ev.reabertoVezes}× pela gestão</span>}
          </div>
          <h1 className="mb-0 mt-1 text-[24px] font-semibold leading-[1.2] tracking-[-0.025em]">{ev.nome}</h1>
          <dl className="mt-2 flex flex-wrap gap-x-[26px] gap-y-1 text-[13px] text-ink">
            {(
              [
                ["Cliente", ev.cliente || "—", false],
                ["Local", ev.local || "—", false],
                ["Evento", periodoCurto(ev.dataInicio, ev.dataFim), true],
                ["Logística", ev.responsavel.nome, false],
              ] as const
            ).map(([rotulo, valor, mono]) => (
              <div key={rotulo} className="flex items-baseline gap-[5px]">
                <dt className="text-[12.5px] text-muted">{rotulo}</dt>
                <dd className={mono ? "m-0 font-mono" : "m-0"}>{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <AcoesEvento
            evento={{ id: ev.id, codigo: ev.codigo, nome: ev.nome, status: ev.status }}
            perfil={usuario.perfil}
            podeSolicitar={pode(usuario, "solicitacao.criar")}
            pendentesPreReuniao={pendentesPre}
            solicitacoesAbertas={abertas.map((s) => s.codigo)}
          />
        </div>
      </div>

      {ev.status === "CANCELADO" && (
        <Aviso tom="danger" titulo="Evento cancelado" className="mb-[18px]">
          {ev.canceladoMotivo ?? "Sem motivo registrado."}
        </Aviso>
      )}

      <LinhaTempo status={ev.status} passos={passos} />
      <TabsNav tabs={abas} />
      {children}
    </>
  );
}
