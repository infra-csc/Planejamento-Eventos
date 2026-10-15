import { cn } from "@/lib/cn";
import { descricaoDaUnidade } from "@/domain/unidades-tenda";

/**
 * Tendas desta linha, uma a uma: o número da tenda e a descrição que quem pediu deu a ela; ao lado, as
 * peças de cada tenda (iguais para todas as tendas da linha) com o total da linha. Sem escolher unidade:
 * tudo à vista, como na planilha.
 */
export function DetalhesUnidadesTenda({
  quantidade,
  descricoes,
  pecas,
  unidadeInicial,
  destino,
}: {
  quantidade: number;
  descricoes: string[] | null;
  pecas: Array<{ pecaId: string; codigo: string; nome: string; unidade: string; porUnidade: number }>;
  /** Tenda em destaque (link com ?unidade=N). */
  unidadeInicial?: number;
  destino: string | null;
}) {
  const n = Number.isSafeInteger(quantidade) && quantidade > 0 ? quantidade : 0;
  const tendas = Array.from({ length: n }, (_, i) => ({ numero: i + 1, descricao: descricaoDaUnidade(descricoes, i + 1) }));
  // Todas com o mesmo texto (ou sem texto): uma linha só, em vez de repetir.
  const iguais = tendas.every((t) => t.descricao === tendas[0]?.descricao);

  return (
    <div>
      <div className="border-b border-line-soft px-cartao py-3.5">
        <p className="m-0 text-pequeno text-muted">
          <span className="numero font-medium text-ink">{n}</span> {n === 1 ? "tenda" : "tendas"} em <span className="font-medium text-ink">{destino ?? "local não informado"}</span>
        </p>
        {descricoes === null ? (
          <p className="mb-0 mt-2 text-pequeno text-muted">Descrição visível só para a área que pediu e para a logística.</p>
        ) : iguais ? (
          <p className="mb-0 mt-2 text-corpo text-ink-2">{tendas[0]?.descricao ?? <span className="text-meta">Sem descrição</span>}</p>
        ) : (
          <ol className="m-0 mt-2 list-none p-0">
            {tendas.map((t) => (
              <li key={t.numero} className={cn("flex gap-3 border-b border-line-row py-1.5 last:border-b-0", t.numero === unidadeInicial && "bg-selected")}>
                <span className="numero w-14 shrink-0 text-pequeno text-ink-3">Tenda {t.numero}</span>
                <span className="min-w-0 whitespace-pre-line break-words text-corpo text-ink">{t.descricao ?? <span className="text-meta">sem descrição</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="px-cartao py-3.5">
        <p className="m-0 flex items-baseline justify-between gap-3 text-pequeno text-muted">
          <span className="flex-1">Peças de cada tenda</span>
          <span className="w-10 text-right">por tenda</span>
          <span className="w-14 text-right">na linha</span>
        </p>
        {pecas.length > 0 ? (
          <ul className="m-0 mt-1.5 list-none p-0">
            {pecas.map((p) => (
              <li key={p.pecaId} className="flex items-baseline gap-3 border-b border-line-row py-1.5 last:border-b-0">
                <span className="min-w-0 flex-1 text-pequeno text-ink">
                  <span className="mr-2 whitespace-nowrap font-mono text-rotulo text-ink-3">{p.codigo}</span>
                  {p.nome}
                </span>
                <span className="numero w-10 shrink-0 text-right text-pequeno text-ink-2">{p.porUnidade}</span>
                <span className="numero w-14 shrink-0 text-right text-pequeno font-semibold text-ink">
                  {p.porUnidade * n} <span className="font-normal text-muted">{p.unidade}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-0 mt-2 text-pequeno text-muted">Nenhuma peça informada.</p>
        )}
      </div>
    </div>
  );
}
