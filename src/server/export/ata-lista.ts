import type { OsConteudo } from "@/server/db/schema";
import { montarOsEstrutura, type BlocoTenda } from "./os-estrutura";

/*
 * Ata no formato da planilha da cenografia (ATA <evento>.xlsx, aba LISTA DE MATERIAIS): cabeçalho
 * da reunião e as seções PERCURSO, ESTRUTURA (tendas 3×3 e 5×5 por local, box truss), ATIVAÇÃO e
 * ARENA, cada uma com ITEM | QTDE | OBS e uma linha Total. As listas fixas são as que toda ata traz
 * (mesmo zeradas), com a peça do catálogo que corresponde a cada linha; o que mais houver na OS
 * entra em seguida. Aqui só se monta a estrutura de dados; a rota /api/eventos/[id]/ata/lista
 * desenha.
 */

export type LinhaLista = { item: string; quantidade: number | null; obs: string | null };
export type SecaoLista = { titulo: string; linhas: LinhaLista[]; total: number };

export type AtaLista = {
  percurso: SecaoLista;
  tendas: BlocoTenda[];
  boxTruss: SecaoLista;
  ativacao: SecaoLista;
  arena: SecaoLista;
};

/** PERCURSO, como na ata (rótulo → código no catálogo; sem código = linha só para preencher à mão). */
const PERCURSO: ReadonlyArray<[string, string | null]> = [
  ["Cavaletes Transito", "CAV-TRANSITO"],
  ["Cochos para água", "COCHO"],
  ["Cavaletes de ferro p/ cochos", "CAV-COCHO"],
  ["Cones GRANDES", "CONE-G"],
  ["Cones PEQUENOS", "CONE-P"],
  ["Tina 1000l", "TINA-1000"],
  ["Palet Ferro", "PALLET-FE"],
  ["Palet Plastico", "PALLET-PL"],
  ["Rampas de madeira", "RAMPA-MAD"],
  ["Prismas (cavaletes grandes)", "PRISMA"],
];
const ATIVACAO: ReadonlyArray<[string, string | null]> = [
  ["Balcão (1,20 x 1,0)", "BALCAO-120"],
  ["Bancadas de madeira (2,10 x 1,0)", "BANCADA-210"],
  ["Cavaletes Retos", "CAV-RETO"],
  ["Ombrelone", "OMBRELONE"],
  ["Tina Caixa D'água 300L", "TINA-300"],
  ["Puffs", "PUFF"],
];
const ARENA: ReadonlyArray<[string, string | null]> = [
  ["Agua Montagem CX", null],
  ["Agua KIT CX", null],
  ["Agua Prova CX", null],
  ["Isotonico", null],
  ["Proteina", null],
  ["Escadas de aluminio", "ESCADA-ALU"],
  ["Escadas de Madeira", "ESCADA-MAD"],
  ["Grades merchandising", "GRADE-MERCH"],
  ["Pés de grades de merchandising", "PE-GRADE-MERCH"],
  ["Paleteira", "PALETEIRA"],
  ["Gerador", "GERADOR"],
  ["Carrinho Plataforma", "CARRINHO-PLAT"],
  ["Lixeiras (ARAMADAS)", "LIXEIRA-ARAM"],
  ["Lixeiras (ULTRA BAG)", "LIXEIRA-BAG"],
  ["Mesa 1x1 (medalha)", "MESA-1X1"],
  ["Quadro Metal", "QUADRO-METAL"],
  ["Caixas de água 500 L", "TINA-500"],
];
const FIXOS = new Set([...PERCURSO, ...ATIVACAO, ...ARENA].flatMap(([, c]) => (c ? [c] : [])));

