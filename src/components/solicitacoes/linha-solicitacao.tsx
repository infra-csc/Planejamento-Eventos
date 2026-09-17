import Link from "next/link";
import type { SolicitacaoLista } from "@/server/services/solicitacoes";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { SolicitacaoStatusBadge } from "@/components/ui/badge";
import { aguardaReuniao } from "@/domain/solicitacao";

/** Linha compacta de solicitação usada na aba do evento. */
export function LinhaSolicitacaoEvento({ s }: { s: SolicitacaoLista }) {
  const pi = prazoInfo(s);
  return (
    <Link href={`/solicitacoes/${s.id}`} className="flex w-full items-center gap-3.5 border-b border-line-row px-[18px] py-[13px] text-left no-underline last:border-b-0 hover:bg-subtle">
      <span className="shrink-0 basis-[78px] font-mono text-[12.5px] text-ink">{s.codigo}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-ink">{s.titulo || "sem título"}</span>
        <span className="block text-[12px] text-muted">
          {s.area.nome} · {s.tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"} · por {s.criadoPor.nome}
        </span>
      </span>
      <span className="shrink-0 basis-[96px] font-mono text-[12.5px] text-ink-3">
        {s.itensRespondidos}/{s.totalItens} itens
      </span>
      <span className="shrink-0 basis-[124px]">
        <SolicitacaoStatusBadge status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
      </span>
      <span className="shrink-0 basis-[118px] text-right font-mono text-[12.5px]" style={{ color: COR_TOM[pi.tom] }}>
        {pi.vencido ? `vencido ${pi.sub}` : pi.label}
      </span>
    </Link>
  );
}
