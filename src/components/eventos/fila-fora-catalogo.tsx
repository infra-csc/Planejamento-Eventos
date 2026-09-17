import Link from "next/link";
import type { ItemForaCatalogo } from "@/server/services/fora-catalogo";
import type { OpcoesReferencia } from "./linha-ata-form";
import { Badge, Tag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/layout";
import { diaMesHora } from "@/lib/format";
import { VincularCatalogo } from "./vincular-catalogo";

/**
 * Fila da logística: itens que as áreas descreveram à mão e ainda não viraram peça ou projeto
 * do catálogo. Enquanto ficam aqui, não somam peças na OS — a separação é manual.
 */
export function FilaForaCatalogo({ itens, opcoes, podeCadastrar }: { itens: ItemForaCatalogo[]; opcoes: OpcoesReferencia; podeCadastrar: boolean }) {
  if (itens.length === 0) {
    return <EmptyState compact title="Nada fora do catálogo" description="Quando uma área descrever um item à mão, ele aparece aqui para você cadastrar a peça ou vincular a uma que já existe." />;
  }
  return (
    <ul className="m-0 list-none p-0">
      {itens.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-row px-[18px] py-3 last:border-b-0">
          <span className="min-w-[220px] flex-1">
            <span className="block text-corpo font-medium text-ink">
              {i.descricao ?? "item sem descrição"}
              <span className="ml-2 font-mono text-rotulo text-muted">× {i.quantidade}</span>
            </span>
            <span className="mt-0.5 block text-pequeno text-muted">
              <Link href={`/eventos/${i.eventoId}`} className="link">
                {i.eventoCodigo}
              </Link>{" "}
              {i.eventoNome} · {i.area ?? "Logística"}
              {i.destino ? ` · ${i.destino}` : ""}
              {i.solicitante ? ` · pedido por ${i.solicitante}` : ""}
              {" · "}
              {diaMesHora(i.criadoEm)}
            </span>
          </span>
          <Tag tom="warning">fora do catálogo</Tag>
          {i.eventoStatus === "PREPARACAO" || i.eventoStatus === "EM_REUNIAO" ? <Badge tom="neutral">antes da ata</Badge> : <Badge tom="accent">já na OS</Badge>}
          <VincularCatalogo linha={{ linhaId: i.id, descricao: i.descricao ?? "item", quantidade: i.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />
        </li>
      ))}
    </ul>
  );
}
