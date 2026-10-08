import Link from "next/link";
import { cn } from "@/lib/cn";
import { addDiasISO, diaMes, diaSemanaCurto, formatarDataHora, hora, isoSP, tempoRelativo } from "@/lib/format";
import { Icone, type NomeIcone } from "@/components/ui/icons";

export type TomEntrada = "neutro" | "info" | "success" | "warning" | "danger";

export type EntradaTempo = {
  id: string;
  em: Date | string;
  titulo: string;
  detalhe?: string | null;
  autor?: string | null;
  icone: NomeIcone;
  tom: TomEntrada;
  /** Marca curta ao lado do título (ex.: item da solicitação a que a entrada se refere). */
  marcador?: string | null;
  href?: string;
};

const COR: Record<TomEntrada, string> = {
  neutro: "border-line-strong bg-surface text-ink-3",
  info: "border-info-border bg-info-bg text-info",
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
  danger: "border-danger-border bg-danger-bg text-danger",
};

/**
 * Ícone e tom de um registro do histórico, pela ação (e, sem regra própria, pela entidade).
 * Só apresentação: a classificação de negócio continua em `domain/historico`.
 */
export function iconeHistorico(entidade: string | null, acao: string): { icone: NomeIcone; tom: TomEntrada } {
  switch (acao) {
    case "INICIAR_REUNIAO":
      return { icone: "calendario", tom: "info" };
    case "FECHAR_ATA":
    case "ENCERRAR":
    case "CONFERIDO":
      return { icone: "check-circulo", tom: "success" };
    case "CANCELAR":
    case "CANCELADA":
      return { icone: "erro", tom: "danger" };
    case "REABRIR":
    case "REUNIAO_REMARCADA":
      return { icone: "relogio", tom: "warning" };
    case "VOLTAR_PREPARACAO":
    case "DEVOLVIDA":
    case "RESPOSTA_DESFEITA":
      return { icone: "seta-esquerda", tom: "warning" };
    case "OS_ENVIADA":
      return { icone: "caixa", tom: "info" };
    case "ENVIADA":
      return { icone: "solicitacoes", tom: "info" };
    case "RASCUNHO_CRIADO":
    case "CRIADA":
    case "CRIADO":
      return { icone: "mais", tom: "neutro" };
    case "EDITADO":
    case "EDITADA":
    case "ALTERADA":
      return { icone: "lapis", tom: "neutro" };
    case "RESPONDIDO":
      return { icone: "check", tom: "success" };
    case "RESPOSTA_CORRIGIDA":
      return { icone: "lapis", tom: "warning" };
    case "ATA_REMOCAO":
    case "REMOVER":
      return { icone: "menos", tom: "danger" };
    case "AJUSTE_INCLUSAO":
    case "ADICIONAR":
    case "REGISTRADO_NA_ATA":
      return { icone: "mais", tom: "info" };
    case "ITEM_VINCULADO":
    case "ATUALIZACAO_VERSAO":
      return { icone: "camadas", tom: "info" };
    case "ATA_QUANTIDADE":
    case "CONFERENCIA_AJUSTE":
    case "PECA_PROJETO_AJUSTADA":
    case "ALTERAR_QUANTIDADE":
      return { icone: "lapis", tom: "warning" };
  }
  if (entidade === "solicitacao") return { icone: "solicitacoes", tom: "info" };
  if (entidade === "solicitacao_item") return { icone: "check", tom: "success" };
  if (entidade === "evento_item") return { icone: "lapis", tom: "warning" };
  if (entidade === "evento") return { icone: "calendario", tom: "neutro" };
  return { icone: "info", tom: "neutro" };
}

/** "Hoje", "Ontem", "Há 5 dias" — o rótulo relativo do grupo do dia. */
function rotuloDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  if (dia === addDiasISO(hoje, -1)) return "Ontem";
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000);
  if (dias > 0 && dias < 60) return `Há ${dias} dias`;
  return dias < 0 ? "Agendado" : `Há ${Math.round(dias / 30)} meses`;
}

