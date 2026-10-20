import { normalizarBusca } from "@/lib/busca";

/** Palavras que aparecem em vários grupos e não identificam a prova sozinhas. */
const GENERICAS = new Set(["circuito", "corrida", "corridas", "run", "de", "do", "da", "das", "dos", "em", "e", "pra", "para"]);

const palavras = (s: string) => normalizarBusca(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Grupo da biblioteca (prova) de um evento, pelo nome: os grupos não são ligados aos eventos, então
 * "BLUE RUN - SANTOS" → "Blue Run", "NIGHT FOZ DO IGUAÇU" → "Night Run", "ECO SPECIAL RJ" → "Eco Run Special",
 * "S RUN RIO BRANCO" → "SRun". Vale o grupo cujo nome aparece inteiro no do evento (sem espaços) ou, senão,
 * cujas palavras próprias estão todas nele; entre vários, o mais específico. Nenhum → null.
 */
export function grupoDoEvento<G extends { id: string; nome: string }>(nomeEvento: string, grupos: G[]): G | null {
  const doEvento = palavras(nomeEvento);
  const corrido = doEvento.join("");
  const conjunto = new Set(doEvento);
  let melhor: G | null = null;
  let nota = 0;
  for (const g of grupos) {
    const dele = palavras(g.nome);
    const inteiro = dele.join("");
    let n = 0;
    if (inteiro.length >= 3 && corrido.includes(inteiro)) n = 100 + inteiro.length;
    else {
      const proprias = dele.filter((p) => p.length >= 3 && !GENERICAS.has(p));
      if (proprias.length && proprias.every((p) => conjunto.has(p))) n = proprias.join("").length;
    }
    if (n > nota) {
      nota = n;
      melhor = g;
    }
  }
  return melhor;
}
