import type ExcelJS from "exceljs";
import { textoSeguro } from "./excel";

/*
 * Desenho das planilhas no modelo da cenografia (OS de estrutura, OS de marcenaria e ata
 * "LISTA DE MATERIAIS"): cabeçalho azul com texto branco, linha de total amarela, bordas finas,
 * fonte 10. As três rotas usam estas funções para as pastas saírem iguais entre si e iguais aos
 * arquivos que a equipe já usa.
 */

export const AZUL = "FF00B0F0";
export const AMARELO = "FFFFFF00";
export const CINZA = "FFF2F2F2";
export const BRANCO = "FFFFFFFF";
const FINO = { style: "thin" as const, color: { argb: "FF000000" } };
export const BORDA: Partial<ExcelJS.Borders> = { top: FINO, left: FINO, bottom: FINO, right: FINO };

export type Valor = string | number | null | { formula: string; result: number };
export type Formato = { fill?: string; bold?: boolean; centro?: boolean; italico?: boolean; branco?: boolean; semBorda?: boolean; tamanho?: number; wrap?: boolean };

export const ehNumero = (v: Valor) => typeof v === "number" || (v !== null && typeof v === "object");
export const letra = (ws: ExcelJS.Worksheet, col: number) => ws.getColumn(col).letter;

/** Uma célula do modelo: texto de usuário sempre por textoSeguro (nome de projeto, local, item avulso). */
export function escrever(ws: ExcelJS.Worksheet, r: number, c: number, v: Valor, fmt: Formato = {}) {
  const cell = ws.getCell(r, c);
  cell.value = typeof v === "string" ? textoSeguro(v) : v;
  if (!fmt.semBorda) cell.border = BORDA;
  cell.font = { size: fmt.tamanho ?? 10, bold: fmt.bold, italic: fmt.italico, color: fmt.branco ? { argb: BRANCO } : undefined };
  if (fmt.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fmt.fill } };
  cell.alignment = { vertical: "middle", horizontal: ehNumero(v) || fmt.centro ? "center" : "left", wrapText: fmt.wrap ?? (!ehNumero(v) && typeof v === "string" && v.length > 28) };
  if (ehNumero(v)) cell.numFmt = "0";
  return cell;
}

/** Cabeçalho de bloco: azul, negrito, branco. */
export function cabecalho(ws: ExcelJS.Worksheet, r: number, c: number, titulos: string[], centroAPartir = 1) {
  titulos.forEach((t, i) => escrever(ws, r, c + i, t, { fill: AZUL, bold: true, branco: true, centro: i >= centroAPartir }));
}

/**
 * Bloco "rótulo | quantidade(s)" com cabeçalho azul e, se pedido, linha de total amarela (SUM com o
 * resultado já gravado, para abrir certo em visualizadores que não recalculam). `colunasTotal` são
 * os índices (dentro do bloco) que somam; `rotuloTotal` null = total sem rótulo, como na planilha.
 * Devolve a linha seguinte à última escrita.
 */
export function bloco(ws: ExcelJS.Worksheet, linha: number, col: number, cab: string[], linhas: Valor[][], total?: { rotulo: string | null; colunas: number[] }, opcoes: { cinza?: number[]; vazioZero?: boolean } = {}) {
  cabecalho(ws, linha, col, cab);
  const corpo: Valor[][] = linhas.length ? linhas : [cab.map(() => null)];
  corpo.forEach((row, k) =>
    row.forEach((v, i) => {
      const valor = v === 0 && opcoes.vazioZero ? null : v;
      escrever(ws, linha + 1 + k, col + i, valor, { centro: i > 0, fill: opcoes.cinza?.includes(i) ? CINZA : undefined });
    }),
  );
  let fim = linha + corpo.length;
  if (total) {
    const r = fim + 1;
    cab.forEach((_, i) => {
      if (i === 0) return escrever(ws, r, col, total.rotulo, { fill: AMARELO, bold: true });
      if (!total.colunas.includes(i)) return escrever(ws, r, col + i, null, { fill: AMARELO });
      const L = letra(ws, col + i);
      const soma = linhas.reduce<number>((a, row) => a + (typeof row[i] === "number" ? (row[i] as number) : 0), 0);
      escrever(ws, r, col + i, { formula: `SUM(${L}${linha + 1}:${L}${fim})`, result: soma }, { fill: AMARELO, bold: true });
    });
    fim = r;
  }
  return fim + 1;
}

/** Título de seção da OS de marcenaria e da ata (uma célula azul com o nome, sem bordas ao redor). */
export function tituloSecao(ws: ExcelJS.Worksheet, r: number, c: number, texto: string, ate?: number) {
  escrever(ws, r, c, texto, { fill: AZUL, bold: true, branco: true });
  if (ate && ate > c) {
    for (let k = c + 1; k <= ate; k++) escrever(ws, r, k, null, { fill: AZUL });
    ws.mergeCells(r, c, r, ate);
  }
}

/** Data no formato da planilha (dd/mm/aaaa) a partir de ISO ou Date; vazio quando não há. */
export function dataCurta(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v.length === 10 ? `${v}T12:00:00` : v) : v;
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
}
