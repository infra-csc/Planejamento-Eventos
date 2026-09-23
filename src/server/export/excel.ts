import type ExcelJS from "exceljs";

type TemaTabela = NonNullable<ExcelJS.TableProperties["style"]>["theme"];

/** Paleta do app em ARGB, para as pastas Excel ficarem com a mesma cara do sistema. */
export const COR = { vinho: "FF8E2740", escuro: "FF2A1418", cinza: "FFF0ECEB", linha: "FFE4DEDD", texto2: "FF6B6263", branco: "FFFFFFFF", claro: "FFFAF8F8" };

export const CHECK = "☐";

/**
 * Texto digitado por usuário (nome, destino, item avulso) numa célula: o que começa com = + - @
 * (ou tab/CR) é gravado como rich text, sempre texto, para nunca ser lido como fórmula.
 */
export function textoSeguro(v: string): string | { richText: Array<{ text: string }> } {
  return /^[=+\-@\t\r]/.test(v) ? { richText: [{ text: v }] } : v;
}

/** Faixa de título no topo da aba (nome da empresa, título grande e subtítulo), ocupando `cols` colunas. */
export function faixaTitulo(ws: ExcelJS.Worksheet, cols: number, empresa: string, titulo: string, subtitulo: string) {
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= cols; c++) ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.escuro } };
  ws.mergeCells(1, 1, 1, cols);
  ws.mergeCells(2, 1, 2, cols);
  ws.mergeCells(3, 1, 3, cols);
  ws.getCell(1, 1).value = empresa;
  ws.getCell(1, 1).font = { bold: true, size: 9, color: { argb: "FFE0798F" } };
  ws.getCell(1, 1).alignment = { vertical: "middle", indent: 1 };
  ws.getCell(2, 1).value = titulo;
  ws.getCell(2, 1).font = { bold: true, size: 18, color: { argb: COR.branco } };
  ws.getCell(2, 1).alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 30;
  ws.getCell(3, 1).value = subtitulo;
  ws.getCell(3, 1).font = { size: 10, color: { argb: "FFD9CDD0" } };
  ws.getCell(3, 1).alignment = { vertical: "middle", indent: 1 };
  ws.getRow(3).height = 18;
  return 5;
}

/** Bloco rótulo/valor com bordas finas (cabeçalho de documento). Retorna a próxima linha livre. */
export function blocoDados(ws: ExcelJS.Worksheet, linha: number, col: number, pares: Array<[string, string | number]>, larguraValor = 3) {
  pares.forEach(([k, v], i) => {
    const r = linha + i;
    const ck = ws.getCell(r, col);
    ck.value = k;
    ck.font = { size: 10, color: { argb: COR.texto2 } };
    ck.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.claro } };
    ck.border = { bottom: { style: "hair", color: { argb: COR.linha } } };
    ck.alignment = { vertical: "middle", indent: 1 };
    const cv = ws.getCell(r, col + 1);
    cv.value = v;
    cv.font = { size: 10, bold: typeof v === "number" };
    cv.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    cv.border = { bottom: { style: "hair", color: { argb: COR.linha } } };
    if (larguraValor > 1) ws.mergeCells(r, col + 1, r, col + larguraValor);
    ws.getRow(r).height = 18;
  });
  return linha + pares.length;
}

/** Título de seção dentro da aba (vinho, com linha embaixo). */
export function tituloSecao(ws: ExcelJS.Worksheet, linha: number, cols: number, texto: string, sub?: string) {
  const c = ws.getCell(linha, 1);
  c.value = texto;
  c.font = { bold: true, size: 12, color: { argb: COR.vinho } };
  c.alignment = { vertical: "middle" };
  ws.mergeCells(linha, 1, linha, cols);
  ws.getRow(linha).height = 22;
  if (!sub) return linha + 1;
  const s = ws.getCell(linha + 1, 1);
  s.value = sub;
  s.font = { size: 9.5, italic: true, color: { argb: COR.texto2 } };
  ws.mergeCells(linha + 1, 1, linha + 1, cols);
  return linha + 2;
}

export type ColunaTabela = { nome: string; largura: number; total?: "sum" | "count" | "none"; rotuloTotal?: string; numero?: boolean; alinhar?: "left" | "right" | "center"; mono?: boolean };

/**
 * Tabela nativa do Excel (filtros, listras, linha de totais com fórmula). O nome precisa ser único
 * na pasta e sem espaços. Retorna a linha seguinte à tabela (incluindo a linha de totais).
 */
export function tabela(ws: ExcelJS.Worksheet, nome: string, linha: number, colunas: ColunaTabela[], linhas: Array<Array<string | number | null>>, opcoes: { totais?: boolean; tema?: TemaTabela } = {}) {
  const totais = opcoes.totais ?? colunas.some((c) => c.total && c.total !== "none");
  colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (!col.width || col.width < c.largura) col.width = c.largura;
  });
  ws.addTable({
    name: nome,
    ref: `A${linha}`,
    headerRow: true,
    totalsRow: totais,
    style: { theme: opcoes.tema ?? "TableStyleMedium2", showRowStripes: true, showFirstColumn: false },
    columns: colunas.map((c, i) => ({
      name: c.nome,
      filterButton: true,
      totalsRowLabel: i === 0 ? (c.rotuloTotal ?? "Total") : undefined,
      totalsRowFunction: c.total && c.total !== "none" ? c.total : "none",
    })),
    rows: linhas.length ? linhas : [colunas.map(() => "")],
  });
  const ultima = linha + Math.max(1, linhas.length) + (totais ? 1 : 0);
  // Alinhamento, fonte mono e formato numérico por coluna (o tema cuida das cores).
  for (let r = linha + 1; r <= ultima; r++) {
    colunas.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.alignment = { vertical: "middle", horizontal: c.alinhar ?? (c.numero ? "right" : "left"), wrapText: !c.numero && !c.mono };
      if (c.mono) cell.font = { ...(cell.font ?? {}), name: "Consolas", size: 10 };
      if (c.numero) cell.numFmt = "#,##0";
    });
  }
  ws.getRow(linha).height = 20;
  return ultima + 1;
}

export function impressao(ws: ExcelJS.Worksheet, cabecalho: string, rodape: string, linhaTitulos?: number, paisagem = false) {
  ws.pageSetup = { paperSize: 9, orientation: paisagem ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }, printTitlesRow: linhaTitulos ? `${linhaTitulos}:${linhaTitulos}` : undefined };
  ws.headerFooter = { oddHeader: `&L&"Calibri,Bold"${cabecalho}&R&D`, oddFooter: `&L${rodape}&RPágina &P de &N` };
}
