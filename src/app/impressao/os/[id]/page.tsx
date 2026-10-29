import { osParaLeitura } from "@/domain/os";
import { requirePermissao } from "@/server/auth/session";
import Link from "next/link";
import { obterEventoCache } from "@/server/cache";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { grupoDoCodigo } from "@/domain/grupos-material";
import { montarFolhaSeparacao, standsDaOs, type SecaoFolha } from "@/domain/folha-separacao";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { Icone } from "@/components/ui/icons";
import { ImprimirBotao } from "./imprimir-botao";
import { obterSeparacao } from "@/server/services/separacao";
import { pecaDeEstruturaLocada } from "@/server/export/os-estrutura";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  // Vira o nome sugerido do PDF ao imprimir.
  return { title: ev ? `OS ${ev.nome}${v ? ` v${v}` : ""}` : "OS" };
}

/* Tipografia do design system, em tinta só (sem cores de tela): cabeçalho de tabela em caixa-alta pequena,
   números tabulares à direita. Folha de quem separa: só o total, peça e quantidade (sem código, composição nem a quebra por projeto). */
const tabela = "w-full table-fixed sm:min-w-[420px] border-collapse [overflow-wrap:anywhere] print:min-w-0";
const cabecalho = "border-b border-ink text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2";
const th = "py-1.5 pr-3 font-semibold";
// Linha um pouco mais alta: a folha é impressa e a equipe escreve na coluna Obs.
const linha = "h-9 border-b border-line-strong";
const td = "py-1.5 pr-3 align-top";
const num = "numero py-1.5 pr-3 text-right align-top";
const sep = "w-14 py-1.5 text-center align-top";
/** Observação escrita à mão na folha impressa: célula em branco com a linha de baixo. */
const obs = "w-[34%] py-1.5 align-top not-print:max-sm:hidden";

/** Quantidade com a unidade só quando não é "un" (12 m, 4 par); milhar com ponto, como na tela da OS (1.520). */
const fmt = (n: number) => n.toLocaleString("pt-BR");
const qtd = (n: number, unidade: string) => (unidade && unidade !== "un" ? `${fmt(n)} ${unidade}` : fmt(n));

