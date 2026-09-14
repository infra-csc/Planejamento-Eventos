import { requirePermissao } from "@/server/auth/session";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsVersoes } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETOR_LABEL } from "@/domain/os";
import { formatarData, formatarDataHora, formatarPeriodo } from "@/lib/format";
import { ImprimirBotao } from "./imprimir-botao";

export default async function ImpressaoOsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const { v } = await searchParams;
  const ev = await obterEvento(usuario, id);
  const versoes = await listarOsVersoes(id);
  const sel = v ? versoes.find((x) => String(x.numero) === v) : versoes[0];
  const os = sel && v ? sel.conteudo : await calcularOsAtual(await getDb(), id);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[13px] text-black print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <ImprimirBotao />
      </div>
      <header className="mb-6 border-b border-black pb-4">
        <p className="text-[11px] uppercase tracking-widest">Norte Mkt · Ordem de Serviço</p>
        <h1 className="mt-1 text-xl font-semibold">
          {ev.codigo} · {ev.nome}
        </h1>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          <div>
            <span className="text-neutral-500">Evento:</span> {formatarPeriodo(ev.dataInicio, ev.dataFim)}
          </div>
          <div>
            <span className="text-neutral-500">Montagem:</span> {formatarData(ev.dataMontagem)}
          </div>
          <div>
            <span className="text-neutral-500">Local:</span> {ev.local || "—"}
          </div>
          <div>
            <span className="text-neutral-500">Versão:</span> {v && sel ? `v${sel.numero} (${formatarDataHora(sel.geradaEm)})` : versoes[0] ? `v${versoes[0].numero} · atual` : "prévia"}
          </div>
        </div>
      </header>

      {os.setores.map((s) => (
        <section key={s.setor} className="mb-8 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold">{SETOR_LABEL[s.setor]}</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
                <th className="py-1 pr-3">Código</th>
                <th className="py-1 pr-3">Peça</th>
                <th className="py-1 pr-3 text-right">Total</th>
                <th className="py-1 pr-3">Un.</th>
                <th className="py-1">Composição</th>
                <th className="py-1 w-16 text-center">Sep.</th>
              </tr>
            </thead>
            <tbody>
              {s.linhas.map((l) => (
                <tr key={l.pecaId} className="border-b border-neutral-300">
                  <td className="py-1.5 pr-3 font-medium">{l.codigo}</td>
                  <td className="py-1.5 pr-3">{l.nome}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold font-mono">{l.total}</td>
                  <td className="py-1.5 pr-3">{l.unidade}</td>
                  <td className="py-1.5 text-[11px] text-neutral-600">{l.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · ")}</td>
                  <td className="py-1.5 text-center">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {os.semSetor.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold">Itens avulsos</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
                <th className="py-1 pr-3">Descrição</th>
                <th className="py-1 pr-3 text-right">Qtd.</th>
                <th className="py-1 pr-3">Destino</th>
                <th className="py-1">Área</th>
                <th className="py-1 w-16 text-center">Sep.</th>
              </tr>
            </thead>
            <tbody>
              {os.semSetor.map((a, i) => (
                <tr key={i} className="border-b border-neutral-300">
                  <td className="py-1.5 pr-3">{a.descricao}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{a.quantidade}</td>
                  <td className="py-1.5 pr-3">{a.destino ?? "—"}</td>
                  <td className="py-1.5">{a.area ?? "—"}</td>
                  <td className="py-1.5 text-center">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <footer className="mt-10 grid grid-cols-2 gap-8 text-[11px] text-neutral-600">
        <div className="border-t border-black pt-2">Separado por / data</div>
        <div className="border-t border-black pt-2">Conferido por / data</div>
      </footer>
    </div>
  );
}
