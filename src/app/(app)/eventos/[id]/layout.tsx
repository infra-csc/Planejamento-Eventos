import { notFound } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { contarItensPendentesPreReuniao, resumoAbasEvento, solicitacoesPendentes } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { pode } from "@/domain/permissions";
import { statusExibicao } from "@/domain/evento";
import { NaoEncontradoError } from "@/domain/errors";
import { diaMes, diaMesHora, diaMesISO, hojeISO, periodoCurto } from "@/lib/format";
import { Badge, EventoStatusBadge } from "@/components/ui/badge";
import { Aviso, Meta, PageHeader } from "@/components/ui/layout";
import { TabsNav, type Aba } from "@/components/ui/tabs-nav";
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
  const [resumo, pendentesPre, abertasTodas] = await Promise.all([resumoAbasEvento(usuario, id), contarItensPendentesPreReuniao(id), getDb().then((db) => solicitacoesPendentes(db, id))]);
  const abertas = pode(usuario, "solicitacao.ver_todas") ? abertasTodas : abertasTodas.filter((s) => s.areaId === usuario.areaId);
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
    ...(pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO") ? [{ href: `/conferencia/${ev.id}`, label: "Conferência da ata" }] : []),
    { href: `${base}/solicitacoes`, label: "Solicitações", n: sols.length },
    ...(pode(usuario, "os.ver") ? [{ href: `${base}/os`, label: "Ordem de serviço (OS)", n: versaoOs ? `v${versaoOs}` : null }] : []),
    { href: `${base}/historico`, label: "Histórico" },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Eventos", href: "/eventos" }, { label: `${ev.codigo} · ${ev.nome}` }]}
        eyebrow={
          <>
            <span className="font-mono">{ev.codigo}</span>
            <EventoStatusBadge status={st} />
            {ev.reabertoVezes > 0 && <Badge tom="warning">reaberto {ev.reabertoVezes}× pela gestão</Badge>}
          </>
        }
        title={ev.nome}
        meta={
          <>
            <Meta rotulo="Cliente" valor={ev.cliente || "—"} />
            <Meta rotulo="Local" valor={ev.local || "—"} />
            <Meta rotulo="Evento" valor={periodoCurto(ev.dataInicio, ev.dataFim)} mono />
            <Meta rotulo="Logística" valor={ev.responsavel.nome} />
          </>
        }
        actions={
          <AcoesEvento
            evento={{ id: ev.id, codigo: ev.codigo, nome: ev.nome, status: ev.status }}
            perfil={usuario.perfil}
            podeSolicitar={pode(usuario, "solicitacao.criar")}
            pendentesPreReuniao={pendentesPre}
            solicitacoesAbertas={abertas.map((s) => s.codigo)}
          />
        }
      />

      {ev.status === "CANCELADO" && (
        <Aviso tom="danger" titulo="Evento cancelado" className="mb-cartao">
          {ev.canceladoMotivo ?? "Sem motivo registrado."}
        </Aviso>
      )}

      <LinhaTempo status={ev.status} passos={passos} />
      <TabsNav tabs={abas} />
      {children}
    </>
  );
}