function Rolagem({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto print:overflow-visible">{children}</div>;
}

export default async function ImpressaoOsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const { v } = await searchParams;
  const [ev, versoes, mapa, separacao] = await Promise.all([obterEventoCache(usuario, id), listarOsResumo(id), mapaGruposPecas(), obterSeparacao(id)]);
  const sel = v ? versoes.find((x) => String(x.numero) === v) : versoes[0];
  // O prisma comum são 2 grades, já somadas na grade: não sai como item à parte.
  const os = osParaLeitura((sel && v ? (await obterConteudosOs(id, [sel.numero])).get(sel.numero) : undefined) ?? (await calcularOsAtual(await getDb(), id)));
  // Estrutura locada no local (marcada na OS): box Q30, tendas e estaiamento (e o Q15, se marcado) não vão na folha.
  const vai = (codigo: string, nome: string) => !separacao.locada || !pecaDeEstruturaLocada(codigo, { q15: separacao.q15Locado, nome });
  // Na ordem da lista de carregamento da logística (domain/folha-separacao), com cinta catraca e corda pela regra.
  const secoes = montarFolhaSeparacao(
    os.setores.flatMap((s) => s.linhas.filter((l) => vai(l.codigo, l.nome)).map((l) => ({ ...l, setor: s.setor, grupo: grupoDoCodigo(mapa, l.codigo, s.setor) }))),
    // Estrutura locada: sem estaio, então também sem a cinta catraca de 4 por stand.
    { stands: separacao.locada ? 0 : standsDaOs(os.projetos) },
  );
  const antesDaMarcenaria = secoes.filter((x) => !x.bloco);
  const marcenaria = secoes.filter((x) => x.bloco);

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
        <h1 className="mb-0 mt-1 text-pagina font-semibold tracking-[-0.02em]">{ev.nome}</h1>
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
            <dd className="numero m-0">{v && sel ? `v${sel.numero} (${formatarDataHora(sel.geradaEm)})` : versoes[0] ? `v${versoes[0].numero} · atual` : "prévia"}</dd>
          </div>
        </dl>
      </header>

      <h2 className="mb-1 mt-0 text-titulo font-semibold">Separação</h2>
      <p className="mb-4 mt-0 text-pequeno text-ink-3">Tudo o que vai para o evento, somado por peça. Marque ao separar.</p>
      {separacao.locada && (
        <p className="mb-5 mt-0 border-l-2 border-ink py-1 pl-3 text-pequeno font-medium">
          Estrutura locada no local: box truss Q30, tendas e estaio (tina, pallet de ferro, cinta catraca, malote, estaca e corda){separacao.q15Locado ? " e box Q15" : ""} não estão nesta folha.
        </p>
      )}
      {antesDaMarcenaria.map((secao) => (
        <TabelaSecao key={secao.id} secao={secao} />
      ))}

      {os.semSetor.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h3 className="mb-2 mt-0 text-destaque font-semibold">Materiais fora de catálogo</h3>
          <Rolagem>
            {/* Cinco colunas não cabem em 375 px: no celular esta rola de lado; as de peça cabem sem Obs. */}
            <table className={`${tabela} min-w-[420px]`}>
              <thead>
                <tr className={cabecalho}>
                  <th scope="col" className={th}>Item</th>
                  <th scope="col" className={`${th} w-28 text-right`}>Quantidade</th>
                  <th scope="col" className={`${th} w-[24%]`}>Local · área</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                  <th scope="col" className={`${th} w-[26%] pl-3 not-print:max-sm:hidden`}>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {os.semSetor.map((a, i) => (
                  <tr key={i} className={linha}>
                    <td className={td}>{a.descricao}</td>
                    <td className={`${num} font-semibold`}>{fmt(a.quantidade)}</td>
                    <td className={`${td} text-rotulo text-ink-3`}>{[a.destino, a.area].filter(Boolean).join(" · ") || "—"}</td>
                    <td className={sep}>☐</td>
                    <td className={`${obs} !w-[26%]`} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Rolagem>
        </section>
      )}

      {marcenaria.length > 0 && (
        <>
          <h3 className="mb-3 mt-0 text-destaque font-semibold">Marcenaria</h3>
          {marcenaria.map((secao) => (
            <TabelaSecao key={secao.id} secao={secao} sub />
          ))}
        </>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-8 text-rotulo text-ink-3">
        <div className="border-t border-ink pt-2">Separado por / data</div>
        <div className="border-t border-ink pt-2">Conferido por / data</div>
      </footer>
    </div>
  );
}

/** Uma seção da folha: peça (com a regra, quando a quantidade vem dela), quantidade, separado e observação à mão. */
function TabelaSecao({ secao, sub = false }: { secao: SecaoFolha; sub?: boolean }) {
  return (
    <section className="mb-8 break-inside-avoid">
      {sub ? <h4 className="mb-2 mt-0 text-corpo font-semibold uppercase tracking-[0.04em] text-ink-2">{secao.titulo}</h4> : <h3 className="mb-2 mt-0 text-destaque font-semibold">{secao.titulo}</h3>}
      <Rolagem>
        <table className={tabela}>
          <thead>
            <tr className={cabecalho}>
              <th scope="col" className={th}>Peça</th>
              <th scope="col" className={`${th} w-28 text-right`}>Quantidade</th>
              <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
              <th scope="col" className={`${th} w-[34%] pl-3 not-print:max-sm:hidden`}>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {secao.linhas.map((l) => (
              <tr key={l.chave} className={linha}>
                <td className={td}>
                  {l.nome}
                  {l.nota && <span className="block text-rotulo text-ink-3">{l.nota}</span>}
                </td>
                <td className={`${num} font-semibold`}>{qtd(l.total, l.unidade)}</td>
                <td className={sep}>☐</td>
                <td className={obs} />
              </tr>
            ))}
          </tbody>
        </table>
      </Rolagem>
    </section>
  );
}