/** Hora da entrada: relativa (hoje / painéis) ou do dia; data e hora completas no `title`. */
function Hora({ em, relativo, agora }: { em: Date | string; relativo: boolean; agora: Date }) {
  return (
    <time dateTime={new Date(em).toISOString()} title={formatarDataHora(em)} className="numero shrink-0 text-rotulo text-muted">
      {relativo ? tempoRelativo(em, agora) : hora(em)}
    </time>
  );
}

function Entrada({ e, ultima, relativo, agora, compacta = false }: { e: EntradaTempo; ultima: boolean; relativo: boolean; agora: Date; compacta?: boolean }) {
  const titulo = e.href ? (
    <Link href={e.href} className="text-ink no-underline hover:text-accent hover:underline">
      {e.titulo}
    </Link>
  ) : (
    e.titulo
  );
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!ultima && <span aria-hidden className="absolute bottom-0 left-[13px] top-7 w-px bg-line" />}
      <span aria-hidden className={cn("relative grid size-7 shrink-0 place-items-center rounded-full border", COR[e.tom])}>
        <Icone nome={e.icone} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="min-w-0 text-corpo font-medium text-ink">
            {titulo}
            {e.marcador && <span className="ml-2 rounded-chip bg-control px-1.5 py-px text-rotulo font-normal text-ink-3">{e.marcador}</span>}
          </span>
          {!compacta && <Hora em={e.em} relativo={relativo} agora={agora} />}
        </p>
        {e.detalhe && <p className="mb-0 mt-0.5 break-words text-pequeno text-ink-2">{e.detalhe}</p>}
        <p className="mb-0 mt-0.5 text-rotulo text-muted">
          {e.autor ?? "Sistema"}
          {compacta && (
            <>
              {" · "}
              <Hora em={e.em} relativo={relativo} agora={agora} />
            </>
          )}
        </p>
      </div>
    </li>
  );
}

/** Tipo da ação: o texto antes de ":" ("Incluída na reunião: Tenda 3×3 × 1" → "Incluída na reunião"). */
const tipoDe = (e: EntradaTempo) => (e.titulo.includes(":") ? e.titulo.slice(0, e.titulo.indexOf(":")).trim() : null);
const ms = (e: EntradaTempo) => new Date(e.em).getTime();

/**
 * Sequências repetidas (3+ seguidas, mesma ação, mesmo autor, até 10 min entre uma e outra) viram um bloco
 * só: a reunião que inclui 42 linhas não esconde o "Ata fechada" no meio de 42 registros iguais.
 */
function blocos(itens: EntradaTempo[]): Array<{ tipo: "um"; e: EntradaTempo } | { tipo: "varios"; titulo: string; itens: EntradaTempo[] }> {
  const out: Array<{ tipo: "um"; e: EntradaTempo } | { tipo: "varios"; titulo: string; itens: EntradaTempo[] }> = [];
  let i = 0;
  while (i < itens.length) {
    const t = tipoDe(itens[i]);
    let j = i + 1;
    while (t && j < itens.length && tipoDe(itens[j]) === t && itens[j].autor === itens[i].autor && Math.abs(ms(itens[j]) - ms(itens[j - 1])) <= 10 * 60_000) j++;
    if (t && j - i >= 3) out.push({ tipo: "varios", titulo: t, itens: itens.slice(i, j) });
    else for (let k = i; k < j; k++) out.push({ tipo: "um", e: itens[k] });
    i = j;
  }
  return out;
}

