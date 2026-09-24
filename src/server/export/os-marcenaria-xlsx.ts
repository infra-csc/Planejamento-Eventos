import type ExcelJS from "exceljs";
import { cabecalho, CINZA, dataCurta, escrever, tituloSecao } from "./cenografia-xlsx";
import type { OsMarcenaria } from "./os-marcenaria";

/*
 * Desenho da OS de marcenaria (aba O.S) no modelo da planilha da cenografia. Sem banco nem auth:
 * a rota /api/os/[id]/marcenaria monta os dados e chama daqui.
 */

export type CabecalhoMarcenaria = { nome: string; dataCarga: string | null; responsavelEvento: string };

export function abaOsMarcenaria(wb: ExcelJS.Workbook, cab: CabecalhoMarcenaria, d: OsMarcenaria) {
  const ws = wb.addWorksheet("O.S", { views: [{ showGridLines: false }] });
  [2, 34, 44, 14, 16, 26].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  escrever(ws, 2, 2, "O.S DE MARCENARIA", { bold: true, tamanho: 14, semBorda: true });
  const linhas: Array<[string, string]> = [
    ["EVENTO", cab.nome],
    ["DATA DA CARGA", dataCurta(cab.dataCarga)],
    ["RESPONSÁVEL DA CARGA", ""],
    ["RESPONSÁVEL DO EVENTO", cab.responsavelEvento],
  ];
  linhas.forEach(([k, val], i) => {
    escrever(ws, 3 + i, 4, k, { bold: true, fill: CINZA });
    escrever(ws, 3 + i, 5, val, { wrap: false });
    ws.mergeCells(3 + i, 5, 3 + i, 6);
  });

  let r = 8;
  for (const s of d.secoes) {
    tituloSecao(ws, r, 2, s.nome, 6);
    r++;
    cabecalho(ws, r, 2, ["ITEM", "PEÇAS", "QUANTIDADE", "REFERENCIA", "OBSERVAÇÃO"], 3);
    r++;
    if (s.itens.length === 0) {
      for (let c = 2; c <= 6; c++) escrever(ws, r, c, null);
      r++;
    }
    for (const it of s.itens) {
      it.pecas.forEach((p, k) => {
        escrever(ws, r, 2, k === 0 ? it.item : null, { bold: k === 0 });
        escrever(ws, r, 3, p.nome);
        escrever(ws, r, 4, p.quantidade);
        escrever(ws, r, 5, null);
        escrever(ws, r, 6, p.observacao);
        r++;
      });
      if (it.pecas.length > 1) ws.mergeCells(r - it.pecas.length, 2, r - 1, 2);
    }
  }
  if (d.semProjetos) {
    ws.getCell(r + 1, 2).value = "Versão gravada antes da visão por projeto: as peças de marcenaria não aparecem por projeto. Abra a versão atual.";
    ws.getCell(r + 1, 2).font = { italic: true, size: 9 };
  }
  return ws;
}
