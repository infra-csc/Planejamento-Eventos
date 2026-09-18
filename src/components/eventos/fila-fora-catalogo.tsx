import Link from "next/link";
import type { ItemForaCatalogo } from "@/server/services/fora-catalogo";
import type { OpcoesReferencia } from "./linha-ata-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { diaMesHora } from "@/lib/format";
import { VincularCatalogo } from "./vincular-catalogo";

/**
 * Fila da logística: itens que as áreas descreveram à mão e ainda não viraram peça ou projeto
 * do catálogo. Enquanto ficam aqui, não somam peças na OS — a separação é manual.
 * Tabela no padrão das listas (template de pedidos); a busca e a paginação ficam na página.
 */
export function FilaForaCatalogo({ itens, opcoes, podeCadastrar }: { itens: ItemForaCatalogo[]; opcoes: OpcoesReferencia; podeCadastrar: boolean }) {
  if (itens.length === 0) {
    return <EmptyState compact title="Nada fora do catálogo" description="Quando uma área descrever um item à mão, ele aparece aqui para você cadastrar a peça ou vincular a uma que já existe." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <CaptionOculta>Itens fora do catálogo</CaptionOculta>
        <thead>
          <tr className="bg-subtle">
            <Th>Item</Th>
            <Th className="hidden lg:table-cell" largura="24%">
              Evento
            </Th>
            <Th largura={64} alinhar="right">
              Qtd.
            </Th>
            <Th largura={120}>Situação</Th>
            <Th largura={190} alinhar="right">
              <span className="sr-only">Ação</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => {
            const descricao = i.descricao ?? "item sem descrição";
            return (
              <tr key={i.id} className="hover:bg-subtle">
                <th scope="row" className="border-b border-line-row py-3 pl-cartao pr-3 text-left font-normal">
                  <span className="line-clamp-2 block min-w-[220px] text-corpo font-medium text-ink" title={descricao}>
                    {descricao}
                  </span>
                  <span className="mt-0.5 block text-pequeno text-muted">
                    <span className="lg:hidden">
                      <Link href={`/eventos/${i.eventoId}`} className="link font-mono">
                        {i.eventoCodigo}
                      </Link>{" "}
                      {i.eventoNome} ·{" "}
                    </span>
                    {i.area ?? "Logística"}
                    {i.destino ? ` · ${i.destino}` : ""}
                    {i.solicitante ? ` · pedido por ${i.solicitante}` : ""}
                    {" · "}
                    {diaMesHora(i.criadoEm)}
                  </span>
                </th>
                <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 lg:table-cell">
                  <Link href={`/eventos/${i.eventoId}`} className="link font-mono">
                    {i.eventoCodigo}
                  </Link>
                  <span className="mt-0.5 line-clamp-2 block text-muted" title={i.eventoNome}>
                    {i.eventoNome}
                  </span>
                </td>
                <td className="border-b border-line-row px-3 py-3 text-right font-mono text-pequeno font-medium text-ink">{i.quantidade}</td>
                <td className="border-b border-line-row px-3 py-3">{i.eventoStatus === "PREPARACAO" || i.eventoStatus === "EM_REUNIAO" ? <Badge tom="neutral">antes da ata</Badge> : <Badge tom="accent">já na OS</Badge>}</td>
                <td className="border-b border-line-row py-2.5 pl-3 pr-cartao text-right">
                  <VincularCatalogo linha={{ linhaId: i.id, descricao: i.descricao ?? "item", quantidade: i.quantidade }} opcoes={opcoes} podeCadastrar={podeCadastrar} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
