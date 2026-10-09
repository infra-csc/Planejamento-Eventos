import Link from "next/link";
import type { MudancaPosAta } from "@/server/services/solicitacoes";
import { cn } from "@/lib/cn";
import { diaMesHora, tempoRelativo } from "@/lib/format";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";

/** Ajuste feito direto pela logística depois da ata (vem do histórico do evento). */
export type AjustePosAta = { id: string; titulo: string; autor: string | null; quando: Date; href: string };

type Linha =
  | { tipo: "pedido"; quando: number; m: MudancaPosAta & { codigoVisivel: boolean } }
  | { tipo: "ajuste"; quando: number; a: AjustePosAta };

const SINAL: Record<MudancaPosAta["tipo"] | "ajuste", { icone: NomeIcone; cls: string; rotulo: string }> = {
  entrou: { icone: "mais", cls: "border-success-border bg-success-bg text-success", rotulo: "entrou" },
  mudou: { icone: "lapis", cls: "border-warning-border bg-warning-bg text-warning", rotulo: "mudou" },
  saiu: { icone: "menos", cls: "border-danger-border bg-danger-bg text-danger", rotulo: "saiu" },
  ajuste: { icone: "lapis", cls: "border-line-strong bg-subtle text-ink-3", rotulo: "ajuste da logística" },
};

const COMO: Record<MudancaPosAta["como"], string> = { direto: "entrou direto (dentro da janela)", logistica: "aceita pela logística", parcial: "aceita em parte pela logística" };

/**
 * O que mudou no evento depois da reunião de OS, em destaque: cada item que entrou, mudou ou saiu por
 * pedido das áreas (com quem pediu e como entrou) e os ajustes que a logística fez direto. A ata em si
 * não muda; tudo isto já está na OS.
 */