export function montarAtaLista(os: OsConteudo): AtaLista {
  const totalPorCodigo = new Map<string, { nome: string; setor: string; total: number }>();
  for (const s of os.setores) for (const l of s.linhas) totalPorCodigo.set(l.codigo, { nome: l.nome, setor: s.setor, total: l.total });
  // OBS: onde a peça foi pedida (destinos das linhas soltas e dos projetos que a levam).
  const locais = new Map<string, Set<string>>();
  const marcar = (codigo: string, destino: string | null | undefined) => {
    if (!destino?.trim()) return;
    locais.set(codigo, (locais.get(codigo) ?? new Set()).add(destino.trim()));
  };
  for (const x of os.individuais ?? []) marcar(x.codigo, x.destino);
  for (const p of os.projetos ?? []) for (const pc of p.pecas) marcar(pc.codigo, p.destino);
  // Só o que foi pedido solto (ou é peça de arena) entra fora das listas fixas: marcenaria de projeto fica na OS de marcenaria.
  const soltas = new Set((os.individuais ?? []).map((x) => x.codigo));
  const obsDe = (codigo: string | null) => (codigo && locais.get(codigo)?.size ? [...locais.get(codigo)!].join(" / ") : null);

  const secao = (titulo: string, fixos: ReadonlyArray<[string, string | null]>, extras: (c: string, p: { nome: string; setor: string; total: number }) => boolean): SecaoLista => {
    const linhas: LinhaLista[] = fixos.map(([item, codigo]) => ({ item, quantidade: codigo ? (totalPorCodigo.get(codigo)?.total ?? 0) || null : null, obs: obsDe(codigo) }));
    for (const [codigo, p] of totalPorCodigo) if (!FIXOS.has(codigo) && p.total > 0 && extras(codigo, p)) linhas.push({ item: p.nome, quantidade: p.total, obs: obsDe(codigo) });
    return { titulo, linhas, total: linhas.reduce((a, l) => a + (l.quantidade ?? 0), 0) };
  };

  const estrutura = montarOsEstrutura(os);
  // Cada peça fora das listas fixas entra numa seção só: a primeira que a reconhece.
  const usadosEmSecao = new Set<string>();
  const pega = (c: string) => {
    if (usadosEmSecao.has(c)) return false;
    usadosEmSecao.add(c);
    return true;
  };
  const percurso = secao("PERCURSO", PERCURSO, (c, p) => p.setor === "ARENA" && /cone|cocho|cavalete|tina|pallet|palet|rampa|prisma|grade 2|estaca|corda|malote/i.test(p.nome) && pega(c));
  const ativacao = secao("ATIVAÇÃO", ATIVACAO, (c, p) => soltas.has(c) && (p.setor === "MARCENARIA" || /ombrel|puff|balc|bancada|mesa/i.test(p.nome)) && pega(c));
  const arena = secao("ARENA", ARENA, (c, p) => p.setor === "ARENA" && pega(c));
  // Itens fora do catálogo: na ARENA, com o local na OBS.
  for (const x of [...os.semSetor, ...os.setores.flatMap((s) => s.avulsos)]) {
    arena.linhas.push({ item: x.descricao, quantidade: x.quantidade, obs: x.destino?.trim() || null });
    arena.total += x.quantidade;
  }

  const boxTruss: SecaoLista = {
    titulo: "BOX TRUSS",
    linhas: estrutura.estruturas.map((e) => ({ item: e.nome, quantidade: e.quantidade, obs: obsProjeto(os, e.nome) })),
    total: estrutura.estruturas.reduce((a, e) => a + e.quantidade, 0),
  };

  return { percurso, tendas: estrutura.tendas, boxTruss, ativacao, arena };
}

/** Locais em que o projeto (pelo nome em maiúsculas) foi pedido, para a coluna OBS do BOX TRUSS. */
function obsProjeto(os: OsConteudo, nomeMaiusculo: string): string | null {
  const locais = new Set<string>();
  for (const p of os.projetos ?? []) if (p.nome.toLocaleUpperCase("pt-BR") === nomeMaiusculo && p.destino?.trim()) locais.add(`${p.quantidade} ${p.destino.trim()}`);
  return locais.size ? [...locais].join(" / ") : null;
}
