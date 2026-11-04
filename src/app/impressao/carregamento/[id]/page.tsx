import Link from "next/link";
import { notFound } from "next/navigation";
import { aplicarCarregamento, linhasCarregamento, mudancasCarregamento, textoMudanca } from "@/domain/carregamento";
import { NaoEncontradoError } from "@/domain/errors";
import { cn } from "@/lib/cn";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { requirePermissao } from "@/server/auth/session";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { montarOsEstrutura } from "@/server/export/os-estrutura";
import { obterCarregamento } from "@/server/services/carregamento";
import { calcularOsAtual } from "@/server/services/os";
import { Icone } from "@/components/ui/icons";
import { ImprimirBotao } from "../../os/[id]/imprimir-botao";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  return { title: ev ? `Descarregamento ${ev.codigo} · ${ev.nome}` : "Descarregamento" };
}

/* Em tinta só, como as outras folhas; a coluna em branco é preenchida à mão no galpão. */
const th = "border-b border-ink py-1 pr-2 text-left text-micro font-semibold uppercase tracking-[0.04em] text-ink-2";
const td = "border-b border-line-strong py-1 pr-2 align-top text-pequeno";
const num = `${td} numero text-right font-semibold`;
const branco = "w-14 border-b border-line-strong py-1 align-top";

const fmt = (n: number) => n.toLocaleString("pt-BR");

type Linha = { rotulo: string; valor: number | string; destaque?: boolean };

function Bloco({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  if (linhas.length === 0) return null;
  return (
    <section className="mb-5">
      <table className="w-full border-collapse">
        <caption className="mb-1 text-left font-titulo text-bloco font-semibold">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>Item</th>
            <th scope="col" className={`${th} w-14 text-right`}>Foi</th>
            <th scope="col" className={`${th} w-14 pl-2 !pr-0 text-right`}>Voltou</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={cn("break-inside-avoid", l.destaque && "bg-subtle print:bg-transparent")}>
              <td className={`${td} [overflow-wrap:anywhere] ${l.destaque ? "font-semibold" : ""}`}>{l.rotulo}</td>
              <td className={num}>{typeof l.valor === "number" ? fmt(l.valor) : l.valor}</td>
              <td className={branco} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Folha de descarregamento: os blocos da folha de estrutura (aba TOTAL), com o que foi de fato carregado (os ajustes da aba
 * Carregamento já aplicados) e uma coluna em branco para anotar o que voltou. Sempre da OS de agora.
 */
export default async function ImpressaoCarregamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  const [os, ajustes] = await Promise.all([calcularOsAtual(await getDb(), id), obterCarregamento(id)]);
  const d = montarOsEstrutura(aplicarCarregamento(os, ajustes));
  const mudancas = mudancasCarregamento(linhasCarregamento(os, ajustes));
  const comTotal = (ls: ReadonlyArray<{ rotulo: string; total: number }>): Linha[] => ls.filter((l) => l.total > 0).map((l) => ({ rotulo: l.rotulo, valor: l.total }));
  const marcenaria: Linha[] = d.marcenaria.map((m) => (m.tipo === "secao" ? { rotulo: m.nome, valor: m.quantidade, destaque: true } : { rotulo: m.nome, valor: m.total }));
  const outros: Linha[] = d.outros.flatMap((o) => (o.valor == null ? [] : [{ rotulo: o.rotulo, valor: o.valor }]));

  return (
    <div className="mx-auto max-w-5xl rounded-cartao border border-line bg-surface p-5 text-corpo text-ink sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${id}/carregamento`} className="link inline-flex items-center gap-1 text-corpo max-md:min-h-10">
          <Icone nome="seta-esquerda" />
          Voltar para o carregamento
        </Link>
        <ImprimirBotao />
      </div>
      <header className="mb-5 border-b border-ink pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nortelog.svg" alt="NorteLog" className="mb-2 block h-6 w-auto" />
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.1em] text-ink-2">Folha de descarregamento</p>
        <h1 className="mb-0 mt-1 font-titulo text-manchete font-semibold">{ev.nome}</h1>
        <p className="numero mb-0 mt-1 text-pequeno text-ink-2">
          {[ev.codigo, formatarPeriodo(ev.dataInicio, ev.dataFim), ev.local, `Responsável: ${ev.responsavel.nome}`, `Gerada em ${formatarDataHora(new Date())}`].filter(Boolean).join(" · ")}
        </p>
        <p className="mb-0 mt-1 text-pequeno text-ink-2">&quot;Foi&quot; é o que saiu no carregamento, já com os ajustes. Anote em &quot;Voltou&quot; o que descarregou.</p>
      </header>

      {mudancas.length > 0 && (
        <section className="mb-5 break-inside-avoid border-l-2 border-ink py-1 pl-3 text-pequeno">
          <p className="m-0 font-medium">Diferente do pedido na OS:</p>
          <ul className="m-0 mt-1 list-none p-0">
            {mudancas.map((m) => (
              <li key={m.chave}>
                {textoMudanca(m)}
                {m.ajuste?.motivo ? `: ${m.ajuste.motivo}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A disposição da aba TOTAL da folha de estrutura. As tendas, que têm mais colunas, ficam na largura toda. */}
      <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
        <div>
          <Bloco titulo="Estruturas" linhas={d.estruturas.map((e) => ({ rotulo: e.nome, valor: e.quantidade }))} />
          <Bloco titulo="Marcenaria" linhas={marcenaria} />
        </div>
        <div>
          <Bloco titulo="Peças" linhas={comTotal(d.pecas)} />
        </div>
        <div>
          <Bloco titulo="Outros materiais" linhas={outros} />
          {d.q15 && <Bloco titulo="Q-15 kit" linhas={comTotal(d.q15)} />}
          <Bloco titulo="Estaiamento" linhas={comTotal(d.estaiamento)} />
        </div>
      </div>

      {d.tendas.map((t) => {
        const total = (i: number) => t.linhas.reduce((a, l) => a + (l.valores[i] ?? 0), 0);
        return (
          <section key={t.titulo} className="mb-5 break-inside-avoid overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <caption className="mb-1 text-left font-titulo text-bloco font-semibold">{t.titulo.charAt(0) + t.titulo.slice(1).toLocaleLowerCase("pt-BR")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>Local</th>
                  <th scope="col" className={`${th} text-right`}>Qtde</th>
                  {t.colunas.map((c) => (
                    <th key={c.codigo} scope="col" className={`${th} text-right`}>{c.rotulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.linhas.map((l) => (
                  <tr key={l.local}>
                    <td className={td}>{l.local}</td>
                    <td className={`${td} numero text-right`}>{fmt(l.quantidade)}</td>
                    {l.valores.map((v, i) => (
                      <td key={i} className={`${td} numero text-right`}>{fmt(v)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className={`${td} text-left font-semibold`}>Foi</th>
                  <td className={num}>{fmt(t.linhas.reduce((a, l) => a + l.quantidade, 0))}</td>
                  {t.colunas.map((c, i) => (
                    <td key={c.codigo} className={num}>{fmt(total(i))}</td>
                  ))}
                </tr>
                <tr className="h-8">
                  <th scope="row" className={`${td} text-left font-semibold`}>Voltou</th>
                  <td className={td} />
                  {t.colunas.map((c) => (
                    <td key={c.codigo} className={td} />
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      <footer className="mt-8 grid grid-cols-2 gap-8 text-rotulo text-ink-3 break-inside-avoid">
        <div className="border-t border-ink pt-2">Descarregado por / data</div>
        <div className="border-t border-ink pt-2">Conferido por / data</div>
      </footer>
    </div>
  );
}
