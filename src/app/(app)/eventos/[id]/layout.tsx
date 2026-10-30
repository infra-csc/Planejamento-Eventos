import { notFound } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { resumoAbasEvento, solicitacoesPendentes } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { daMinhaArea, pode } from "@/domain/permissions";
import { statusExibicao } from "@/domain/evento";
import { NaoEncontradoError } from "@/domain/errors";
import { diaMes, diaMesHora, diaMesISO, hojeISO, hora, isoSP, periodoCurto } from "@/lib/format";
import { EventoStatusBadge, Tag } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Aviso, PageHeader } from "@/components/ui/layout";
import { TabsNav, type Aba } from "@/components/ui/tabs-nav";
import { LinhaTempo } from "@/components/eventos/fases";
import { AcoesEvento } from "@/components/eventos/acoes-evento";
import { obterConfiguracoesCache } from "@/server/cache";
import { contarVeiculosCarga } from "@/server/services/carga-descarga";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  let naoExiste = false;
  const ev = await obterEventoCache(usuario, id).catch((e: unknown) => {
    naoExiste = e instanceof NaoEncontradoError;
    return null;
  });
  // `template`: páginas com título próprio (Editar evento) ganham o código do evento e o sufixo do app.
  // Evento inexistente: a aba dizia "Evento" e a página "Não encontrado" (auditoria 30/10, parte D N26).
  return ev ? { title: { default: `${ev.codigo} ${ev.nome}`, template: `%s · ${ev.codigo} · Planejamento` } } : { title: naoExiste ? "Página não encontrada" : "Evento" };
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
  // Só contagens: este layout roda em todas as abas do evento. (A contagem de itens pré-reunião pendentes saiu: o
  // cabeçalho não a usa, e era a 3ª consulta sobre as mesmas solicitações; auditoria 28/10, nº 148.)
  const [resumo, abertasTodas, cfg, nVeiculos] = await Promise.all([
    resumoAbasEvento(usuario, id),
    getDb().then((db) => solicitacoesPendentes(db, id)),
    obterConfiguracoesCache(),
    pode(usuario, "carga.ver") ? contarVeiculosCarga(id) : Promise.resolve(0),
  ]);
  const abertas = pode(usuario, "solicitacao.ver_todas") ? abertasTodas : abertasTodas.filter((s) => daMinhaArea(usuario, s.areaId));
  const st = statusExibicao(ev.status, ev.dataFim, hojeISO());
  const base = `/eventos/${ev.id}`;
  const { versaoOs, preEnviadas } = resumo;
  const nLinhas = resumo.linhas;
  // A fase fala da ata congelada, não das linhas de hoje (auditoria 30/10, B-09).
  const nAta = resumo.linhasAtaFechada;
  const hoje = hojeISO();
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
      detalhe: ev.ataFechadaEm ? (nAta == null ? "ata fechada" : `ata fechada com ${nAta} ${nAta === 1 ? "linha" : "linhas"}`) : ev.status === "EM_REUNIAO" ? (isoSP(ev.reuniaoIniciadaEm ?? ev.dataReuniao) < hoje ? `aberta desde ${diaMes(ev.reuniaoIniciadaEm ?? ev.dataReuniao)} · ata por fechar` : "acontecendo agora") : "aguardando",
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
    // Fechada, a ata é o registro da reunião (ex.: 7 linhas) e o número das linhas de agora (11) a contradizia:
    // o contador só vale enquanto ela está sendo montada.
    { href: `${base}/ata`, label: "Ata", n: ev.ataFechadaEm ? null : nLinhas },
    ...(pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO") ? [{ href: `/conferencia/${ev.id}`, label: "Conferência" }] : []),
    { href: `${base}/solicitacoes`, label: "Solicitações", n: resumo.solicitacoes },
    ...(pode(usuario, "os.ver") ? [{ href: `${base}/os`, label: "OS", n: versaoOs ? `v${versaoOs}` : null }] : []),
    // Carga e descarga do galpão: só logística e administrador.
    ...(pode(usuario, "carga.ver") ? [{ href: `${base}/carga`, label: "Carga", n: nVeiculos || null }] : []),
    { href: `${base}/historico`, label: "Histórico" },
  ];

  return (
    <>
      <PageHeader
        // Título de detalhe com 18 px, como toda tela de registro (decisão de 30/10 sobre a auditoria 28/10 nº 51).
        tamanho="sm"
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
            datas={{ hoje, diaReuniao: isoSP(ev.dataReuniao), quandoReuniao: `${diaMes(ev.dataReuniao)} às ${hora(ev.dataReuniao)}`, diaEvento: ev.dataInicio }}
            solicitacoesAbertas={abertas.map((s) => s.codigo)}
            bloquearEncerramentoComPendentes={cfg.bloquear_encerramento_com_pendentes === "true"}
            corrigeDireto={pode(usuario, "ata.ajustar")}
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
