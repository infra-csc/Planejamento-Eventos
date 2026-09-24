import type ExcelJS from "exceljs";
import { bloco, dataCurta, escrever, tituloSecao, type Valor } from "./cenografia-xlsx";
import type { AtaLista, SecaoLista } from "./ata-lista";

/*
 * Desenho da ata no modelo da planilha da cenografia (aba LISTA DE MATERIAIS). Sem banco nem auth:
 * a rota /api/eventos/[id]/ata/lista monta os dados e chama daqui.
 */

export type CabecalhoAta = {
  nome: string;
  dataReuniao: Date | string;
  diretor: string;
  presentes: string | null;
  caminhaoCarrega: string | null;
  caminhaoSai: string | null;
  arenaDescarrega: string | null;
  kitDescarrega: string | null;
  dataEvento: string;
  local: string;
  publicoEsperado: number | null;
  observacoes: string | null;
};

function secao(ws: ExcelJS.Worksheet, r: number, s: SecaoLista, titulo = true): number {
  if (titulo) {
    tituloSecao(ws, r, 2, s.titulo);
    r++;
  }
  const linhas: Valor[][] = s.linhas.map((l) => [l.item, l.quantidade, l.obs]);
  return bloco(ws, r, 2, titulo ? ["ITEM", "QTDE", "OBS"] : [s.titulo, "Qtde", "Obs"], linhas, { rotulo: "Total", colunas: [1] }) + 1;
}

export function abaListaMateriais(wb: ExcelJS.Workbook, cab: CabecalhoAta, d: AtaLista) {
  const ws = wb.addWorksheet("LISTA DE MATERIAIS", { views: [{ showGridLines: false }] });
  [2, 34, 12, 14, 16, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  escrever(ws, 1, 2, `ATA DE REUNIAO - ${cab.nome.toLocaleUpperCase("pt-BR")}`, { bold: true, tamanho: 13, semBorda: true, wrap: false });
  escrever(ws, 2, 2, "DATA REUNIÃO O.S.", { bold: true });
  escrever(ws, 2, 3, dataCurta(cab.dataReuniao));
  escrever(ws, 3, 2, "DIRETOR PROVA", { bold: true });
  escrever(ws, 3, 3, cab.diretor);
  escrever(ws, 4, 2, "PESSOAS PRESENTES", { bold: true });
  escrever(ws, 4, 3, cab.presentes ?? "");
  ws.mergeCells(4, 3, 4, 6);
  const logistica: Array<[string, string | null, string, Valor]> = [
    ["Caminhão carrega:", cab.caminhaoCarrega, "Nome evento:", cab.nome],
    ["Caminhão sai:", cab.caminhaoSai, "Data evento", dataCurta(cab.dataEvento)],
    ["Arena descarrega:", cab.arenaDescarrega, "Cidade e Local", cab.local],
    ["Kit Descarrega:", cab.kitDescarrega, "Publico esperado", cab.publicoEsperado],
  ];
  logistica.forEach(([k, v, k2, v2], i) => {
    const r = 5 + i;
    escrever(ws, r, 2, `${k} ${v ?? ""}`.trim(), { wrap: false });
    escrever(ws, r, 3, k2, { bold: true });
    escrever(ws, r, 4, v2, { wrap: false });
    ws.mergeCells(r, 4, r, 6);
  });

  let r = 10;
  r = secao(ws, r, d.percurso);

  tituloSecao(ws, r, 2, "ESTRUTURA");
  r += 2;
  for (const t of [...d.tendas].sort((a, b) => a.titulo.localeCompare(b.titulo))) {
    // Na ata só tendas, fechamentos e calhas por local (as outras peças ficam para a OS de estrutura).
    const iFech = t.colunas.findIndex((c) => c.rotulo === "FECHAMENTOS");
    const iCalha = t.colunas.findIndex((c) => c.rotulo === "CALHA");
    const cab = [t.titulo, "Tendas", "Fechamentos", ...(iCalha >= 0 ? ["Calha de Lona"] : []), "Obs"];
    const linhas: Valor[][] = t.linhas.map((l) => [l.local, l.quantidade, iFech >= 0 ? l.valores[iFech] : 0, ...(iCalha >= 0 ? [l.valores[iCalha]] : []), null]);
    r = bloco(ws, r, 2, cab, linhas, { rotulo: "Total", colunas: cab.slice(1, -1).map((_, i) => i + 1) }) + 1;
  }
  r = secao(ws, r, d.boxTruss, false);

  r = secao(ws, r, d.ativacao);
  r = secao(ws, r, d.arena);

  tituloSecao(ws, r, 2, "OBSERVACOES");
  r++;
  escrever(ws, r, 2, cab.observacoes ?? "", { wrap: true });
  ws.mergeCells(r, 2, r + 3, 6);
  ws.getCell(r, 2).alignment = { vertical: "top", wrapText: true };
  return ws;
}
