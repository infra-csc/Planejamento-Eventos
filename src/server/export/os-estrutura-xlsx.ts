import type ExcelJS from "exceljs";
import { AMARELO, bloco, cabecalho, CINZA, dataCurta, escrever, letra, type Valor } from "./cenografia-xlsx";
import type { OsEstrutura } from "./os-estrutura";

/*
 * Desenho da OS de estrutura (TOTAL, SOMATORIA e uma aba por projeto) no modelo exato da planilha
 * da cenografia. Sem banco nem auth: a rota /api/os/[id]/estrutura monta os dados e chama daqui.
 */

export type Imagem = { buffer: Buffer; extension: "png" | "jpeg"; largura: number; altura: number };
export type CabecalhoOs = { nome: string; dataInicio: string; local: string; diretor: string; versao: string; geradaPor: string };

export function abaTotal(wb: ExcelJS.Workbook, ev: CabecalhoOs, d: OsEstrutura) {
  const ws = wb.addWorksheet("TOTAL", { views: [{ showGridLines: false }] });
  [2, 36, 8, 2, 30, 8, 2, 22, 8, 13, 13, 11, 8, 9, 8, 8].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Cabeçalho, como na planilha (B1:C6).
  escrever(ws, 1, 2, "O.S. DE ESTRUTURAS", { bold: true, tamanho: 14, semBorda: true });
  const cab: Array<[string, string]> = [
    ["EVENTO", ev.nome],
    ["DATA DA PROVA", dataCurta(ev.dataInicio)],
    ["CIDADE", ev.local || ""],
    ["DIRETOR DE PROVA", ev.diretor],
    ["RESPONSAVEL PELA O.S", `${ev.geradaPor} · ${ev.versao}`],
  ];
  cab.forEach(([k, v], i) => {
    escrever(ws, 2 + i, 2, k, { bold: true, fill: CINZA });
    escrever(ws, 2 + i, 3, v, { wrap: false });
    ws.mergeCells(2 + i, 3, 2 + i, 6);
  });

  const H = 8; // I e adiante: tendas
  // B:C — ESTRUTURAS e, embaixo, MARCENARIA por seção (nome do projeto e quantidade).
  let lb = bloco(ws, 8, 2, ["ESTRUTURAS", "QTDE"], d.estruturas.map((p) => [p.nome, p.quantidade]));
  if (d.marcenaria.length) {
    lb += 1;
    cabecalho(ws, lb, 2, ["MARCENARIA", "QTDE"]);
    lb++;
    for (const m of d.marcenaria) {
      if (m.tipo === "secao") {
        escrever(ws, lb, 2, m.nome, { bold: true, fill: CINZA });
        escrever(ws, lb, 3, m.quantidade, { bold: true, fill: CINZA });
      } else {
        escrever(ws, lb, 2, m.nome);
        escrever(ws, lb, 3, m.total);
      }
      lb++;
    }
  }

  // E:F — PEÇA | QTDE com as linhas fixas e o total (sem rótulo, como na planilha).
  const le = bloco(ws, 8, 5, ["PEÇA", "QTDE"], d.pecas.map((p) => [p.rotulo, p.total]), { rotulo: null, colunas: [1] });

  // H em diante — TENDAS por local (uma tabela por tamanho), depois OUTROS MATERIAIS, Q-15 KIT e ESTAIAMENTO.
  let lh = 8;
  for (const t of d.tendas) {
    const cabT = [t.titulo, "QTDE", ...t.colunas.map((c) => c.rotulo)];
    const linhas: Valor[][] = t.linhas.map((l) => [l.local, l.quantidade, ...l.valores]);
    lh = bloco(ws, lh, H, cabT, linhas, { rotulo: "TOTAL", colunas: cabT.slice(1).map((_, i) => i + 1) }, { cinza: [2] }) + 1;
  }
  const lOutros = lh;
  lh = bloco(ws, lh, H, ["OUTROS MATERIAIS", "QTDE"], d.outros.map((o) => [o.rotulo, o.valor]));
  if (d.q15) bloco(ws, lOutros + 1, H + 3, ["Q-15 KIT", "QTDE"], d.q15.map((p) => [p.rotulo, p.total]), { rotulo: null, colunas: [1] });
  lh += 1;
  lh = bloco(ws, lh, H, ["ESTAIAMENTO", "QTDE"], d.estaiamento.map((p) => [p.rotulo, p.total]), undefined, { vazioZero: true });

  if (d.semProjetos) {
    const r = Math.max(lb, le, lh) + 1;
    ws.getCell(r, 2).value = "Versão gravada antes da visão por projeto: estruturas e tendas não aparecem separadas. Abra a versão atual.";
    ws.getCell(r, 2).font = { italic: true, size: 9 };
  }
  return ws;
}

