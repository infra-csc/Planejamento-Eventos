import { requirePermissao } from "@/server/auth/session";
import { montarAtaExport } from "@/server/export/ata";
import { ITEM_STATUS_LABEL } from "@/domain/solicitacao";
import { formatarData, formatarDataHora, formatarPeriodo } from "@/lib/format";
import { ImprimirBotao } from "../../os/[id]/imprimir-botao";

const TIPO_LABEL = { PROJETO: "projeto", PECA: "peça", AVULSO: "avulso" } as const;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  const ata = await montarAtaExport(usuario, id, v ? Number(v) : undefined).catch(() => null);
  return { title: ata ? `Ata ${ata.evento.codigo}${ata.versao ? ` v${ata.versao}` : ""} · ${ata.evento.nome}` : "Ata" };
}

function Campo({ k, v, forte }: { k: string; v: React.ReactNode; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-200 py-1">
      <span className="text-neutral-500">{k}</span>
      <span className={forte ? "font-semibold" : ""}>{v}</span>
    </div>
  );
}

/** Ata da reunião de OS para impressão/PDF: cabeçalho da planilha, linhas conferidas, observações e assinaturas. */
export default async function ImpressaoAtaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const { v } = await searchParams;
  const ata = await montarAtaExport(usuario, id, v ? Number(v) : undefined);
  const ev = ata.evento;
  const reu = ata.reuniao;
  const conferidas = ata.linhas.filter((x) => x.conferidoPor).length;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[13px] text-black print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <ImprimirBotao />
      </div>
      <header className="mb-5 border-b border-black pb-4">
        <p className="text-[11px] uppercase tracking-widest">Norte Mkt · Ata da reunião de OS</p>
        <h1 className="mt-1 text-xl font-semibold">
          {ev.codigo} · {ev.nome}
        </h1>
        <p className="mt-0.5 text-[11px] text-neutral-600">{ata.versao ? `Ata v${ata.versao}${reu?.fechadaEm ? ` · fechada em ${formatarDataHora(reu.fechadaEm)}` : ""}` : "Ata em construção — ainda não fechada"}</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-x-8 text-[12px]">
        <div>
          <Campo k="Cliente" v={ev.cliente || "—"} />
          <Campo k="Local" v={ev.local || "—"} />
          <Campo k="Data do evento" v={formatarPeriodo(ev.dataInicio, ev.dataFim)} />
          <Campo k="Montagem" v={formatarData(ev.dataMontagem)} />
          <Campo k="Desmontagem" v={formatarData(ev.dataDesmontagem)} />
          <Campo k="Público esperado" v={reu?.publicoEsperado != null ? reu.publicoEsperado.toLocaleString("pt-BR") : "—"} />
          <Campo k="Caminhão carrega" v={reu?.caminhaoCarrega || "—"} />
          <Campo k="Caminhão sai" v={reu?.caminhaoSai || "—"} />
          <Campo k="Arena descarrega" v={reu?.arenaDescarrega || "—"} />
          <Campo k="Kit descarrega" v={reu?.kitDescarrega || "—"} />
        </div>
        <div>
          <Campo k="Reunião marcada" v={formatarDataHora(ev.dataReuniao)} />
          <Campo k="Iniciada" v={reu?.iniciadaEm ? formatarDataHora(reu.iniciadaEm) : "—"} />
          <Campo k="Ata fechada" v={reu?.fechadaEm ? formatarDataHora(reu.fechadaEm) : "—"} forte />
          <Campo k="Fechada por" v={reu?.fechadaPor || "—"} />
          <Campo k="Conduzida por" v={reu?.conduzidaPor || ev.responsavel} />
          <Campo k="Linhas conferidas" v={`${conferidas} de ${ata.linhas.length}`} />
          <div className="mt-2">
            <p className="mb-0.5 text-neutral-500">Pessoas presentes</p>
            <p className="m-0 whitespace-pre-wrap leading-[1.45]">{reu?.presentes?.trim() || "—"}</p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">O que vai para o evento</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
              <th className="py-1 pr-3">Código</th>
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3 text-right">Qtd.</th>
              <th className="py-1 pr-3">Destino</th>
              <th className="py-1 pr-3">Área</th>
              <th className="py-1 pr-3">Origem</th>
              <th className="py-1">Conferido por</th>
            </tr>
          </thead>
          <tbody>
            {ata.linhas.map((x, i) => (
              <tr key={i} className="border-b border-neutral-300">
                <td className="py-1.5 pr-3 font-mono text-[11.5px]">{x.codigo ?? ""}</td>
                <td className="py-1.5 pr-3">
                  {x.descricao}
                  {x.versao ? <span className="text-neutral-500"> v{x.versao}</span> : null} <span className="text-[10.5px] text-neutral-500">· {TIPO_LABEL[x.tipo]}</span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">{x.quantidade}</td>
                <td className="py-1.5 pr-3">{x.destino ?? "—"}</td>
                <td className="py-1.5 pr-3">{x.area ?? "Logística"}</td>
                <td className="py-1.5 pr-3 text-[11px] text-neutral-600">{x.origem}</td>
                <td className="py-1.5 text-[11px]">{x.conferidoPor ? `✓ ${x.conferidoPor}` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black">
              <td colSpan={2} className="py-1.5 pr-3 font-semibold">
                {ata.linhas.length} {ata.linhas.length === 1 ? "linha" : "linhas"}
              </td>
              <td className="py-1.5 pr-3 text-right font-mono font-semibold">{ata.linhas.reduce((a, x) => a + x.quantidade, 0)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-1 text-base font-semibold">Observações da reunião</h2>
        <p className="m-0 whitespace-pre-wrap leading-[1.5]">{ata.observacoes?.trim() || "Nenhuma observação registrada."}</p>
      </section>

      {ata.solicitacoesPreReuniao.length > 0 && (
        <section className="mb-6 break-before-page">
          <h2 className="mb-2 text-base font-semibold">O que cada área pediu antes da reunião</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
                <th className="py-1 pr-3">Solicitação</th>
                <th className="py-1 pr-3">Área</th>
                <th className="py-1 pr-3">Item</th>
                <th className="py-1 pr-3 text-right">Pedido</th>
                <th className="py-1 pr-3 text-right">Atendido</th>
                <th className="py-1 pr-3">Situação</th>
                <th className="py-1">Observação</th>
              </tr>
            </thead>
            <tbody>
              {ata.solicitacoesPreReuniao.flatMap((s) =>
                s.itens.map((it, i) => (
                  <tr key={`${s.codigo}-${i}`} className="border-b border-neutral-300">
                    <td className="py-1.5 pr-3 font-mono text-[11.5px]">{s.codigo}</td>
                    <td className="py-1.5 pr-3">{s.area}</td>
                    <td className="py-1.5 pr-3">{it.descricao}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{it.solicitada}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{it.atendida}</td>
                    <td className="py-1.5 pr-3">{ITEM_STATUS_LABEL[it.status]}</td>
                    <td className="py-1.5 text-[11px] text-neutral-600">{it.observacao ?? ""}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-8 text-[11px] text-neutral-600">
        <div className="border-t border-black pt-2">Logística · assinatura e data</div>
        <div className="border-t border-black pt-2">Cliente / gestão · assinatura e data</div>
      </footer>
    </div>
  );
}
