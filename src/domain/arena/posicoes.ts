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
  /** Giro em radianos em relação à planta (null/ausente = como está na planta). */
  rotacao?: number | null;
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

/** Giro no chão no mesmo sentido do three.js (rotation.y): positivo é anti-horário visto de cima (norte para cima). */
export function girarVec([x, z]: Vec2, angulo: number): Vec2 {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return [x * c + z * s, -x * s + z * c];
}

/** Ângulo em [-π, π), arredondado para não acumular resíduo de ponto flutuante a cada 15°. */
export function normalizarAngulo(a: number): number {
  const volta = Math.PI * 2;
  const r = a - volta * Math.floor((a + Math.PI) / volta);
  return Math.round(r * 1e6) / 1e6;
}

export const emGraus = (rad: number) => Math.round((rad * 180) / Math.PI);

/** "30° anti-horário" / "15° horário" (visto de cima, norte para cima); null sem giro. */
export function descreverGiro(rad: number | null | undefined): string | null {
  const g = emGraus(rad ?? 0);
  if (!g) return null;
  return g > 0 ? `${g}° anti-horário` : `${-g}° horário`;
}

/**
 * Leva as estruturas do ponto junto: gira cada modelo em torno do ponto original (posição e
 * orientação) e depois desloca até o novo lugar.
 */
function reposicionarModelo(m: Modelo, [ox, oz]: Vec2, [nx, nz]: Vec2, giro: number): Modelo {
  const [rx, rz] = girarVec([m.posicao[0] - ox, m.posicao[1] - oz], giro);
  const posicao: Vec2 = [r1(nx + rx), r1(nz + rz)];
  if (!giro || m.tipo === "espaco") return { ...m, posicao } as Modelo;
  return { ...m, posicao, rotacao: normalizarAngulo((m.rotacao ?? 0) + giro) } as Modelo;
}

/**
 * Arena final = planta + posições editadas. Pura: não muda a arena de entrada.
 * MOVER desloca o ponto e as estruturas dele juntos (e gira todas em torno do ponto, se houver
 * giro). NOVO cria um ponto de marcação (sem modelo 3D próprio; a cena desenha uma forma
 * genérica pelo nome) e tira o item das listas de "sem posição".
 */
export function aplicarPosicoes(arena: Arena, posicoes: PosicaoEditada[]): Arena {
  if (posicoes.length === 0) return arena;
  const porChave = new Map(posicoes.map((p) => [p.chave, p]));

  const pontos: PontoArena[] = arena.pontos.map((p) => {
    const e = porChave.get(p.id);
    if (!e || e.tipo !== "MOVER") return p;
    const giro = e.rotacao ?? 0;
    const posicao: Vec2 = [r1(e.x), r1(e.z)];
    return {
      ...p,
      nome: e.nome?.trim() || p.nome,
      categoria: e.categoria && e.categoria in CATEGORIAS ? (e.categoria as CategoriaPonto) : p.categoria,
      posicao,
      ...(e.rotacao != null ? { rotacao: e.rotacao } : {}),
      modelos: p.modelos.map((m) => reposicionarModelo(m, p.posicao, posicao, giro)),
      observacoes: [
        ...p.observacoes,
        `Posição ajustada na Arena 3D${e.atualizadoPor ? ` por ${e.atualizadoPor}` : ""}.`,
        ...(descreverGiro(giro) ? [`Girado ${descreverGiro(giro)} em relação à planta.`] : []),
      ],
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
      ...(e.rotacao != null ? { rotacao: e.rotacao } : {}),
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

/* ------------------------------------------------------------------ */
/* Leitura do mapa: régua e quantidades                                 */
/* ------------------------------------------------------------------ */

export const distancia = (a: Vec2, b: Vec2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

const umaCasa = (m: number) => (Math.round(m * 10) / 10).toFixed(1).replace(".", ",");

/** Rótulo da régua no mapa: "38 m"; abaixo de 10 m, com uma casa ("7,5 m"). */
export function rotuloDistancia(m: number): string {
  if (Math.round(m * 10) / 10 < 10) return `${umaCasa(m)} m`;
  return `${Math.round(m).toLocaleString("pt-BR")} m`;
}

/** Na barra de contexto, sempre com uma casa: "38,2 m". */
export function distanciaPrecisa(m: number): string {
  const [inteiro, decimal] = umaCasa(m).split(",");
  return `${Number(inteiro).toLocaleString("pt-BR")},${decimal} m`;
}

/** Soma das quantidades das linhas da ata do ponto ("× 43" junto ao rótulo); null se nenhuma informa. */
export function quantidadeAta(p: Pick<PontoArena, "itensAta">): number | null {
  const comQuantidade = p.itensAta.filter((i) => i.quantidade != null);
  return comQuantidade.length ? comQuantidade.reduce((t, i) => t + (i.quantidade ?? 0), 0) : null;
}