function Bloco({ titulo, itens, ultima, relativo, agora, compacta = false }: { titulo: string; itens: EntradaTempo[]; ultima: boolean; relativo: boolean; agora: Date; compacta?: boolean }) {
  const e0 = itens[0];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!ultima && <span aria-hidden className="absolute bottom-0 left-[13px] top-7 w-px bg-line" />}
      <span aria-hidden className={cn("relative grid size-7 shrink-0 place-items-center rounded-full border", COR[e0.tom])}>
        <Icone nome={e0.icone} className="size-3.5" />
      </span>
      <details className="group min-w-0 flex-1 pt-1">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-corpo font-medium text-ink">
            {titulo}
            <span className="ml-2 rounded-chip bg-control px-1.5 py-px text-rotulo font-normal text-ink-3">
              <span className="numero">{itens.length}</span> registros
            </span>
            <span className="ml-2 inline-flex items-center gap-0.5 text-pequeno font-normal text-accent">
              <span className="group-open:hidden">ver</span>
              <span className="hidden group-open:inline">recolher</span>
              <Icone nome="chevron-baixo" className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
            </span>
          </span>
          {!compacta && <Hora em={e0.em} relativo={relativo} agora={agora} />}
          {/* Autor dentro do resumo: aparece com o bloco fechado, igual às entradas soltas. */}
          <span className="basis-full text-rotulo font-normal text-muted">
            {e0.autor ?? "Sistema"}
            {compacta && (
              <>
                {" · "}
                <Hora em={e0.em} relativo={relativo} agora={agora} />
              </>
            )}
          </span>
        </summary>
        <ul className="m-0 mt-2 list-none space-y-1 border-l-2 border-line-soft p-0 pl-3 animate-fade-up-rapido">
          {itens.map((e) => {
            const resto = e.titulo.slice(e.titulo.indexOf(":") + 1).trim();
            return (
              <li key={e.id} className="text-pequeno text-ink-2">
                {e.href ? (
                  <Link href={e.href} className="text-ink-2 no-underline hover:text-accent hover:underline">
                    {resto}
                  </Link>
                ) : (
                  resto
                )}
                {e.detalhe && <span className="block text-rotulo text-muted">{e.detalhe}</span>}
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

/**
 * Linha do tempo com ícone por tipo de ação, agrupada por dia ("Hoje", "Ontem", "Há 5 dias" + a data).
 * Hora relativa nas entradas de hoje; nas outras, a hora do dia. A data e hora completas ficam no `title`.
 * `compacta`: sem grupos por dia e sempre relativa (painéis laterais); `maximo` limita as linhas mostradas.
 */
export function LinhaTempoAgrupada({ entradas, compacta = false, vazio, maximo }: { entradas: EntradaTempo[]; compacta?: boolean; vazio?: React.ReactNode; maximo?: number }) {
  const agora = new Date();
  if (entradas.length === 0) return <>{vazio ?? <p className="m-0 px-cartao py-6 text-center text-pequeno text-muted">Nada registrado ainda.</p>}</>;
  if (compacta) {
    return (
      <ol className="m-0 list-none px-cartao py-3.5">
        {blocos(entradas)
          .slice(0, maximo)
          .map((b, i, todos) =>
            b.tipo === "um" ? (
              <Entrada key={b.e.id} e={b.e} ultima={i === todos.length - 1} relativo agora={agora} compacta />
            ) : (
              <Bloco key={b.itens[0].id} titulo={b.titulo} itens={b.itens} ultima={i === todos.length - 1} relativo agora={agora} compacta />
            ),
          )}
      </ol>
    );
  }
  const hoje = isoSP(agora);
  const dias: Array<{ dia: string; itens: EntradaTempo[] }> = [];
  for (const e of entradas) {
    const dia = isoSP(e.em);
    const g = dias[dias.length - 1];
    if (g && g.dia === dia) g.itens.push(e);
    else dias.push({ dia, itens: [e] });
  }
  return (
    <div className="px-cartao py-2">
      {dias.map((g) => {
        const data = new Date(`${g.dia}T12:00:00Z`);
        return (
          <section key={g.dia} aria-label={`${rotuloDia(g.dia, hoje)}, ${diaMes(data)}`} className="border-b border-line-faint py-3.5 last:border-b-0">
            <h3 className="m-0 mb-3 flex items-baseline gap-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted">
              {rotuloDia(g.dia, hoje)}
              <span className="numero font-normal normal-case tracking-normal text-meta">
                {diaSemanaCurto(data)}, {diaMes(data)}
                {g.dia.slice(0, 4) !== hoje.slice(0, 4) ? `/${g.dia.slice(0, 4)}` : ""}
              </span>
            </h3>
            <ol className="m-0 list-none p-0">
              {blocos(g.itens).map((b, i, todos) =>
                b.tipo === "um" ? (
                  <Entrada key={b.e.id} e={b.e} ultima={i === todos.length - 1} relativo={g.dia === hoje} agora={agora} />
                ) : (
                  <Bloco key={b.itens[0].id} titulo={b.titulo} itens={b.itens} ultima={i === todos.length - 1} relativo={g.dia === hoje} agora={agora} />
                ),
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
