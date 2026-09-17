import type { Arena, CategoriaPonto, ItemAta, Modelo, PontoArena, Vec2 } from "./tipos";
import { CATEGORIAS } from "./categorias";

/** Posição editada na Arena 3D (vinda do banco), aplicada por cima da planta importada. */
export type PosicaoEditada = {
  chave: string;
  tipo: "MOVER" | "NOVO";
  nome: string | null;
  categoria: string | null;
  rotuloTipo: string | null;
  /** "SEÇÃO|item" da ata, quando o ponto novo materializa uma linha da ata. */
  itemAta: string | null;
  x: number;
  z: number;
  atualizadoPor?: string | null;
  atualizadoEm?: string | null;
};

export const chaveItemAta = (i: ItemAta) => `${i.secao}|${i.item}`;
/** Chave estável de um ponto novo, derivada da origem (linha da ata ou item da legenda). */
export const chavePontoNovo = (origem: "ata" | "planta" | "livre", nome: string) => `novo:${origem}:${nome}`;
/** Item que ainda não está na planta nem na ata, criado direto no mapa. */
export const ehItemLivre = (chave: string) => chave.startsWith("novo:livre:");

/** Categoria sugerida para um item sem posição, pela seção da ata. */
export function categoriaSugerida(secao: string | null): CategoriaPonto {
  if (!secao) return "operacao";
  if (secao === "ATIVAÇÃO") return "patrocinio";
  if (secao === "BOX TRUSS") return "estrutura";
  if (secao.startsWith("TENDAS")) return "operacao";
  if (secao === "PERCURSO") return "hidratacao";
  return "operacao";
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const deslocar = ([x, z]: Vec2, dx: number, dz: number): Vec2 => [r1(x + dx), r1(z + dz)];

function moverModelo(m: Modelo, dx: number, dz: number): Modelo {
  return { ...m, posicao: deslocar(m.posicao, dx, dz) } as Modelo;
}

/**
 * Arena final = planta + posições editadas. Pura: não muda a arena de entrada.
 * MOVER desloca o ponto e as estruturas dele juntos. NOVO cria um ponto de marcação
 * (sem modelo 3D próprio) e tira o item das listas de "sem posição".
 */
export function aplicarPosicoes(arena: Arena, posicoes: PosicaoEditada[]): Arena {
  if (posicoes.length === 0) return arena;
  const porChave = new Map(posicoes.map((p) => [p.chave, p]));

  const pontos: PontoArena[] = arena.pontos.map((p) => {
    const e = porChave.get(p.id);
    if (!e || e.tipo !== "MOVER") return p;
    const dx = e.x - p.posicao[0];
    const dz = e.z - p.posicao[1];
    return {
      ...p,
      nome: e.nome?.trim() || p.nome,
      categoria: e.categoria && e.categoria in CATEGORIAS ? (e.categoria as CategoriaPonto) : p.categoria,
      posicao: [r1(e.x), r1(e.z)],
      modelos: p.modelos.map((m) => moverModelo(m, dx, dz)),
      observacoes: [...p.observacoes, `Posição ajustada na Arena 3D${e.atualizadoPor ? ` por ${e.atualizadoPor}` : ""}.`],
    };
  });

  const ataPorChave = new Map(arena.ata.map((i) => [chaveItemAta(i), i]));
  const nomesPlanta = new Set<string>();
  for (const e of posicoes) {
    if (e.tipo !== "NOVO" || !e.nome) continue;
    const item = e.itemAta ? ataPorChave.get(e.itemAta) : undefined;
    const livre = ehItemLivre(e.chave);
    if (!e.itemAta && !livre) nomesPlanta.add(e.nome);
    const categoria = (e.categoria && e.categoria in CATEGORIAS ? e.categoria : categoriaSugerida(item?.secao ?? null)) as CategoriaPonto;
    pontos.push({
      id: e.chave,
      nome: e.nome,
      categoria,
      tipo: e.rotuloTipo ?? (item ? item.secao.toLowerCase() : livre ? "Item adicionado" : "Item da planta"),
      posicao: [r1(e.x), r1(e.z)],
      alturaMarcador: 3,
      zonaId: null,
      modelos: [],
      itensAta: item ? [item] : [],
      resumo: item
        ? `${item.item}${item.quantidade != null ? ` · ${item.quantidade}` : ""}. Posicionado na Arena 3D pela logística.`
        : livre
          ? "Item que ainda não está na planta, adicionado na Arena 3D pela logística."
          : "Item da legenda da planta posicionado na Arena 3D pela logística.",
      status: { rotulo: livre ? "fora da planta" : "posição manual", tom: livre ? "atencao" : "neutro" },
      responsavel: null,
      observacoes: [`Posicionado na Arena 3D${e.atualizadoPor ? ` por ${e.atualizadoPor}` : ""}.`],
    });
  }

  return {
    ...arena,
    pontos,
    semPosicaoNaPlanta: arena.semPosicaoNaPlanta.filter((s) => !nomesPlanta.has(s.item)),
  };
}
