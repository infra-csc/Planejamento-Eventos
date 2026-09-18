import Link from "next/link";
import type { SolicitacaoLista } from "@/server/services/solicitacoes";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { SolicitacaoStatusBadge } from "@/components/ui/badge";
import { aguardaReuniao } from "@/domain/solicitacao";

/** Linha compacta de solicitação usada na aba do evento. Abaixo de `sm`, itens e prazo descem para a linha de meta. */
export function LinhaSolicitacaoEvento({ s }: { s: SolicitacaoLista }) {
  const pi = prazoInfo(s);
  const itens = `${s.itensRespondidos}/${s.totalItens} itens`;
  const prazo = pi.vencido ? `atrasada ${pi.sub}` : pi.label;
  return (
    <Link href={`/solicitacoes/${s.id}`} className="flex w-full flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-line-row px-cartao py-[13px] text-left no-underline last:border-b-0 hover:bg-subtle sm:flex-nowrap">
      <span className="shrink-0 font-mono text-pequeno text-ink sm:basis-[78px]">{s.codigo}</span>
      <span className="min-w-0 flex-1 basis-[180px]">
        <span className="block break-words text-corpo text-ink">{s.titulo || "sem título"}</span>
        <span className="block text-pequeno text-muted">
          {s.area.nome} · {s.tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"} · por {s.criadoPor.nome}
          <span className="sm:hidden">
            {" · "}
            <span className="font-mono">{itens}</span>
            {" · "}
            <span className="font-mono" style={{ color: COR_TOM[pi.tom] }}>
              {prazo}
            </span>
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 basis-[96px] font-mono text-pequeno text-ink-3 sm:block">{itens}</span>
      <span className="shrink-0 sm:basis-[124px]">
        <SolicitacaoStatusBadge status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
      </span>
      <span className="hidden shrink-0 basis-[118px] text-right font-mono text-pequeno sm:block" style={{ color: COR_TOM[pi.tom] }}>
        {prazo}
      </span>
    </Link>
  );
}
