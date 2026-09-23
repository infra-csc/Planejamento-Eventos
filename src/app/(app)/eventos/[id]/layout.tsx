import { notFound } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { contarItensPendentesPreReuniao, resumoAbasEvento, solicitacoesPendentes } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { pode } from "@/domain/permissions";
import { statusExibicao } from "@/domain/evento";
import { NaoEncontradoError } from "@/domain/errors";
import { diaMes, diaMesHora, diaMesISO, hojeISO, periodoCurto } from "@/lib/format";
import { EventoStatusBadge, Tag } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Aviso, PageHeader } from "@/components/ui/layout";
import { TabsNav, type Aba } from "@/components/ui/tabs-nav";
import { LinhaTempo } from "@/components/eventos/fases";
import { AcoesEvento } from "@/components/eventos/acoes-evento";
import { obterConfiguracoesCache } from "@/server/cache";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  // `template`: páginas com título próprio (Editar evento) ganham o código do evento e o sufixo do app.
  return ev ? { title: { default: `${ev.codigo} ${ev.nome}`, template: `%s · ${ev.codigo} · Norte Mkt` } } : { title: "Evento" };
}

const plural = (n: number, s: string, p: string) => (n === 0 ? null : `${n} ${n === 1 ? s : p}`);

/** Um metadado do cabeçalho: ícone + valor, em linha. O rótulo vai no `title` e para o leitor de tela. */
function MetaIcone({ icone, rotulo, children, numero }: { icone: NomeIcone; rotulo: string; children: React.ReactNode; numero?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-pequeno text-ink-2" title={rotulo}>
      <Icone nome={icone} className="shrink-0 text-ink-3" />
      <span className="sr-only">{rotulo}: </span>
      <span className={numero ? "numero" : "truncate"}>{children}</span>
    </span>
  );
}

export default async function EventoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  // Só contagens: este layout roda em todas as abas do evento.
  const [resumo, pendentesPre, abertasTodas, cfg] = await Promise.all([resumoAbasEvento(usuario, id), contarItensPendentesPreReuniao(id), getDb().then((db) => solicitacoesPendentes(db, id)), obterConfiguracoesCache()]);
  const abertas = pode(usuario, "solicitacao.ver_todas") ? abertasTodas : abertasTodas.filter((s) => s.areaId === usuario.areaId);
  const st = statusExibicao(ev.status, ev.dataFim, hojeISO());
  const base = `/eventos/${ev.id}`;
  const { versaoOs, preEnviadas } = resumo;
  const nLinhas = resumo.linhas;
  const alteracoesAbertas = abertas.filter((s) => s.tipo === "ALTERACAO").length;

  const passos = [
    {
      titulo: "Preparação",
      quando: `envios até ${diaMes(ev.dataReuniao)}`,
      detalhe: plural(preEnviadas, "solicitação pré-reunião", "solicitações pré-reunião") ?? "nenhuma solicitação pré-reunião",
    },
    {
      titulo: "Reunião de OS",
      quando: diaMesHora(ev.dataReuniao),
      detalhe: ev.ataFechadaEm ? `ata fechada com ${nLinhas} ${nLinhas === 1 ? "linha" : "linhas"}` : ev.status === "EM_REUNIAO" ? "acontecendo agora" : "aguardando",
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
      quando: ev.encerradoEm ? diaMes(ev.encerradoEm) : `evento ${diaMesISO(ev.dataInicio)}`,
      detalhe: ev.encerradoEm ? `OS final v${versaoOs}` : "nada entra depois disso",
    },
  ];

  const abas: Aba[] = [
    { href: base, label: "Visão geral", exact: true },
    { href: `${base}/ata`, label: "Ata", n: nLinhas },
    ...(pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO") ? [{ href: `/conferencia/${ev.id}`, label: "Conferência" }] : []),
    { href: `${base}/solicitacoes`, label: "Solicitações", n: resumo.solicitacoes },
    ...(pode(usuario, "os.ver") ? [{ href: `${base}/os`, label: "OS", n: versaoOs ? `v${versaoOs}` : null }] : []),
    { href: `${base}/historico`, label: "Histórico" },
  ];

  return (
    <>
      <PageHeader
        className="!mb-4"
        breadcrumbs={[{ label: "Eventos", href: "/eventos" }, { label: `${ev.codigo} · ${ev.nome}` }]}
        eyebrow={
          <>
            <Codigo className="text-ink-3">{ev.codigo}</Codigo>
            <EventoStatusBadge status={st} />
            {ev.reabertoVezes > 0 && <Tag tom="warning">reaberto {ev.reabertoVezes}×</Tag>}
          </>
        }
        title={ev.nome}
        meta={
          <>
            <MetaIcone icone="calendario" rotulo="Data do evento" numero>
              {periodoCurto(ev.dataInicio, ev.dataFim)}
            </MetaIcone>
            {ev.cliente && (
              <MetaIcone icone="usuario" rotulo="Cliente">
                {ev.cliente}
              </MetaIcone>
            )}
            {ev.local && (
              <MetaIcone icone="local" rotulo="Local">
                {ev.local}
              </MetaIcone>
            )}
            <MetaIcone icone="caixa" rotulo="Responsável na logística">
              {ev.responsavel.nome}
            </MetaIcone>
          </>
        }
        actions={
          <AcoesEvento
            evento={{ id: ev.id, codigo: ev.codigo, nome: ev.nome, status: ev.status }}
            perfil={usuario.perfil}
            podeSolicitar={pode(usuario, "solicitacao.criar")}
            pendentesPreReuniao={pendentesPre}
            solicitacoesAbertas={abertas.map((s) => s.codigo)}
            bloquearEncerramentoComPendentes={cfg.bloquear_encerramento_com_pendentes === "true"}
          />
        }
      />

      {ev.status === "CANCELADO" && (
        <Aviso tom="danger" titulo="Evento cancelado" className="mb-4">
          {ev.canceladoMotivo ?? "Sem motivo registrado."}
        </Aviso>
      )}

      <LinhaTempo status={ev.status} passos={passos} />
      <TabsNav tabs={abas} />
      {children}
    </>
  );
}
