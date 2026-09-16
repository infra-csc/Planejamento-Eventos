import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETOR_LABEL } from "@/domain/os";
import { formatarData, formatarDataHora, formatarPeriodo } from "@/lib/format";
import type { OsConteudo } from "@/server/db/schema";

/*
 * OS completa em Excel: uma pasta com tudo que vai no caminhão, nas três leituras da tela
 * (totais por peça, por projeto, peças soltas) mais os itens avulsos e uma capa com o resumo.
 * As células de texto nunca começam com = + - @ (ExcelJS grava como string, não fórmula).
 */

const VINHO = "FF8E2740";
const ESCURO = "FF2A1418";
const CINZA = "FFF0ECEB";
const LINHA = "FFE4DEDD";

type Celula = string | number | null;

function cabecalho(ws: ExcelJS.Worksheet, colunas: Array<{ titulo: string; largura: number; alinhar?: "left" | "right" | "center" }>, linha: number) {
  const row = ws.getRow(linha);
  colunas.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c.titulo;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ESCURO } };
    cell.alignment = { vertical: "middle", horizontal: c.alinhar ?? "left" };
    cell.border = { bottom: { style: "thin", color: { argb: ESCURO } } };
    ws.getColumn(i + 1).width = c.largura;
  });
  row.height = 20;
  return linha + 1;
}

function dados(ws: ExcelJS.Worksheet, linha: number, valores: Celula[], opcoes: { alinhar?: Array<"left" | "right" | "center" | undefined>; negrito?: number[]; mono?: number[]; zebra?: boolean; checkbox?: number } = {}) {
  const row = ws.getRow(linha);
  valores.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v;
    cell.alignment = { vertical: "middle", horizontal: opcoes.alinhar?.[i] ?? (typeof v === "number" ? "right" : "left"), wrapText: true };
    cell.font = { size: 10, bold: opcoes.negrito?.includes(i) ?? false, name: opcoes.mono?.includes(i) ? "Consolas" : "Calibri" };
    cell.border = { bottom: { style: "hair", color: { argb: LINHA } } };
    if (opcoes.zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF8F8" } };
    if (typeof v === "number") cell.numFmt = "#,##0";
  });
  if (opcoes.checkbox !== undefined) {
    const c = row.getCell(opcoes.checkbox + 1);
    c.value = "☐";
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  return linha + 1;
}

function secao(ws: ExcelJS.Worksheet, linha: number, titulo: string, sub: string | null, colunas: number) {
  const row = ws.getRow(linha);
  row.getCell(1).value = titulo;
  row.getCell(1).font = { bold: true, size: 12, color: { argb: VINHO } };
  ws.mergeCells(linha, 1, linha, colunas);
  row.height = 22;
  linha++;
  if (sub) {
    const r2 = ws.getRow(linha);
    r2.getCell(1).value = sub;
    r2.getCell(1).font = { size: 9.5, color: { argb: "FF6B6263" }, italic: true };
    ws.mergeCells(linha, 1, linha, colunas);
    linha++;
  }
  return linha;
}

function ajustarImpressao(ws: ExcelJS.Worksheet, titulo: string) {
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  ws.headerFooter = { oddHeader: `&L&"Calibri,Bold"${titulo}&R&D`, oddFooter: "&LSeparado por: ____________________   Conferido por: ____________________&RPágina &P de &N" };
}

