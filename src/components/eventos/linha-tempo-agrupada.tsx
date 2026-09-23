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

function Entrada({ e, ultima, relativo, agora }: { e: EntradaTempo; ultima: boolean; relativo: boolean; agora: Date }) {
  const absoluto = formatarDataHora(e.em);
  const iso = typeof e.em === "string" ? e.em : e.em.toISOString();
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
          <time dateTime={iso} title={absoluto} className="numero shrink-0 text-rotulo text-muted">
            {relativo ? tempoRelativo(e.em, agora) : hora(e.em)}
          </time>
        </p>
        {e.detalhe && <p className="mb-0 mt-0.5 break-words text-pequeno text-ink-2">{e.detalhe}</p>}
        <p className="mb-0 mt-0.5 text-rotulo text-muted">{e.autor ?? "Sistema"}</p>
      </div>
    </li>
  );
}

/**
 * Linha do tempo com ícone por tipo de ação, agrupada por dia ("Hoje", "Ontem", "Há 5 dias" + a data).
 * Hora relativa nas entradas de hoje; nas outras, a hora do dia. A data e hora completas ficam no `title`.
 * `compacta`: sem grupos e sempre relativa (painéis laterais).
 */
export function LinhaTempoAgrupada({ entradas, compacta = false, vazio }: { entradas: EntradaTempo[]; compacta?: boolean; vazio?: React.ReactNode }) {
  const agora = new Date();
  if (entradas.length === 0) return <>{vazio ?? <p className="m-0 px-cartao py-6 text-center text-pequeno text-muted">Nada registrado ainda.</p>}</>;
  if (compacta) {
    return (
      <ol className="m-0 list-none px-cartao py-3.5">
        {entradas.map((e, i) => (
          <Entrada key={e.id} e={e} ultima={i === entradas.length - 1} relativo agora={agora} />
        ))}
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
              {g.itens.map((e, i) => (
                <Entrada key={e.id} e={e} ultima={i === g.itens.length - 1} relativo={g.dia === hoje} agora={agora} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
