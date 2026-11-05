import Link from "next/link";
import { notFound } from "next/navigation";
import { NaoEncontradoError } from "@/domain/errors";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { requirePermissao } from "@/server/auth/session";
import { obterEventoCache } from "@/server/cache";
import { documentoFornecedor } from "@/server/services/projecao";
import { Icone } from "@/components/ui/icons";
import { ImprimirBotao } from "../../os/[id]/imprimir-botao";

export const metadata = { title: "Documento técnico para o fornecedor" };

const th = "border-b border-ink py-1 pr-2 text-left text-micro font-semibold uppercase tracking-[0.04em] text-ink-2";
const td = "border-b border-line-strong py-1 pr-2 align-top text-pequeno";

type Bloco = { id: string; nome: string; quantidade: number; destino: string | null; montador: string | null; pecas: Array<{ codigo: string; nome: string; unidade: string; total: number }> };

function Blocos({ lista }: { lista: Bloco[] }) {
  return (
    <>
      {lista.map((b) => (
        <section key={b.id} className="mb-5 break-inside-avoid">
          <h3 className="m-0 mb-1 font-titulo text-bloco font-semibold">
            {b.nome} × {b.quantidade.toLocaleString("pt-BR")}
            <span className="ml-2 font-sans text-pequeno font-normal text-ink-2">{[b.destino, b.montador ? `para ${b.montador}` : null].filter(Boolean).join(" · ")}</span>
          </h3>
          {b.pecas.length > 0 && (
            <table className="w-full border-collapse">
              <caption className="sr-only">Peças de {b.nome}</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${th} w-40`}>Código</th>
                  <th scope="col" className={th}>Peça</th>
                  <th scope="col" className={`${th} w-20 text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {b.pecas.map((p) => (
                  <tr key={p.codigo}>
                    <td className={`${td} font-mono`}>{p.codigo}</td>
                    <td className={td}>{p.nome}</td>
                    <td className={`${td} numero text-right font-semibold`}>{p.total.toLocaleString("pt-BR")} {p.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}

/** Documento técnico em PDF: só as linhas terceirizadas, com box truss e tendas, mais a lista "Enviado pela Norte". */
export default async function ImpressaoFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("logistica.cadastros");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  const d = await documentoFornecedor(id);
  return (
    <div className="mx-auto max-w-4xl rounded-cartao border border-line bg-surface p-5 text-corpo text-ink sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${id}/logistica`} className="link inline-flex items-center gap-1 text-corpo max-md:min-h-10">
          <Icone nome="seta-esquerda" />
          Voltar para a logística do evento
        </Link>
        <ImprimirBotao />
      </div>
      <header className="mb-5 border-b border-ink pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nortelog.svg" alt="NorteLog" className="mb-2 block h-6 w-auto" />
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.1em] text-ink-2">Documento técnico para o fornecedor</p>
        <h1 className="mb-0 mt-1 font-titulo text-manchete font-semibold">{ev.nome}</h1>
        <p className="numero mb-0 mt-1 text-pequeno text-ink-2">{[ev.codigo, formatarPeriodo(ev.dataInicio, ev.dataFim), ev.local, d.evento.fornecedorEstrutura, `Gerado em ${formatarDataHora(new Date())}`].filter(Boolean).join(" · ")}</p>
      </header>
      {d.terceirizadas.length === 0 && d.enviadoPelaNorte.length === 0 && <p className="m-0 text-corpo text-ink-2">Este evento não tem linha terceirizada nem complemento ao montador.</p>}
      {d.terceirizadas.length > 0 && <Blocos lista={d.terceirizadas} />}
      {d.enviadoPelaNorte.length > 0 && (
        <>
          <h2 className="m-0 mb-2 mt-6 font-titulo text-dialogo font-semibold">Enviado pela Norte</h2>
          <Blocos lista={d.enviadoPelaNorte} />
        </>
      )}
      {d.pdfs.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="m-0 mb-2 font-titulo text-dialogo font-semibold">PDFs dos projetos</h2>
          <ul className="m-0 list-none p-0 text-pequeno">
            {d.pdfs.map((p) => (
              <li key={p.id} className="border-b border-line-strong py-1">
                {p.projeto}: <a href={`/api/anexos/${p.id}`} className="link">{p.nomeArquivo}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
