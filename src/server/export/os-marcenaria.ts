import type { OsConteudo } from "@/server/db/schema";

/*
 * OS de marcenaria no formato da planilha da cenografia (OS CENO MARCENARIA_<evento>.xlsx, aba
 * O.S): seções na ordem da planilha (ESTANDES, PALCO, TENDAS, MESAS, ATIVAÇÃO, ITENS ESPECÍFICOS
 * DA PROVA, GERAL), cada uma com cabeçalho ITEM | PEÇAS | QUANTIDADE | REFERENCIA | OBSERVAÇÃO e,
 * por item, o nome do projeto com "(N UNID)" na primeira linha e uma linha por peça de marcenaria.
 * Aqui só se monta a estrutura de dados; a rota /api/os/[id]/marcenaria desenha.
 */

export const SECOES_MARCENARIA = ["ESTANDES", "PALCO", "TENDAS", "MESAS", "ATIVAÇÃO", "ITENS ESPECÍFICOS DA PROVA", "GERAL"] as const;
export type SecaoMarcenaria = (typeof SECOES_MARCENARIA)[number];

export type ItemMarcenaria = {
  /** Como a cenografia escreve: "STAND 9X6 (4 UNID)". */
  item: string;
  pecas: Array<{ nome: string; quantidade: number; observacao: string | null }>;
};

export type OsMarcenaria = {
  semProjetos: boolean;
  secoes: Array<{ nome: SecaoMarcenaria; itens: ItemMarcenaria[] }>;
  totalPecas: number;
};

const maiusculas = (s: string) => s.toLocaleUpperCase("pt-BR");

/** Seção da planilha pela categoria do projeto no catálogo. */
export function secaoDaCategoria(categoria: string | null | undefined): SecaoMarcenaria {
  const c = (categoria ?? "").toLocaleLowerCase("pt-BR");
  if (c.startsWith("estande")) return "ESTANDES";
  if (c.startsWith("palco")) return "PALCO";
  if (c.startsWith("tenda")) return "TENDAS";
  if (c.startsWith("ativa") || c.startsWith("obst")) return "ATIVAÇÃO";
  return "ITENS ESPECÍFICOS DA PROVA";
}

/** Peça de marcenaria pedida solta: mobiliário vai para MESAS, o resto para GERAL. */
function secaoDaPeca(familia: string | null | undefined): SecaoMarcenaria {
  const f = (familia ?? "").toLocaleLowerCase("pt-BR");
  return f.startsWith("mobili") || /balc|bancada|mesa|pranch/.test(f) ? "MESAS" : "GERAL";
}

/**
 * @param categorias categoria de cada projeto (código → categoria), consultada pela rota.
 * @param familias família de cada peça (código → família), para as peças soltas.
 */
export function montarOsMarcenaria(os: OsConteudo, categorias: ReadonlyMap<string, string>, familias: ReadonlyMap<string, string>): OsMarcenaria {
  const secoes = new Map<SecaoMarcenaria, ItemMarcenaria[]>(SECOES_MARCENARIA.map((s) => [s, []]));
  let totalPecas = 0;

  // Projetos: por código, somando as unidades; as peças de marcenaria da lista de cada linha.
  const porCodigo = new Map<string, { nome: string; quantidade: number; pecas: Map<string, { nome: string; total: number }>; locais: Set<string> }>();
  for (const l of os.projetos ?? []) {
    if (l.quantidade <= 0) continue;
    const p = porCodigo.get(l.codigo) ?? { nome: l.nome, quantidade: 0, pecas: new Map(), locais: new Set<string>() };
    p.quantidade += l.quantidade;
    if (l.destino?.trim()) p.locais.add(l.destino.trim());
    for (const pc of l.pecas) {
      if (pc.setor !== "MARCENARIA" || pc.total <= 0) continue;
      p.pecas.set(pc.codigo, { nome: pc.nome, total: (p.pecas.get(pc.codigo)?.total ?? 0) + pc.total });
    }
    porCodigo.set(l.codigo, p);
  }
  for (const [codigo, p] of porCodigo) {
    if (p.pecas.size === 0) continue;
    const item: ItemMarcenaria = {
      item: `${maiusculas(p.nome)} (${p.quantidade} UNID)`,
      pecas: [...p.pecas.values()].map((pc, i) => ({ nome: maiusculas(pc.nome), quantidade: pc.total, observacao: i === 0 && p.locais.size ? [...p.locais].join(" / ") : null })),
    };
    totalPecas += item.pecas.reduce((a, x) => a + x.quantidade, 0);
    secoes.get(secaoDaCategoria(categorias.get(codigo)))!.push(item);
  }

  // Peças de marcenaria pedidas soltas (fora de projeto): um item por peça.
  for (const x of os.individuais ?? []) {
    if (x.setor !== "MARCENARIA" || x.quantidade <= 0) continue;
    const item: ItemMarcenaria = { item: maiusculas(x.nome), pecas: [{ nome: maiusculas(x.nome), quantidade: x.quantidade, observacao: x.destino?.trim() || null }] };
    totalPecas += x.quantidade;
    secoes.get(secaoDaPeca(familias.get(x.codigo)))!.push(item);
  }

  // Itens fora do catálogo do setor marcenaria (descritos à mão).
  const marc = os.setores.find((s) => s.setor === "MARCENARIA");
  for (const a of marc?.avulsos ?? []) {
    secoes.get("GERAL")!.push({ item: maiusculas(a.descricao), pecas: [{ nome: maiusculas(a.descricao), quantidade: a.quantidade, observacao: a.destino?.trim() || null }] });
    totalPecas += a.quantidade;
  }

  return { semProjetos: !os.projetos, secoes: SECOES_MARCENARIA.map((nome) => ({ nome, itens: secoes.get(nome)! })), totalPecas };
}
