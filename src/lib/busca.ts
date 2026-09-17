/** Minúsculas e sem acento: "Pórtico" e "portico" viram o mesmo texto. */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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
