import type { BomSnapshotLinha, Setor } from "@/server/db/schema";
import { SETORES } from "@/domain/constantes";

/**
 * "Todos os itens" do evento para quem pediu (dono, 18/09: "o solicitante tem que ver todos os
 * itens, incluindo os que vão nos projetos — por projeto, e itens avulsos + projetos").
 *
 * Antes a lista mostrava só as LINHAS da ata: um projeto aparecia como uma linha ("Palco 8×6 m"),
 * sem as peças que o compõem. Aqui cada projeto traz a própria composição — a mesma `bom` que a OS
 * usa (RN-01), já com os ajustes da logística —, com quanto vai por unidade e o total no evento.
 * Peças do catálogo e itens fora do catálogo ficam num grupo à parte.
 */

export type PecaDoProjeto = { codigo: string; nome: string; setor: Setor; unidade: string; porUnidade: number; total: number };

type LinhaBase = { tipo: "PROJETO" | "PECA" | "AVULSO"; quantidade: number; nome: string; areaNome: string | null; projeto?: { bom: BomSnapshotLinha[] } | null };

export type ProjetoComPecas<L> = { linha: L; pecas: PecaDoProjeto[] };

export type ItensDoEvento<L> = {
  projetos: ProjetoComPecas<L>[];
  /** Peças avulsas do catálogo e itens fora do catálogo. */
  avulsos: L[];
  /** Quantas linhas de peça os projetos somam (para o resumo). */
  totalPecasNosProjetos: number;
};

const porAreaENome = <L extends LinhaBase>(a: L, b: L) =>
  (a.areaNome ?? "Logística").localeCompare(b.areaNome ?? "Logística", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");

export function agruparItensDoEvento<L extends LinhaBase>(linhas: L[]): ItensDoEvento<L> {
  const projetos = linhas
    .filter((l) => l.tipo === "PROJETO")
    .sort(porAreaENome)
    .map((linha) => ({
      linha,
      // Mesma ordem da OS: setor, depois código.
      pecas: [...(linha.projeto?.bom ?? [])]
        .sort((a, b) => SETORES.indexOf(a.setor) - SETORES.indexOf(b.setor) || a.codigo.localeCompare(b.codigo, "pt-BR"))
        .map((b) => ({ codigo: b.codigo, nome: b.nome, setor: b.setor, unidade: b.unidade, porUnidade: b.quantidade, total: b.quantidade * linha.quantidade })),
    }));
  const avulsos = linhas.filter((l) => l.tipo !== "PROJETO").sort(porAreaENome);
  return { projetos, avulsos, totalPecasNosProjetos: projetos.reduce((s, p) => s + p.pecas.length, 0) };
}
