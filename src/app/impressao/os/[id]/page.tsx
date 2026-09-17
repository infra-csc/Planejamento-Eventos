import { requirePermissao } from "@/server/auth/session";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETOR_LABEL } from "@/domain/os";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { ImprimirBotao } from "./imprimir-botao";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  const ev = await obterEvento(usuario, id).catch(() => null);
  // Vira o nome sugerido do PDF ao imprimir.
  return { title: ev ? `OS ${ev.codigo}${v ? ` v${v}` : ""} · ${ev.nome}` : "OS" };
}

export default async function ImpressaoOsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const { v } = await searchParams;
  const [ev, versoes] = await Promise.all([obterEvento(usuario, id), listarOsResumo(id)]);
  const sel = v ? versoes.find((x) => String(x.numero) === v) : versoes[0];
  const os = (sel && v ? (await obterConteudosOs(id, [sel.numero])).get(sel.numero) : undefined) ?? (await calcularOsAtual(await getDb(), id));

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
            <span className="text-neutral-500">Reunião de OS:</span> {formatarDataHora(ev.dataReuniao)}
          </div>
          <div>
            <span className="text-neutral-500">Local:</span> {ev.local || "—"}
          </div>
          <div>
            <span className="text-neutral-500">Versão:</span> {v && sel ? `v${sel.numero} (${formatarDataHora(sel.geradaEm)})` : versoes[0] ? `v${versoes[0].numero} · atual` : "prévia"}
          </div>
        </div>
      </header>

      <h2 className="mb-3 text-lg font-semibold">Totais por peça</h2>
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

      {os.projetos && os.projetos.length > 0 && (
        <section className="mb-8 break-before-page">
          <h2 className="mb-1 text-lg font-semibold">Por projeto</h2>
          <p className="mb-4 text-[11px] text-neutral-600">O que cada projeto padrão leva, já com os ajustes pedidos pela área. As mesmas peças estão somadas nos totais acima.</p>
          {os.projetos.map((p, i) => (
            <div key={`${p.codigo}-${i}`} className="mb-6 break-inside-avoid">
              <h3 className="mb-0.5 text-[14px] font-semibold">
                {p.nome} <span className="font-mono text-[11px] font-normal text-neutral-600">{p.codigo} · v{p.versao}</span> <span className="ml-1 rounded bg-black px-1.5 py-px font-mono text-[11px] text-white">× {p.quantidade}</span>
              </h3>
              <p className="mb-2 text-[11px] text-neutral-600">{[p.destino ? `Destino: ${p.destino}` : null, p.area, `${p.pecas.length} tipos de peça · ${p.pecas.reduce((a, x) => a + x.total, 0)} unidades`].filter(Boolean).join(" · ")}</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
                    <th className="py-1 pr-3">Código</th>
                    <th className="py-1 pr-3">Peça</th>
                    <th className="py-1 pr-3">Setor</th>
                    <th className="py-1 pr-3 text-right">Por un.</th>
                    <th className="py-1 pr-3 text-right">Total</th>
                    <th className="py-1 pr-3">Un.</th>
                    <th className="py-1 w-16 text-center">Sep.</th>
                  </tr>
                </thead>
                <tbody>
                  {p.pecas.map((x) => (
                    <tr key={x.codigo} className="border-b border-neutral-300">
                      <td className="py-1.5 pr-3 font-medium">{x.codigo}</td>
                      <td className="py-1.5 pr-3">{x.nome}</td>
                      <td className="py-1.5 pr-3 text-[11px] text-neutral-600">{SETOR_LABEL[x.setor]}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{x.porUnidade}</td>
                      <td className="py-1.5 pr-3 text-right font-mono font-semibold">{x.total}</td>
                      <td className="py-1.5 pr-3">{x.unidade}</td>
                      <td className="py-1.5 text-center">☐</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {os.individuais && os.individuais.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-1 text-base font-semibold">Peças pedidas soltas</h2>
          <p className="mb-2 text-[11px] text-neutral-600">Fora de projeto padrão. Também somadas nos totais.</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
                <th className="py-1 pr-3">Código</th>
                <th className="py-1 pr-3">Peça</th>
                <th className="py-1 pr-3">Setor</th>
                <th className="py-1 pr-3 text-right">Qtd.</th>
                <th className="py-1 pr-3">Un.</th>
                <th className="py-1 pr-3">Destino · área</th>
                <th className="py-1 w-16 text-center">Sep.</th>
              </tr>
            </thead>
            <tbody>
              {os.individuais.map((x, i) => (
                <tr key={`${x.codigo}-${i}`} className="border-b border-neutral-300">
                  <td className="py-1.5 pr-3 font-medium">{x.codigo}</td>
                  <td className="py-1.5 pr-3">{x.nome}</td>
                  <td className="py-1.5 pr-3 text-[11px] text-neutral-600">{SETOR_LABEL[x.setor]}</td>
                  <td className="py-1.5 pr-3 text-right font-mono font-semibold">{x.quantidade}</td>
                  <td className="py-1.5 pr-3">{x.unidade}</td>
                  <td className="py-1.5 pr-3 text-[11px] text-neutral-600">{[x.destino, x.area].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="py-1.5 text-center">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