export function MudancasPosAta({
  mudancas,
  ajustes,
  ataFechadaEm,
  hrefOs,
  maximo = 8,
}: {
  mudancas: Array<MudancaPosAta & { codigoVisivel: boolean }>;
  ajustes: AjustePosAta[];
  ataFechadaEm: Date;
  /** Diferença entre a OS da ata e a atual (só para quem vê a OS). */
  hrefOs?: string | null;
  maximo?: number;
}) {
  const agora = new Date();
  const linhas: Linha[] = [
    ...mudancas.map((m) => ({ tipo: "pedido" as const, quando: m.quando?.getTime() ?? 0, m })),
    ...ajustes.map((a) => ({ tipo: "ajuste" as const, quando: a.quando.getTime(), a })),
  ].sort((x, y) => y.quando - x.quando);
  const n = (t: MudancaPosAta["tipo"]) => mudancas.filter((m) => m.tipo === t).length;
  const contagens = [
    { chave: "entrou" as const, n: n("entrou"), texto: (k: number) => (k === 1 ? "entrou" : "entraram") },
    { chave: "mudou" as const, n: n("mudou"), texto: (k: number) => (k === 1 ? "mudou" : "mudaram") },
    { chave: "saiu" as const, n: n("saiu"), texto: (k: number) => (k === 1 ? "saiu" : "saíram") },
  ].filter((c) => c.n > 0);

  const linha = (l: Linha) => {
    const s = SINAL[l.tipo === "pedido" ? l.m.tipo : "ajuste"];
    const href = l.tipo === "pedido" ? (l.m.codigoVisivel ? `/solicitacoes/${l.m.solicitacaoId}` : null) : l.a.href;
    const corpo = (
      <>
        <span aria-hidden className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border", s.cls)}>
          <Icone nome={s.icone} className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-corpo text-ink">
            <span className="sr-only">{s.rotulo}: </span>
            {l.tipo === "pedido" ? l.m.item : l.a.titulo}
            {l.tipo === "pedido" && l.m.destino && <span className="text-muted"> · {l.m.destino}</span>}
          </span>
          <span className="mt-0.5 block text-pequeno text-muted">
            {l.tipo === "pedido" ? (
              <>
                {l.m.codigoVisivel && (
                  <>
                    <Codigo className="text-ink-3">{l.m.codigo}</Codigo> ·{" "}
                  </>
                )}
                {l.m.area} · {l.m.quem} · <span className={l.m.como === "direto" ? "text-ink-2" : undefined}>{COMO[l.m.como]}</span>
              </>
            ) : (
              <>Ajuste da logística{l.a.autor ? ` · ${l.a.autor}` : ""}</>
            )}
            {l.quando > 0 && (
              <>
                {" · "}
                <time dateTime={new Date(l.quando).toISOString()} title={diaMesHora(new Date(l.quando))}>
                  {tempoRelativo(new Date(l.quando), agora)}
                </time>
              </>
            )}
          </span>
        </span>
        {l.tipo === "pedido" && <span className={cn("numero shrink-0 pt-0.5 text-corpo font-semibold", l.m.tipo === "entrou" ? "text-success" : l.m.tipo === "saiu" ? "text-danger" : "text-ink")}>{l.m.quantidade}</span>}
      </>
    );
    const cls = "flex items-start gap-3 border-b border-line-row px-cartao py-2.5 last:border-b-0";
    return (
      <li key={`${l.tipo}-${l.tipo === "pedido" ? l.m.id : l.a.id}`}>
        {href ? (
          <Link href={href} className={cn(cls, "no-underline transition-colors duration-150 hover:bg-subtle")}>
            {corpo}
          </Link>
        ) : (
          <div className={cls}>{corpo}</div>
        )}
      </li>
    );
  };

  return (
    <section id="mudancas" aria-labelledby="mudancas-titulo" className="alvo-ancora overflow-hidden rounded-cartao border border-l-4 border-info-border border-l-info bg-surface">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-line-soft px-cartao py-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="mudancas-titulo" className="m-0 flex items-center gap-2 text-secao font-semibold tracking-[-0.01em]">
            <Icone nome="camadas" className="text-info" />
            O que mudou depois da reunião
            {linhas.length > 0 && <Numero valor={linhas.length} className="rounded-chip bg-info-bg px-1.5 text-rotulo font-semibold text-info" />}
          </h2>
          <p className="mb-0 mt-0.5 text-pequeno text-muted">
            Ata fechada em <span className="numero">{diaMesHora(ataFechadaEm)}</span>. A ata não muda: tudo isto já está na OS.
          </p>
          {contagens.length > 0 && (
            <p className="mb-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-pequeno font-medium">
              {contagens.map((c) => (
                <span key={c.chave} className={cn("inline-flex items-center gap-1", c.chave === "entrou" ? "text-success" : c.chave === "saiu" ? "text-danger" : "text-warning")}>
                  <Icone nome={SINAL[c.chave].icone} className="size-3.5" />
                  <Numero valor={c.n} /> {c.n === 1 ? "item" : "itens"} {c.texto(c.n)}
                </span>
              ))}
              {ajustes.length > 0 && (
                <span className="inline-flex items-center gap-1 text-ink-3">
                  <Icone nome="lapis" className="size-3.5" />
                  <Numero valor={ajustes.length} /> {ajustes.length === 1 ? "ajuste" : "ajustes"} da logística
                </span>
              )}
            </p>
          )}
        </div>
        {hrefOs && linhas.length > 0 && (
          <Link href={hrefOs} className="link shrink-0 text-pequeno">
            Ver a diferença na OS
          </Link>
        )}
      </div>
      {linhas.length === 0 ? (
        <p className="m-0 flex items-center gap-2 px-cartao py-3.5 text-pequeno text-muted">
          <Icone nome="check-circulo" className="shrink-0 text-ink-3" />
          Nada mudou desde a ata.
        </p>
      ) : (
        <>
          <ul className="m-0 list-none p-0">{linhas.slice(0, maximo).map(linha)}</ul>
          {linhas.length > maximo && (
            <details className="group border-t border-line-row">
              <summary className="flex cursor-pointer list-none items-center gap-1 px-cartao py-2.5 text-pequeno font-medium text-accent hover:underline [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">
                  Ver as outras <Numero valor={linhas.length - maximo} />
                </span>
                <span className="hidden group-open:inline">Mostrar menos</span>
                <Icone nome="chevron-baixo" className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <ul className="m-0 list-none border-t border-line-row p-0">{linhas.slice(maximo).map(linha)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
