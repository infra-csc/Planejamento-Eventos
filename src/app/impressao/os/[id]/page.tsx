import { requirePermissao } from "@/server/auth/session";
import Link from "next/link";
import { obterEventoCache } from "@/server/cache";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { GRUPO_LABEL, totaisPorGrupo, type GrupoMaterial } from "@/domain/grupos-material";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { Icone } from "@/components/ui/icons";
import { ImprimirBotao } from "./imprimir-botao";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  // Vira o nome sugerido do PDF ao imprimir.
  return { title: ev ? `OS ${ev.nome}${v ? ` v${v}` : ""}` : "OS" };
}

/* Tipografia do design system, em tinta só (sem cores de tela): cabeçalho de tabela em caixa-alta pequena,
   números tabulares à direita. Folha de quem separa: só o total, peça e quantidade (sem código, composição nem a quebra por projeto). */
const tabela = "w-full min-w-[420px] table-fixed border-collapse [overflow-wrap:anywhere] print:min-w-0";
const cabecalho = "border-b border-ink text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2";
const th = "py-1.5 pr-3 font-semibold";
const linha = "border-b border-line-strong";
const td = "py-1.5 pr-3 align-top";
const num = "numero py-1.5 pr-3 text-right align-top";
const sep = "w-14 py-1.5 text-center align-top";

/** Mesma ordem da conferência da ata (a reunião passa pelos materiais assim). */
const ORDEM: readonly GrupoMaterial[] = ["PERCURSO", "TENDAS", "ESTRUTURA", "ATIVACAO", "ARENA", "OUTROS"];
/** Quantidade com a unidade só quando não é "un" (12 m, 4 par). */
const qtd = (n: number, unidade: string) => (unidade && unidade !== "un" ? `${n} ${unidade}` : String(n));

function Rolagem({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto print:overflow-visible">{children}</div>;
}

export default async function ImpressaoOsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requirePermissao("os.exportar");
  const { id } = await params;
  const { v } = await searchParams;
  const [ev, versoes, mapa] = await Promise.all([obterEventoCache(usuario, id), listarOsResumo(id), mapaGruposPecas()]);
  const sel = v ? versoes.find((x) => String(x.numero) === v) : versoes[0];
  const os = (sel && v ? (await obterConteudosOs(id, [sel.numero])).get(sel.numero) : undefined) ?? (await calcularOsAtual(await getDb(), id));
  const grupos = totaisPorGrupo(os.setores, mapa).sort((a, b) => ORDEM.indexOf(a.grupo) - ORDEM.indexOf(b.grupo));

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
      {grupos.map((s) => (
        <section key={s.grupo} className="mb-8 break-inside-avoid">
          <h3 className="mb-2 mt-0 text-destaque font-semibold">{GRUPO_LABEL[s.grupo]}</h3>
          <Rolagem>
            <table className={tabela}>
              <thead>
                <tr className={cabecalho}>
                  <th scope="col" className={th}>Peça</th>
                  <th scope="col" className={`${th} w-28 text-right`}>Quantidade</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                </tr>
              </thead>
              <tbody>
                {[...s.linhas]
                  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                  .map((l) => (
                    <tr key={l.pecaId} className={linha}>
                      <td className={td}>{l.nome}</td>
                      <td className={`${num} font-semibold`}>{qtd(l.total, l.unidade)}</td>
                      <td className={sep}>☐</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Rolagem>
        </section>
      ))}

      {os.semSetor.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h3 className="mb-2 mt-0 text-destaque font-semibold">Fora do catálogo</h3>
          <Rolagem>
            <table className={tabela}>
              <thead>
                <tr className={cabecalho}>
                  <th scope="col" className={th}>Item</th>
                  <th scope="col" className={`${th} w-28 text-right`}>Quantidade</th>
                  <th scope="col" className={`${th} w-[30%]`}>Local · área</th>
                  <th scope="col" className="w-14 py-1.5 text-center font-semibold">Sep.</th>
                </tr>
              </thead>
              <tbody>
                {os.semSetor.map((a, i) => (
                  <tr key={i} className={linha}>
                    <td className={td}>{a.descricao}</td>
                    <td className={`${num} font-semibold`}>{a.quantidade}</td>
                    <td className={`${td} text-rotulo text-ink-3`}>{[a.destino, a.area].filter(Boolean).join(" · ") || "—"}</td>
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
