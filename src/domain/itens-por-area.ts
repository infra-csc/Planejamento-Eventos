/**
 * Itens que já aparecem na solicitação de cada área, com quantidade 0, conforme a lista de materiais da
 * ata (planilhas de OS): a área só preenche o número; outros itens ela pede à parte, pela busca.
 * Chave: nome da área (sem acento, minúsculo). Peças pelo código do catálogo; projetos padrão pelo nome ou código
 * (tenda pedida por local, no mesmo quadro de tendas do catálogo; os outros, pela quantidade).
 */

/**
 * Projeto padrão da lista: achado pelo nome (o de nome mais curto, que é o modelo base: "Stand 9×6 m" e não
 * "Stand 9×6 m — LED") e, se nenhum nome bater, pelo código. Só pelo código falhava num banco em que o código é de
 * outro projeto; só pelo nome que começa com Stand/Tenda (QA, 26/10) tirou stands e tendas da lista em produção.
 */
export type ProjetoDaLista = { codigo?: string; nome: RegExp };
export type ListaDaArea = { titulo: string; codigos: string[]; projetos?: ProjetoDaLista[] };

/** Tenda 3×3 m e Tenda 5×5 m (projetos padrão). */
const TENDAS: ListaDaArea = {
  titulo: "Tendas",
  codigos: [],
  projetos: [
    { codigo: "PRJ-0033", nome: /\btenda\b.*\b3\s*[x×]\s*3\b/i },
    { codigo: "PRJ-0006", nome: /\btenda\b.*\b5\s*[x×]\s*5\b/i },
  ],
};

const LISTAS: Record<string, ListaDaArea[]> = {
  producao: [
    { titulo: "Percurso", codigos: ["CAV-TRANSITO", "COCHO", "CAV-COCHO", "CONE-G", "CONE-P", "RAMPA-MAD", "PRISMA"] },
    { titulo: "Arena", codigos: ["PALETEIRA", "GERADOR", "CARRINHO-PLAT", "LIXEIRA-ARAM", "LIXEIRA-BAG", "MESA-1X1", "TINA-500", "CAV-RETO"] },
    TENDAS,
  ],
  // Cenografia (31/10, logística): sai a escada de alumínio; entram o kit de montagem e o kit ceno, que a área
  // costuma ajustar peça a peça (vêm com as peças abertas em "Itens do pedido": KITS_ABERTOS).
  cenografia: [{ titulo: "Cenografia", codigos: ["ESCADA-MAD"], projetos: [{ nome: /\bkit\b.*\bmontagem\b/i }, { nome: /\bkit\b.*\bceno(grafia)?\b/i }] }],
  ativacao: [
    // Lixeiras e rampa de acessibilidade também são pedidas pela Ativação (27/10).
    { titulo: "Ativação", codigos: ["BALCAO-120", "PRANCHÃO-220", "CAV-RETO", "OMBRELONE", "TINA-300", "PUFF", "LIXEIRA-ARAM", "LIXEIRA-BAG", "RAMPA-ACESS"] },
    // Só o Stand 9×6 m (27/10; o 11×6 saiu da lista): pedido pela quantidade, com a descrição de cada unidade.
    { titulo: "Stands", codigos: [], projetos: [{ codigo: "PRJ-0018", nome: /\b(stand|estande)\b.*\b9\s*[x×]\s*6\b/i }] },
    TENDAS,
  ],
};

const chave = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Projetos que entram na solicitação com o painel de peças já aberto: kits que a área ajusta item a item. */
const KITS_ABERTOS = [/\bkit\b.*\bmontagem\b/i, /\bkit\b.*\bceno(grafia)?\b/i];
export const abreComPecas = (nomeProjeto: string) => KITS_ABERTOS.some((r) => r.test(nomeProjeto));

export const listasDaArea = (areaNome: string | null | undefined): ListaDaArea[] => (areaNome ? (LISTAS[chave(areaNome)] ?? []) : []);

/** Os projetos de uma lista que existem no catálogo, na ordem da lista (sem repetir). */
export function projetosDaLista<P extends { codigo: string; nome: string }>(lista: ListaDaArea, projetos: readonly P[]): P[] {
  const achados: P[] = [];
  for (const ref of lista.projetos ?? []) {
    const porNome = projetos.filter((p) => ref.nome.test(p.nome)).sort((a, b) => a.nome.length - b.nome.length)[0];
    const p = porNome ?? (ref.codigo ? projetos.find((x) => x.codigo === ref.codigo) : undefined);
    if (p && !achados.includes(p)) achados.push(p);
  }
  return achados;
}
