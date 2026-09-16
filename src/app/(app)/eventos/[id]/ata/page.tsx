import { requireUsuario } from "@/server/auth/session";
import { listarAtaVersoes, obterLinhasAta, opcoesReferenciasResumidas } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { listarAreas } from "@/server/services/admin";
import { pode } from "@/domain/permissions";
import { diaMesHora, formatarDataHora } from "@/lib/format";
import { ListaDados, Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { AtaLista } from "@/components/eventos/ata-lista";
import { paraView } from "@/components/eventos/ata-view";

export default async function AtaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, linhas, versoes, opcoes, areas] = await Promise.all([obterEventoCache(usuario, id), obterLinhasAta(id), listarAtaVersoes(id), opcoesReferenciasResumidas(), listarAreas()]);
  const editavel = pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO" || (ev.status === "ABERTO" && pode(usuario, "ata.ajustar")));
  const congelada = versoes[0];
  // Cabeçalho da ata (campos da planilha): da versão congelada quando existe, senão do evento em andamento.
  const reu = congelada?.conteudo.reuniao;
  const dadosReuniao = [
    { label: "Reunião marcada", valor: formatarDataHora(ev.dataReuniao) },
    { label: "Iniciada", valor: reu ? (reu.iniciadaEm ? formatarDataHora(reu.iniciadaEm) : "—") : ev.reuniaoIniciadaEm ? formatarDataHora(ev.reuniaoIniciadaEm) : "ainda não" },
    { label: "Ata fechada", valor: reu ? formatarDataHora(reu.fechadaEm) : ev.ataFechadaEm ? formatarDataHora(ev.ataFechadaEm) : "ainda não", forte: true },
    { label: "Fechada por", valor: reu?.fechadaPor ?? congelada?.fechadaPor?.nome ?? "—" },
    { label: "Conduzida por", valor: reu?.conduzidaPor || ev.responsavel.nome },
    { label: "Público esperado", valor: (reu ? reu.publicoEsperado : ev.publicoEsperado)?.toLocaleString("pt-BR") ?? "—" },
    { label: "Caminhão carrega", valor: (reu ? reu.caminhaoCarrega : ev.caminhaoCarrega) || "—" },
    { label: "Caminhão sai", valor: (reu ? reu.caminhaoSai : ev.caminhaoSai) || "—" },
    { label: "Arena descarrega", valor: (reu ? reu.arenaDescarrega : ev.arenaDescarrega) || "—" },
    { label: "Kit descarrega", valor: (reu ? reu.kitDescarrega : ev.kitDescarrega) || "—" },
  ];
  const presentes = reu ? reu.presentes : ev.reuniaoPresentes;
  const conferidasNaAta = congelada ? congelada.conteudo.linhas.filter((l) => l.conferidoPor).length : linhas.filter((l) => l.conferidoEm).length;

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
          conferivel={editavel && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO")}
        />
      </Section>

      <div className="flex flex-col gap-5">
        <Section titulo="Exportar ata" sub={congelada ? `Versão congelada v${congelada.numero}` : "Ata em construção (prévia)"}>
          <div className="flex flex-col gap-2 px-[18px] py-3.5">
            <a href={`/api/eventos/${id}/ata/excel`} className={buttonClasses({ variant: "primary", size: "md", className: "w-full no-underline" })}>
              Excel da ata (.xlsx)
            </a>
            <ButtonLink href={`/impressao/ata/${id}`} target="_blank" variant="secondary" size="md" className="w-full no-underline">
              Imprimir / PDF
            </ButtonLink>
            <p className="mb-0 mt-1 text-[12px] leading-[1.5] text-muted">Cabeçalho da reunião, presentes, linhas conferidas, observações e o que cada área pediu.</p>
          </div>
        </Section>

        <Section titulo="Reunião de OS" sub={congelada ? `Registro congelado na v${congelada.numero}` : "Preenchido pela logística na reunião"}>
          <ListaDados itens={dadosReuniao} />
          <div className="border-t border-line-faint px-[18px] py-3">
            <p className="m-0 text-[12px] text-muted">Pessoas presentes</p>
            <p className="mb-0 mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-ink-2">{presentes?.trim() || <span className="text-meta">ainda não registrado</span>}</p>
          </div>
          <div className="border-t border-line-faint px-[18px] py-3 text-[12.5px] text-ink-3">
            <span className="font-mono text-ink-2">{conferidasNaAta}</span>/{congelada ? congelada.conteudo.linhas.length : linhas.length} linhas conferidas na reunião
          </div>
        </Section>

        <Section titulo="Observações da reunião">
          <div className="px-[18px] py-3.5">
            {ev.observacoesReuniao ? <p className="m-0 whitespace-pre-wrap text-[13px] leading-[1.55] text-ink-2">{ev.observacoesReuniao}</p> : <p className="m-0 text-[12.5px] text-muted">Nenhuma observação registrada.</p>}
          </div>
        </Section>

        {!ev.ataFechadaEm && (
          <Section titulo="Prévia da OS" sub="Confira antes de fechar">
            <div className="px-[18px] py-3.5">
              <p className="mb-2.5 mt-0 text-[12.5px] leading-[1.5] text-ink-3">Totais por peça, por projeto e peças soltas calculados desta ata. A OS v1 é gerada no fechamento.</p>
              <ButtonLink href={`/eventos/${id}/os`} variant="secondary" size="sm" className="no-underline">
                Ver prévia da OS
              </ButtonLink>
            </div>
          </Section>
        )}

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
