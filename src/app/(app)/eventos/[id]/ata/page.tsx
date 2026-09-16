import { requireUsuario } from "@/server/auth/session";
import { listarAtaVersoes, obterEvento, obterLinhasAta, opcoesReferencias } from "@/server/services/eventos";
import { listarAreas } from "@/server/services/admin";
import { pode } from "@/domain/permissions";
import { diaMesHora } from "@/lib/format";
import { Section } from "@/components/ui/layout";
import { AtaLista } from "@/components/eventos/ata-lista";
import { paraView } from "@/components/eventos/ata-view";

export default async function AtaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, linhas, versoes, opcoes, areas] = await Promise.all([obterEvento(usuario, id), obterLinhasAta(id), listarAtaVersoes(id), opcoesReferencias(), listarAreas()]);
  const editavel = pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO" || (ev.status === "ABERTO" && pode(usuario, "ata.ajustar")));
  const congelada = versoes[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <Section
        titulo={ev.ataFechadaEm ? "Ata atual" : "Ata em construção"}
        sub={ev.ataFechadaEm ? "Ata fechada mais o que foi atendido em alterações e ajustes da logística. Cada linha vira peças na OS." : "Monta-se na reunião de OS a partir das respostas. Cada linha vira peças na OS."}
      >
        <AtaLista
          eventoId={id}
          status={ev.status}
          editavel={editavel}
          opcoes={opcoes}
          areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
          linhas={linhas.map(paraView)}
          dataReuniao={diaMesHora(ev.dataReuniao)}
        />
      </Section>

      <div className="flex flex-col gap-5">
        <Section titulo="Observações da reunião">
          <div className="px-[18px] py-3.5">
            {ev.observacoesReuniao ? <p className="m-0 whitespace-pre-wrap text-[13px] leading-[1.55] text-ink-2">{ev.observacoesReuniao}</p> : <p className="m-0 text-[12.5px] text-muted">Nenhuma observação registrada.</p>}
          </div>
        </Section>

        {congelada && (
          <Section titulo="Ata congelada" sub={`v${congelada.numero} · ${diaMesHora(congelada.fechadaEm)}`}>
            <div className="px-[18px] py-3.5 text-[12.5px] leading-[1.5] text-ink-3">
              <p className="m-0">
                Fechada por {congelada.fechadaPor?.nome ?? "—"} com <span className="font-mono text-ink-2">{congelada.conteudo.linhas.length}</span> {congelada.conteudo.linhas.length === 1 ? "linha" : "linhas"} e{" "}
                <span className="font-mono text-ink-2">{congelada.conteudo.solicitacoesPreReuniao.length}</span> {congelada.conteudo.solicitacoesPreReuniao.length === 1 ? "solicitação pré-reunião" : "solicitações pré-reunião"}.
              </p>
              <p className="mb-0 mt-2">O registro original não muda mais. O que veio depois está no histórico e nas versões da OS.</p>
              {versoes.length > 1 && <p className="mb-0 mt-2 text-meta">Evento reaberto: {versoes.length} fechamentos de ata registrados.</p>}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
