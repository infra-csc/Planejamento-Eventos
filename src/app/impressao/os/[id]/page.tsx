import { requirePermissao } from "@/server/auth/session";
import Link from "next/link";
import { obterEventoCache } from "@/server/cache";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETOR_LABEL } from "@/domain/os";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { ImprimirBotao } from "./imprimir-botao";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  // Vira o nome sugerido do PDF ao imprimir.
  return { title: ev ? `OS ${ev.codigo}${v ? ` v${v}` : ""} · ${ev.nome}` : "OS" };
}

/* Tipografia do design system, em tinta só (sem cores de tela): cabeçalho de tabela em caixa-alta pequena,
   números tabulares à direita, códigos em mono. Cada tabela rola sozinha na tela estreita; no papel, não. */
const tabela = "w-full min-w-[560px] border-collapse print:min-w-0";
const cabecalho = "border-b border-ink text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2";
const th = "py-1.5 pr-3 font-semibold";
const linha = "border-b border-line-strong";
const td = "py-1.5 pr-3 align-top";
const num = "numero py-1.5 pr-3 text-right align-top";
const sep = "w-14 py-1.5 text-center align-top";

function Rolagem({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto print:overflow-visible">{children}</div>;
}

export default async function ImpressaoOsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const { v } = await searchParams;
  const [ev, versoes] = await Promise.all([obterEventoCache(usuario, id), listarOsResumo(id)]);
  const sel = v ? versoes.find((x) => String(x.numero) === v) : versoes[0];
  const os = (sel && v ? (await obterConteudosOs(id, [sel.numero])).get(sel.numero) : undefined) ?? (await calcularOsAtual(await getDb(), id));

  return (
    <div className="mx-auto max-w-4xl rounded-cartao border border-line bg-surface p-5 text-corpo text-ink sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${id}/os`} className="link inline-flex items-center gap-1 text-corpo">
          <Icone nome="seta-esquerda" />
          Voltar para a OS
        </Link>
        <ImprimirBotao />
      </div>
      <header className="mb-6 border-b border-ink pb-4">
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.1em] text-ink-2">Norte Mkt · Ordem de serviço</p>
        <h1 className="mb-0 mt-1 text-pagina font-semibold tracking-[-0.02em]">
          <Codigo>{ev.codigo}</Codigo> · {ev.nome}
        </h1>
        <dl className="mb-0 mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-pequeno sm:grid-cols-4">
          <div>
            <dt className="text-ink-3">Evento</dt>
            <dd className="numero m-0">{formatarPeriodo(ev.dataInicio, ev.dataFim)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Reunião de OS</dt>
            <dd className="numero m-0">{formatarDataHora(ev.dataReuniao)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Local</dt>
            <dd className="m-0">{ev.local || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Versão</dt>
            <dd className="m-0">
              {v && sel ? (
                <>
                  <Codigo>v{sel.numero}</Codigo> <span className="numero">({formatarDataHora(sel.geradaEm)})</span>
                </>
              ) : versoes[0] ? (
                <>
                  <Codigo>v{versoes[0].numero}</Codigo> · atual
                </>
              ) : (
                "prévia"
              )}
            </dd>
          </div>
        </dl>
      </header>

      <h2 className="mb-3 mt-0 text-titulo font-semibold">Totais por peça</h2>
      {os.setores.map((s) => (
        <section key={s.setor} className="mb-8 break-inside-avoid">
          <h3 className="mb-2 mt-0 text-destaque font-semibold">{SETOR_LABEL[s.setor]}</h3>
          <Rolagem>
            <table className={tabela}>
              <thead>
                <tr className={cabecalho}>
                  <th scope="col" className={th}>Código</th>
                  <th scope="col" className={th}>Peça</th>
                  <th scope="col" className={`${th} text-right`}>Total</th>
                  <th scope="col" className={th}>Un.</th>
                  <th scope="col" className={th}>Composição</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                </tr>
              </thead>
              <tbody>
                {s.linhas.map((l) => (
                  <tr key={l.pecaId} className={linha}>
                    <td className={`${td} text-pequeno`}>
                      <Codigo>{l.codigo}</Codigo>
                    </td>
                    <td className={td}>{l.nome}</td>
                    <td className={`${num} font-semibold`}>{l.total}</td>
                    <td className={`${td} text-pequeno text-ink-2`}>{l.unidade}</td>
                    <td className={`${td} text-rotulo text-ink-3`}>{l.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · ")}</td>
                    <td className={sep}>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rolagem>
        </section>
      ))}

      {os.projetos && os.projetos.length > 0 && (
        <section className="mb-8 break-before-page">
          <h2 className="mb-1 mt-0 text-titulo font-semibold">Por projeto</h2>
          <p className="mb-4 mt-0 text-pequeno text-ink-3">O que cada projeto padrão leva, já com os ajustes pedidos pela área. As mesmas peças estão somadas nos totais acima.</p>
          {os.projetos.map((p, i) => (
            <div key={`${p.codigo}-${i}`} className="mb-6 break-inside-avoid">
              <h3 className="mb-0.5 mt-0 flex flex-wrap items-baseline gap-x-2 text-secao font-semibold">
                {p.nome}
                <span className="numero">× {p.quantidade}</span>
                <Codigo className="text-rotulo font-normal text-ink-3">
                  {p.codigo} · v{p.versao}
                </Codigo>
              </h3>
              <p className="mb-2 mt-0 text-rotulo text-ink-3">{[p.destino ? `Destino: ${p.destino}` : null, p.area, `${p.pecas.length} tipos de peça · ${p.pecas.reduce((a, x) => a + x.total, 0)} unidades`].filter(Boolean).join(" · ")}</p>
              <Rolagem>
                <table className={tabela}>
                  <thead>
                    <tr className={cabecalho}>
                      <th scope="col" className={th}>Código</th>
                      <th scope="col" className={th}>Peça</th>
                      <th scope="col" className={th}>Setor</th>
                      <th scope="col" className={`${th} text-right`}>Por un.</th>
                      <th scope="col" className={`${th} text-right`}>Total</th>
                      <th scope="col" className={th}>Un.</th>
                      <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.pecas.map((x) => (
                      <tr key={x.codigo} className={linha}>
                        <td className={`${td} text-pequeno`}>
                          <Codigo>{x.codigo}</Codigo>
                        </td>
                        <td className={td}>{x.nome}</td>
                        <td className={`${td} text-rotulo text-ink-3`}>{SETOR_LABEL[x.setor]}</td>
                        <td className={num}>{x.porUnidade}</td>
                        <td className={`${num} font-semibold`}>{x.total}</td>
                        <td className={`${td} text-pequeno text-ink-2`}>{x.unidade}</td>
                        <td className={sep}>☐</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Rolagem>
            </div>
          ))}
        </section>
      )}

      {os.individuais && os.individuais.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-1 mt-0 text-destaque font-semibold">Peças pedidas soltas</h2>
          <p className="mb-2 mt-0 text-rotulo text-ink-3">Fora de projeto padrão. Também somadas nos totais.</p>
          <Rolagem>
            <table className={tabela}>
              <thead>
                <tr className={cabecalho}>
                  <th scope="col" className={th}>Código</th>
                  <th scope="col" className={th}>Peça</th>
                  <th scope="col" className={th}>Setor</th>
                  <th scope="col" className={`${th} text-right`}>Qtd.</th>
                  <th scope="col" className={th}>Un.</th>
                  <th scope="col" className={th}>Destino · área</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                </tr>
              </thead>
              <tbody>
                {os.individuais.map((x, i) => (
                  <tr key={`${x.codigo}-${i}`} className={linha}>
                    <td className={`${td} text-pequeno`}>
                      <Codigo>{x.codigo}</Codigo>
                    </td>
                    <td className={td}>{x.nome}</td>
                    <td className={`${td} text-rotulo text-ink-3`}>{SETOR_LABEL[x.setor]}</td>
                    <td className={`${num} font-semibold`}>{x.quantidade}</td>
                    <td className={`${td} text-pequeno text-ink-2`}>{x.unidade}</td>
                    <td className={`${td} text-rotulo text-ink-3`}>{[x.destino, x.area].filter(Boolean).join(" · ") || "—"}</td>
                    <td className={sep}>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rolagem>
        </section>
      )}

      {os.semSetor.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-2 mt-0 text-destaque font-semibold">Itens fora do catálogo</h2>
          <Rolagem>
            <table className={tabela}>
              <thead>
                <tr className={cabecalho}>
                  <th scope="col" className={th}>Descrição</th>
                  <th scope="col" className={`${th} text-right`}>Qtd.</th>
                  <th scope="col" className={th}>Destino</th>
                  <th scope="col" className={th}>Área</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                </tr>
              </thead>
              <tbody>
                {os.semSetor.map((a, i) => (
                  <tr key={i} className={linha}>
                    <td className={td}>{a.descricao}</td>
                    <td className={`${num} font-semibold`}>{a.quantidade}</td>
                    <td className={td}>{a.destino ?? "—"}</td>
                    <td className={td}>{a.area ?? "—"}</td>
                    <td className={sep}>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rolagem>
        </section>
      )}
      <footer className="mt-10 grid grid-cols-2 gap-8 text-rotulo text-ink-3">
        <div className="border-t border-ink pt-2">Separado por / data</div>
        <div className="border-t border-ink pt-2">Conferido por / data</div>
      </footer>
    </div>
  );
}
