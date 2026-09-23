import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { montarAtaExport } from "@/server/export/ata";
import { ITEM_STATUS_LABEL } from "@/domain/solicitacao";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { ImprimirBotao } from "../../os/[id]/imprimir-botao";

/* Mesma tipografia da impressão da OS: tinta só, cabeçalho de tabela em caixa-alta pequena, números tabulares. */
const cabecalho = "border-b border-ink text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2";
const th = "py-1.5 pr-3 font-semibold";
const linha = "border-b border-line-strong";
const td = "py-1.5 pr-3 align-top";
const num = "numero py-1.5 pr-3 text-right align-top";

const TIPO_LABEL = { PROJETO: "projeto", PECA: "peça", AVULSO: "avulso" } as const;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  const ata = await montarAtaExport(usuario, id, v ? Number(v) : undefined).catch(() => null);
  return { title: ata ? `Ata ${ata.evento.codigo}${ata.versao ? ` v${ata.versao}` : ""} · ${ata.evento.nome}` : "Ata" };
}

function Campo({ k, v, forte }: { k: string; v: React.ReactNode; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1">
      <dt className="text-ink-3">{k}</dt>
      <dd className={forte ? "numero m-0 text-right font-semibold" : "numero m-0 text-right"}>{v}</dd>
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
    <div className="mx-auto max-w-4xl rounded-cartao border border-line bg-surface p-5 text-corpo text-ink sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${id}/ata${v ? `?v=${v}` : ""}`} className="link inline-flex items-center gap-1 text-corpo">
          <Icone nome="seta-esquerda" />
          Voltar para a ata
        </Link>
        <ImprimirBotao />
      </div>
      <header className="mb-5 border-b border-ink pb-4">
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.1em] text-ink-2">Norte Mkt · Ata da reunião de OS</p>
        <h1 className="mb-0 mt-1 text-pagina font-semibold tracking-[-0.02em]">
          <Codigo>{ev.codigo}</Codigo> · {ev.nome}
        </h1>
        <p className="numero mb-0 mt-1 text-pequeno text-ink-3">{ata.versao ? `Ata v${ata.versao}${reu?.fechadaEm ? ` · fechada em ${formatarDataHora(reu.fechadaEm)}` : ""}` : "Ata em construção — ainda não fechada"}</p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-x-8 text-pequeno sm:grid-cols-2 print:grid-cols-2">
        <dl className="m-0">
          <Campo k="Cliente" v={ev.cliente || "—"} />
          <Campo k="Local" v={ev.local || "—"} />
          <Campo k="Data do evento" v={formatarPeriodo(ev.dataInicio, ev.dataFim)} />
          <Campo k="Público esperado" v={reu?.publicoEsperado != null ? reu.publicoEsperado.toLocaleString("pt-BR") : "—"} />
          <Campo k="Caminhão carrega" v={reu?.caminhaoCarrega || "—"} />
          <Campo k="Caminhão sai" v={reu?.caminhaoSai || "—"} />
          <Campo k="Arena descarrega" v={reu?.arenaDescarrega || "—"} />
          <Campo k="Kit descarrega" v={reu?.kitDescarrega || "—"} />
        </dl>
        <div>
          <dl className="m-0">
          <Campo k="Reunião marcada" v={formatarDataHora(ev.dataReuniao)} />
          <Campo k="Iniciada" v={reu?.iniciadaEm ? formatarDataHora(reu.iniciadaEm) : "—"} />
          <Campo k="Ata fechada" v={reu?.fechadaEm ? formatarDataHora(reu.fechadaEm) : "—"} forte />
          <Campo k="Fechada por" v={reu?.fechadaPor || "—"} />
          <Campo k="Conduzida por" v={reu?.conduzidaPor || ev.responsavel} />
          <Campo k="Linhas conferidas" v={`${conferidas} de ${ata.linhas.length}`} />
          </dl>
          <div className="mt-2">
            <p className="mb-0.5 text-ink-3">Pessoas presentes</p>
            <p className="m-0 whitespace-pre-wrap">{reu?.presentes?.trim() || "—"}</p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 mt-0 text-destaque font-semibold">O que vai para o evento</h2>
        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[640px] border-collapse print:min-w-0">
          <thead>
            <tr className={cabecalho}>
              <th scope="col" className={th}>Código</th>
              <th scope="col" className={th}>Item</th>
              <th scope="col" className={`${th} text-right`}>Qtd.</th>
              <th scope="col" className={th}>Destino</th>
              <th scope="col" className={th}>Área</th>
              <th scope="col" className={th}>Origem</th>
              <th scope="col" className="py-1.5 font-semibold">Conferido por</th>
            </tr>
          </thead>
          <tbody>
            {ata.linhas.map((x, i) => (
              <tr key={i} className={linha}>
                <td className={`${td} text-rotulo`}>{x.codigo ? <Codigo>{x.codigo}</Codigo> : ""}</td>
                <td className={td}>
                  {x.descricao}
                  {x.versao ? <Codigo className="text-ink-3"> v{x.versao}</Codigo> : null} <span className="text-rotulo text-ink-3">· {TIPO_LABEL[x.tipo]}</span>
                </td>
                <td className={`${num} font-semibold`}>{x.quantidade}</td>
                <td className={td}>{x.destino ?? "—"}</td>
                <td className={td}>{x.area ?? "Logística"}</td>
                <td className={`${td} text-rotulo text-ink-3`}>{x.origem}</td>
                <td className="py-1.5 align-top text-rotulo">{x.conferidoPor ? `☑ ${x.conferidoPor}` : "☐"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink">
              <td colSpan={2} className="py-1.5 pr-3 font-semibold">
                {ata.linhas.length} {ata.linhas.length === 1 ? "linha" : "linhas"}
              </td>
              <td className={`${num} font-semibold`}>{ata.linhas.reduce((a, x) => a + x.quantidade, 0)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
        </div>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-1 mt-0 text-destaque font-semibold">Observações da reunião</h2>
        <p className="m-0 whitespace-pre-wrap leading-relaxed">{ata.observacoes?.trim() || "Nenhuma observação registrada."}</p>
      </section>

      {ata.solicitacoesPreReuniao.length > 0 && (
        <section className="mb-6 break-before-page">
          <h2 className="mb-2 mt-0 text-destaque font-semibold">O que cada área pediu antes da reunião</h2>
          <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[640px] border-collapse print:min-w-0">
            <thead>
              <tr className={cabecalho}>
                <th scope="col" className={th}>Solicitação</th>
                <th scope="col" className={th}>Área</th>
                <th scope="col" className={th}>Item</th>
                <th scope="col" className={`${th} text-right`}>Pedido</th>
                <th scope="col" className={`${th} text-right`}>Atendido</th>
                <th scope="col" className={th}>Situação</th>
                <th scope="col" className="py-1.5 font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody>
              {ata.solicitacoesPreReuniao.flatMap((s) =>
                s.itens.map((it, i) => (
                  <tr key={`${s.codigo}-${i}`} className={linha}>
                    <td className={`${td} text-rotulo`}>
                      <Codigo>{s.codigo}</Codigo>
                    </td>
                    <td className={td}>{s.area}</td>
                    <td className={td}>{it.descricao}</td>
                    <td className={num}>{it.solicitada}</td>
                    <td className={num}>{it.atendida}</td>
                    <td className={td}>{ITEM_STATUS_LABEL[it.status]}</td>
                    <td className="py-1.5 align-top text-rotulo text-ink-3">{it.observacao ?? ""}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-8 text-rotulo text-ink-3">
        <div className="border-t border-ink pt-2">Logística · assinatura e data</div>
        <div className="border-t border-ink pt-2">Cliente / gestão · assinatura e data</div>
      </footer>
    </div>
  );
}
