import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarAtaVersoes, obterEvento, obterHistoricoEvento, obterLinhasAta, resumoSolicitacoesEvento } from "@/server/services/eventos";
import { listarOsVersoes } from "@/server/services/os";
import { pode } from "@/domain/permissions";
import { SOLICITACAO_STATUS_LABEL } from "@/domain/solicitacao";
import { KeyValue, Notice, Panel, Stat } from "@/components/ui/layout";
import { formatarData, formatarDataHora, hojeISO, tempoRelativo } from "@/lib/format";

export default async function EventoVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, linhas, resumo, historico, osVersoes, atas] = await Promise.all([
    obterEvento(usuario, id),
    obterLinhasAta(id),
    resumoSolicitacoesEvento(id),
    obterHistoricoEvento(usuario, id),
    listarOsVersoes(id),
    listarAtaVersoes(id),
  ]);
  const totalPorStatus = (s: string) => resumo.filter((r) => r.status === s).reduce((a, r) => a + r.n, 0);
  const abertas = totalPorStatus("ENVIADA") + totalPorStatus("EM_ANALISE");
  const defasadas = linhas.filter((l) => l.versaoDefasada).length;
  const hoje = hojeISO();
  const diasParaCarga = ev.dataCarga ? Math.round((new Date(ev.dataCarga).getTime() - new Date(hoje).getTime()) / 86_400_000) : null;

  const proximoPasso: Record<string, string> = {
    PREPARACAO: pode(usuario, "solicitacao.criar")
      ? "Registre as necessidades da sua área em uma solicitação e envie antes da reunião."
      : "Aguarde as áreas enviarem necessidades. Ao começar a reunião, use “Iniciar reunião”.",
    EM_REUNIAO: pode(usuario, "ata.consolidar") ? "Responda cada item enviado pelas áreas e inclua o que foi decidido na reunião. Depois, feche a ata." : "A logística está consolidando a ata. Você será notificado quando ela for fechada.",
    ABERTO: pode(usuario, "solicitacao.criar")
      ? "Precisa mudar algo? Abra uma solicitação de alteração — cada item será respondido separadamente."
      : "Responda as solicitações de alteração dentro do prazo. Quando não houver mais mudanças, encerre o evento.",
    ENCERRADO: "Evento encerrado. A OS final está na aba OS. Apenas a Gestão pode reabrir em exceção.",
    CANCELADO: "Evento cancelado.",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Notice tone={ev.status === "CANCELADO" ? "danger" : "info"} title="Próximo passo">
          {proximoPasso[ev.status]}
        </Notice>
        {diasParaCarga !== null && ev.status === "ABERTO" && (
          <Notice tone={diasParaCarga <= 2 ? "warning" : "info"}>
            Carga do caminhão em {formatarData(ev.dataCarga)} ({diasParaCarga >= 0 ? `${diasParaCarga} dia(s)` : "data passada"}). O encerramento continua sendo comando da logística.
          </Notice>
        )}
        {defasadas > 0 && pode(usuario, "ata.consolidar") && ev.status !== "ENCERRADO" && (
          <Notice tone="warning">
            {defasadas} linha(s) da ata usam versões antigas de projeto padrão.{" "}
            <Link href={`/eventos/${id}/ata`} className="underline">
              Revisar na ata
            </Link>
            .
          </Notice>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Linhas na ata" value={linhas.length} />
          <Stat label="Solicitações abertas" value={abertas} tone={abertas > 0 ? "warning" : undefined} />
          <Stat label="Respondidas" value={totalPorStatus("RESPONDIDA")} />
          <Stat label="Versões da OS" value={osVersoes.length} hint={osVersoes[0] ? `última ${tempoRelativo(osVersoes[0].geradaEm)}` : "ainda não gerada"} />
        </div>

        <Panel title="Solicitações por status">
          {resumo.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma solicitação ainda.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {resumo.map((r) => (
                <li key={`${r.status}-${r.tipo}`} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                  <span>
                    {SOLICITACAO_STATUS_LABEL[r.status]} <span className="text-ink-muted">· {r.tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"}</span>
                  </span>
                  <span className="font-medium tabular">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Dados do evento">
          <KeyValue
            columns={1}
            items={[
              { label: "Código", value: ev.codigo },
              { label: "Cliente", value: ev.cliente || "—" },
              { label: "Local", value: ev.local || "—" },
              { label: "Montagem → desmontagem", value: `${formatarData(ev.dataMontagem)} → ${formatarData(ev.dataDesmontagem)}` },
              { label: "Carga do caminhão", value: ev.dataCarga ? formatarData(ev.dataCarga) : "não definida" },
              { label: "Ata fechada", value: ev.ataFechadaEm ? `${formatarDataHora(ev.ataFechadaEm)} (v${atas[0]?.numero ?? 1})` : "ainda não" },
              { label: "Encerrado", value: ev.encerradoEm ? formatarDataHora(ev.encerradoEm) : "—" },
            ]}
          />
        </Panel>
        <Panel title="Atividade recente" actions={<Link href={`/eventos/${id}/historico`} className="text-xs text-info hover:underline">Ver tudo</Link>}>
          {historico.length === 0 ? (
            <p className="text-sm text-ink-muted">Sem registros.</p>
          ) : (
            <ul className="space-y-2.5">
              {historico.slice(0, 6).map((h) => (
                <li key={h.id} className="text-[13px]">
                  <p className="text-ink leading-snug">{h.descricao}</p>
                  <p className="text-xs text-ink-muted">
                    {h.usuario?.nome ?? "Sistema"} · {tempoRelativo(h.criadoEm)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