export function abaSomatoria(wb: ExcelJS.Workbook, d: OsEstrutura) {
  const ws = wb.addWorksheet("SOMATORIA", { views: [{ state: "frozen", xSplit: 2, ySplit: 4, showGridLines: false }] });
  const projs = d.somatoria.projetos;
  const colExtras = 3 + projs.length;
  const colTotal = colExtras + 1;
  [2, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = 3; c <= colTotal; c++) ws.getColumn(c).width = c >= colExtras ? 10 : 14;
  escrever(ws, 2, 2, "RESUMO BOX TRUSS", { bold: true, tamanho: 12, semBorda: true });

  cabecalho(ws, 4, 2, ["MEDIDAS TRELIÇAS", ...projs.map((p) => p.nome), "EXTRAS", "TOTAL"]);
  ws.getRow(4).height = 42;
  for (let c = 3; c <= colTotal; c++) ws.getCell(4, c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  const ini = 5;
  const L = (c: number) => letra(ws, c);
  d.somatoria.linhas.forEach((l, k) => {
    const r = ini + k;
    escrever(ws, r, 2, l.rotulo);
    l.porProjeto.forEach((v, j) => escrever(ws, r, 3 + j, v, { centro: true }));
    escrever(ws, r, colExtras, l.extras, { centro: true });
    escrever(ws, r, colTotal, { formula: `SUM(${L(3)}${r}:${L(colExtras)}${r})`, result: l.total }, { bold: true });
  });
  const n = d.somatoria.linhas.length;
  const fim = ini + Math.max(0, n - 1);
  const rt = ini + n;
  escrever(ws, rt, 2, null, { fill: AMARELO });
  for (let c = 3; c <= colTotal; c++) {
    const soma = c === colTotal ? d.totalPecas : c === colExtras ? d.somatoria.linhas.reduce((a, l) => a + l.extras, 0) : d.somatoria.linhas.reduce((a, l) => a + l.porProjeto[c - 3], 0);
    escrever(ws, rt, c, n ? { formula: `SUM(${L(c)}${ini}:${L(c)}${fim})`, result: soma } : 0, { fill: AMARELO, bold: true });
  }
  return ws;
}

export function abaProjeto(wb: ExcelJS.Workbook, a: OsEstrutura["abas"][number], imagem: Imagem | undefined) {
  const ws = wb.addWorksheet(a.nomeAba, { views: [{ showGridLines: false }] });
  [2, 34, 10, 2].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  cabecalho(ws, 2, 2, ["ESTRUTURA", "QTDE"]);
  escrever(ws, 3, 2, a.nome, { bold: true });
  escrever(ws, 3, 3, a.quantidade, { bold: true });
  cabecalho(ws, 5, 2, ["PEÇA", "QTDE"]);
  a.pecas.forEach((p, k) => {
    escrever(ws, 6 + k, 2, p.rotulo);
    escrever(ws, 6 + k, 3, p.porUnidade > 0 ? p.porUnidade : null);
  });
  const fim = 5 + Math.max(1, a.pecas.length);
  escrever(ws, fim + 1, 2, null, { fill: AMARELO });
  escrever(ws, fim + 1, 3, { formula: `SUM(C6:C${fim})`, result: a.total }, { fill: AMARELO, bold: true });
  if (a.locais.length > 1 || a.locais[0]?.local !== "EXTRA") {
    ws.getCell(fim + 3, 2).value = `Locais: ${a.locais.map((l) => `${l.local} (${l.quantidade})`).join(" · ")}`;
    ws.getCell(fim + 3, 2).font = { italic: true, size: 9 };
  }
  if (imagem) {
    const id = wb.addImage({ buffer: imagem.buffer as unknown as ExcelJS.Buffer, extension: imagem.extension });
    const largura = Math.min(560, imagem.largura);
    ws.addImage(id, { tl: { col: 4, row: 1 }, ext: { width: largura, height: Math.round((largura * imagem.altura) / imagem.largura) } });
  }
  return ws;
}

