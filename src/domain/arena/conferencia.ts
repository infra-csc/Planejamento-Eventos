import type { Arena, Divergencia, TipoDivergencia } from "./tipos";

/** Etiqueta, cores e peso (ordem na lista) de cada tipo de divergência. */
export const TAG_DIVERGENCIA: Record<TipoDivergencia, { rotulo: string; fundo: string; cor: string; peso: number }> = {
  quantidade: { rotulo: "quantidade", fundo: "#fbeee5", cor: "#a8400f", peso: 3 },
  "so-planta": { rotulo: "só na planta", fundo: "#f7f0dd", cor: "#7a5f00", peso: 2 },
  nome: { rotulo: "nome", fundo: "#f7f0dd", cor: "#7a5f00", peso: 2 },
  confirmar: { rotulo: "confirmar", fundo: "#f7f0dd", cor: "#7a5f00", peso: 2 },
  "sem-cota": { rotulo: "sem cota", fundo: "#f0eceb", cor: "#4f4849", peso: 1 },
};

/**
 * Caminho de compatibilidade para arenas sem `divergencias`: lê as observações dos pontos.
 * Frágil por depender de texto livre; o certo é a fonte declarar as divergências.
 */
export function derivarDivergencias(arena: Arena): Divergencia[] {
  const porTexto = new Map<string, Divergencia>();
  for (const p of arena.pontos) {
    for (const texto of p.observacoes) {
      let tipo: TipoDivergencia | null = null;
      let planta = "—";
      let ata = "—";
      const qtd = texto.match(/planta (?:marca|desenha|mostra) (\d+)[^.]*?ata lista (\d+)/i);
      if (qtd) {
        tipo = "quantidade";
        planta = qtd[1];
        ata = qtd[2];
      } else if (/não aparece na (?:lista de materiais da )?ata|a ata não detalha este espaço/i.test(texto)) {
        tipo = "so-planta";
        planta = "desenhado";
        ata = "ausente";
      } else if (/lista a oitava marca/i.test(texto)) tipo = "nome";
      else if (/sem informar a quantidade|não são detalhadas/i.test(texto)) tipo = "sem-cota";
      if (!tipo) continue;
      const existente = porTexto.get(texto);
      if (existente) existente.pontoIds.push(p.id);
      else porTexto.set(texto, { id: `derivada-${porTexto.size + 1}`, tipo, titulo: p.nome, planta, ata, texto, pontoIds: [p.id] });
    }
    if (p.status?.tom === "atencao") {
      porTexto.set(`confirmar:${p.id}`, { id: `confirmar-${p.id}`, tipo: "confirmar", titulo: p.nome, planta: "—", ata: p.status.rotulo, texto: p.observacoes[0] ?? p.status.rotulo, pontoIds: [p.id] });
    }
  }
  return [...porTexto.values()];
}

/** Divergências da arena, das mais graves para as mais leves (ordem estável dentro do mesmo peso). */
export function divergenciasDaArena(arena: Arena): Divergencia[] {
  const lista = arena.divergencias ?? derivarDivergencias(arena);
  return [...lista].sort((a, b) => TAG_DIVERGENCIA[b.tipo].peso - TAG_DIVERGENCIA[a.tipo].peso);
}

export function divergenciasDoPonto(arena: Arena, pontoId: string): Divergencia[] {
  return divergenciasDaArena(arena).filter((d) => d.pontoIds.includes(pontoId));
}
