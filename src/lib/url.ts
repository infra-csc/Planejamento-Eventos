/** Monta um href preservando parâmetros atuais e aplicando mudanças (null/"" removem o parâmetro). */
export function hrefCom(caminho: string, atuais: Record<string, string | undefined>, mudar: Record<string, string | number | null | undefined> = {}): string {
  const p = new URLSearchParams();
  const tudo: Record<string, string | number | null | undefined> = { ...atuais, ...mudar };
  for (const [k, v] of Object.entries(tudo)) {
    if (v === null || v === undefined || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${caminho}?${s}` : caminho;
}

export type Direcao = "asc" | "desc";

/** Ciclo de ordenação do handoff: asc → desc → sem ordenação. */
export function proximaOrdem(atualChave: string | undefined, atualDir: string | undefined, chave: string): { ordem: string | null; dir: Direcao | null } {
  if (atualChave !== chave) return { ordem: chave, dir: "asc" };
  if (atualDir === "asc") return { ordem: chave, dir: "desc" };
  return { ordem: null, dir: null };
}

export function ordenar<T>(lista: T[], acessores: Record<string, (x: T) => string | number>, chave: string | undefined, dir: string | undefined): T[] {
  if (!chave || !acessores[chave]) return lista;
  const get = acessores[chave];
  const sinal = dir === "desc" ? -1 : 1;
  return [...lista].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * sinal;
    return String(va).localeCompare(String(vb), "pt-BR") * sinal;
  });
}

export function paginar<T>(lista: T[], paginaParam: string | undefined, porPagina: number) {
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, Number(paginaParam) || 1), paginas);
  const de = (pagina - 1) * porPagina;
  return { itens: lista.slice(de, de + porPagina), pagina, paginas, total, de, porPagina };
}
