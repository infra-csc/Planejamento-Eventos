import { kitDaTenda } from "@/domain/tendas";
import type { TendaDoLocal } from "./acoes-linha-evento";

/** O mínimo de uma linha do evento para montar o quadro da tenda (vem de `obterLinhasAta`). */
type LinhaComPecas = { id: string; tipo: string; quantidade: number; destino: string | null; registro: { bomSnapshot?: Array<{ codigo: string; quantidade: number }> | null } };

const mesmoLocal = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Quadro da tenda de uma linha: o local inteiro (todas as linhas da mesma tenda no mesmo local) e os totais dele —
 * tendas, fechamentos e calhas. `doItem` são as linhas do mesmo projeto no evento. Sem kit de tenda, `undefined`.
 * Usado na visão geral e na página do item (mesma conta do quadro da conferência).
 */
export function tendaDoLocal(x: LinhaComPecas, doItem: readonly LinhaComPecas[]): TendaDoLocal | undefined {
  const bom = x.registro.bomSnapshot ?? [];
  const kit = x.tipo === "PROJETO" ? kitDaTenda(bom.map((b) => b.codigo)) : null;
  if (!kit) return undefined;
  const doLocal = doItem.filter((y) => mesmoLocal(y.destino, x.destino));
  const soma = (codigo: string | undefined) => (codigo ? doLocal.reduce((a, y) => a + (y.registro.bomSnapshot ?? []).filter((b) => b.codigo === codigo).reduce((c, b) => c + b.quantidade, 0) * y.quantidade, 0) : 0);
  return { linhaIds: doLocal.map((y) => y.id), local: x.destino, tamanho: kit.tamanho, tendas: doLocal.reduce((a, y) => a + y.quantidade, 0), fechamentos: soma(kit.pecas.fechamento), calhas: soma(kit.pecas.calha), temCalha: Boolean(kit.pecas.calha) };
}
