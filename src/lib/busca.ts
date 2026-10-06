/** Minúsculas e sem acento: "Pórtico" e "portico" viram o mesmo texto. */
export function normalizarBusca(s: string): string {
  // "×" das medidas vira "x" (as pessoas digitam "tenda 5x5" para achar "Tenda 5×5 m").
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/×/g, "x").toLowerCase();
}

/**
 * Busca tolerante: ignora acento e maiúsculas, e cada palavra do termo precisa aparecer
 * em qualquer ordem ("box 3" acha "Box truss — trecho 3 m").
 */
export function combinaBusca(texto: string, termo: string): boolean {
  const palavras = normalizarBusca(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = normalizarBusca(texto);
  return palavras.every((p) => alvo.includes(p));
}

/**
 * Relevância de um resultado já filtrado: o nome que começa pelo termo vem primeiro, depois o que tem uma
 * palavra começando por ele, depois o resto ("palco" → "Palco 2×2 m" antes de "Fundo de palco 8×4 m").
 * Menor = mais relevante.
 */
export function relevanciaBusca(rotulo: string, termo: string): number {
  const t = normalizarBusca(termo).trim();
  if (!t) return 0;
  const r = normalizarBusca(rotulo);
  // Variação de um projeto ("Palco 8×4 m — modelo …") vem logo depois do original.
  const variacao = r.includes(" — ") ? 0.5 : 0;
  if (r.startsWith(t)) return variacao;
  if (r.includes(` ${t}`) || r.includes(`(${t}`)) return 1 + variacao;
  // Todas as palavras no nome (e não só na descrição/código)
  return t.split(/s+/).every((p) => r.includes(p)) ? 2 : 3;
}
