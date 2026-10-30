/**
 * Contagens das pílulas do calendário mensal. A grade completa as semanas com dias do mês anterior e do
 * seguinte, e o evento de vários dias vira um item por dia: contar a grade dava "Tudo 78" num mês de 56
 * compromissos e "Evento 35" com 2 dias valendo 2 (auditoria 30/10, parte D N6). Aqui conta só o que cai
 * no mês, e cada evento uma vez.
 */
type ItemContavel = { tipo: string; dia: string; evento: { id: string } };

/** Quantos compromissos os itens somam: evento conta uma vez (não por dia); o resto, um por item. */
export function contarCompromissos(itens: readonly ItemContavel[]): number {
  const eventos = new Set<string>();
  let outros = 0;
  for (const i of itens) {
    if (i.tipo === "evento") eventos.add(i.evento.id);
    else outros++;
  }
  return eventos.size + outros;
}

/** Só os itens cujo dia cai no mês "AAAA-MM" (a grade traz dias dos meses vizinhos). */
export const doMes = <T extends { dia: string }>(itens: readonly T[], mes: string): T[] => itens.filter((i) => i.dia.slice(0, 7) === mes);