function montarPastaOs(ev: { codigo: string; nome: string; cliente: string | null; local: string | null; dataMontagem: string; dataInicio: string; dataFim: string; dataDesmontagem: string; dataCarga: string | null; responsavel: { nome: string } }, os: OsConteudo, versao: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  const rotulo = `OS ${ev.codigo} · ${ev.nome} · ${versao}`;

  /* ---------- Capa ---------- */
  const capa = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  capa.getColumn(1).width = 22;
  capa.getColumn(2).width = 60;
  let l = 1;
  capa.getRow(l).getCell(1).value = "NORTE MKT · ORDEM DE SERVIÇO";
  capa.getRow(l).getCell(1).font = { bold: true, size: 9, color: { argb: VINHO } };
  capa.mergeCells(l, 1, l, 2);
  l++;
  capa.getRow(l).getCell(1).value = `${ev.codigo} · ${ev.nome}`;
  capa.getRow(l).getCell(1).font = { bold: true, size: 16, color: { argb: ESCURO } };
  capa.mergeCells(l, 1, l, 2);
  capa.getRow(l).height = 26;
  l += 2;
  const totalPecas = os.setores.reduce((a, s) => a + s.linhas.reduce((b, x) => b + x.total, 0), 0);
  const tiposPeca = os.setores.reduce((a, s) => a + s.linhas.length, 0);
  const dadosCapa: Array<[string, string | number]> = [
    ["Versão", versao],
    ["Cliente", ev.cliente || "—"],
    ["Local", ev.local || "—"],
    ["Evento", formatarPeriodo(ev.dataInicio, ev.dataFim)],
    ["Montagem", formatarData(ev.dataMontagem)],
    ["Desmontagem", formatarData(ev.dataDesmontagem)],
    ["Carga do caminhão", ev.dataCarga ? formatarData(ev.dataCarga) : "—"],
    ["Responsável", ev.responsavel.nome],
    ["Gerado em", formatarDataHora(new Date())],
    ["", ""],
    ["Projetos padrão", os.projetos?.length ?? 0],
    ["Tipos de peça", tiposPeca],
    ["Unidades no total", totalPecas],
    ["Peças pedidas soltas", os.individuais?.length ?? 0],
    ["Itens avulsos", os.semSetor.length],
  ];
  for (const [k, v] of dadosCapa) {
    const r = capa.getRow(l);
    r.getCell(1).value = k;
    r.getCell(1).font = { size: 10, color: { argb: "FF6B6263" } };
    r.getCell(2).value = v;
    r.getCell(2).font = { size: 10, bold: typeof v === "number" };
    r.getCell(2).alignment = { horizontal: "left" };
    l++;
  }
  l++;
  const abas = capa.getRow(l);
  abas.getCell(1).value = "Abas";
  abas.getCell(1).font = { size: 10, color: { argb: "FF6B6263" } };
  abas.getCell(2).value = "Totais por peça (carregar o caminhão) · Por projeto (montar) · Peças soltas · Itens avulsos";
  abas.getCell(2).alignment = { wrapText: true };
  capa.getRow(l + 1).getCell(2).value = "A OS nunca é editada à mão: toda mudança vem de uma resposta a item ou de um ajuste da logística com justificativa.";
  capa.getRow(l + 1).getCell(2).font = { size: 9, italic: true, color: { argb: "FF6B6263" } };
  capa.getRow(l + 1).getCell(2).alignment = { wrapText: true };
  ajustarImpressao(capa, rotulo);

  /* ---------- Totais por peça ---------- */
  const tot = wb.addWorksheet("Totais por peça", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  l = cabecalho(tot, [
    { titulo: "Setor", largura: 22 },
    { titulo: "Código", largura: 13 },
    { titulo: "Peça", largura: 44 },
    { titulo: "Total", largura: 9, alinhar: "right" },
    { titulo: "Un.", largura: 6, alinhar: "center" },
    { titulo: "Composição (de onde vem)", largura: 60 },
    { titulo: "Sep.", largura: 6, alinhar: "center" },
  ], 1);
  for (const s of os.setores) {
    const unidades = s.linhas.reduce((a, x) => a + x.total, 0);
    l = secao(tot, l, SETOR_LABEL[s.setor], `${s.linhas.length} ${s.linhas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${unidades} unidades`, 7);
    s.linhas.forEach((x, i) => {
      l = dados(tot, l, [SETOR_LABEL[s.setor], x.codigo, x.nome, x.total, x.unidade, x.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · "), null], { negrito: [3], mono: [1], alinhar: [undefined, undefined, undefined, "right", "center", undefined, "center"], zebra: i % 2 === 1, checkbox: 6 });
    });
    const sub = tot.getRow(l);
    sub.getCell(3).value = `Subtotal ${SETOR_LABEL[s.setor]}`;
    sub.getCell(3).font = { bold: true, size: 10 };
    sub.getCell(4).value = unidades;
    sub.getCell(4).font = { bold: true, size: 10 };
    sub.getCell(4).numFmt = "#,##0";
    sub.getCell(4).alignment = { horizontal: "right" };
    [1, 2, 3, 4, 5, 6, 7].forEach((c) => (sub.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } }));
    l += 2;
  }
  const geral = tot.getRow(l);
  geral.getCell(3).value = "TOTAL GERAL DE UNIDADES";
  geral.getCell(3).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  geral.getCell(4).value = totalPecas;
  geral.getCell(4).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  geral.getCell(4).numFmt = "#,##0";
  geral.getCell(4).alignment = { horizontal: "right" };
  [1, 2, 3, 4, 5, 6, 7].forEach((c) => (geral.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } }));
  tot.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  ajustarImpressao(tot, `${rotulo} · Totais por peça`);

  /* ---------- Por projeto ---------- */
  const proj = wb.addWorksheet("Por projeto", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  l = cabecalho(proj, [
    { titulo: "Projeto", largura: 34 },
    { titulo: "Qtd. projeto", largura: 11, alinhar: "right" },
    { titulo: "Código", largura: 13 },
    { titulo: "Peça", largura: 44 },
    { titulo: "Setor", largura: 22 },
    { titulo: "Por unidade", largura: 11, alinhar: "right" },
    { titulo: "Total", largura: 9, alinhar: "right" },
    { titulo: "Un.", largura: 6, alinhar: "center" },
    { titulo: "Sep.", largura: 6, alinhar: "center" },
  ], 1);
  if (!os.projetos || os.projetos.length === 0) {
    proj.getRow(l).getCell(1).value = os.projetos ? "Nenhum projeto padrão nesta OS — só peças soltas e itens avulsos." : "Esta versão da OS foi gerada antes da visão por projeto.";
    proj.mergeCells(l, 1, l, 9);
  }
  for (const p of os.projetos ?? []) {
    const unidades = p.pecas.reduce((a, x) => a + x.total, 0);
    l = secao(proj, l, `${p.nome}  ×${p.quantidade}`, [`${p.codigo} · v${p.versao}`, p.destino ? `Destino: ${p.destino}` : null, p.area, `${p.pecas.length} tipos de peça · ${unidades} unidades`].filter(Boolean).join(" · "), 9);
    p.pecas.forEach((x, i) => {
      l = dados(proj, l, [p.nome, p.quantidade, x.codigo, x.nome, SETOR_LABEL[x.setor], x.porUnidade, x.total, x.unidade, null], { negrito: [6], mono: [2], alinhar: [undefined, "right", undefined, undefined, undefined, "right", "right", "center", "center"], zebra: i % 2 === 1, checkbox: 8 });
    });
    l++;
  }
  proj.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
  ajustarImpressao(proj, `${rotulo} · Por projeto`);

  /* ---------- Peças soltas ---------- */
  const solt = wb.addWorksheet("Peças soltas", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  l = cabecalho(solt, [
    { titulo: "Código", largura: 13 },
    { titulo: "Peça", largura: 44 },
    { titulo: "Setor", largura: 22 },
    { titulo: "Qtd.", largura: 9, alinhar: "right" },
    { titulo: "Un.", largura: 6, alinhar: "center" },
    { titulo: "Destino", largura: 26 },
    { titulo: "Área", largura: 18 },
    { titulo: "Sep.", largura: 6, alinhar: "center" },
  ], 1);
  if (!os.individuais || os.individuais.length === 0) {
    solt.getRow(l).getCell(1).value = os.individuais ? "Nenhuma peça pedida fora de projeto." : "Esta versão da OS foi gerada antes desta visão.";
    solt.mergeCells(l, 1, l, 8);
  }
  (os.individuais ?? []).forEach((x, i) => {
    l = dados(solt, l, [x.codigo, x.nome, SETOR_LABEL[x.setor], x.quantidade, x.unidade, x.destino ?? "—", x.area ?? "—", null], { negrito: [3], mono: [0], alinhar: [undefined, undefined, undefined, "right", "center", undefined, undefined, "center"], zebra: i % 2 === 1, checkbox: 7 });
  });
  solt.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };
  ajustarImpressao(solt, `${rotulo} · Peças soltas`);

  /* ---------- Itens avulsos ---------- */
  const av = wb.addWorksheet("Itens avulsos", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  l = cabecalho(av, [
    { titulo: "Descrição", largura: 50 },
    { titulo: "Qtd.", largura: 9, alinhar: "right" },
    { titulo: "Destino", largura: 26 },
    { titulo: "Área", largura: 18 },
    { titulo: "Sep.", largura: 6, alinhar: "center" },
  ], 1);
  if (os.semSetor.length === 0) {
    av.getRow(l).getCell(1).value = "Nenhum item avulso (sem peça de catálogo).";
    av.mergeCells(l, 1, l, 5);
  }
  os.semSetor.forEach((x, i) => {
    l = dados(av, l, [x.descricao, x.quantidade, x.destino ?? "—", x.area ?? "—", null], { negrito: [1], alinhar: [undefined, "right", undefined, undefined, "center"], zebra: i % 2 === 1, checkbox: 4 });
  });
  ajustarImpressao(av, `${rotulo} · Itens avulsos`);

  return wb;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  const ev = await obterEvento(usuario, id);
  const v = Number(new URL(request.url).searchParams.get("v"));
  const versoes = await listarOsResumo(id);
  const pedida = Number.isInteger(v) && v > 0 ? versoes.find((x) => x.numero === v) : undefined;
  const gravado = pedida ? (await obterConteudosOs(id, [pedida.numero])).get(pedida.numero) : undefined;
  // Sem versão pedida (ou versão atual gravada antes das visões novas): calcula da ata atual.
  const ehAtual = pedida && versoes[0]?.numero === pedida.numero;
  const os = gravado && (gravado.projetos || !ehAtual) ? gravado : await calcularOsAtual(await getDb(), id);
  const rotulo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero} (atual)` : "prévia";
  const wb = montarPastaOs(ev, os, rotulo);
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="OS-${ev.codigo}-${pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa"}.xlsx"`,
    },
  });
}
