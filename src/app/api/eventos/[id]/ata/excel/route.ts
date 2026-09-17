import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { montarAtaExport } from "@/server/export/ata";
import { ITEM_STATUS_LABEL } from "@/domain/solicitacao";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";

/*
 * Ata da reunião de OS em Excel: cabeçalho com os campos da ata (reunião, presentes, público, carga),
 * as linhas conferidas item a item, observações e o que cada área pediu antes da reunião.
 */

const VINHO = "FF8E2740";
const ESCURO = "FF2A1418";
const CINZA = "FFF0ECEB";
const LINHA = "FFE4DEDD";
const TIPO_LABEL = { PROJETO: "Projeto padrão", PECA: "Peça", AVULSO: "Avulso" } as const;

function titulo(ws: ExcelJS.Worksheet, linha: number, texto: string, cols: number, tamanho = 12) {
  const r = ws.getRow(linha);
  r.getCell(1).value = texto;
  r.getCell(1).font = { bold: true, size: tamanho, color: { argb: VINHO } };
  ws.mergeCells(linha, 1, linha, cols);
  r.height = tamanho + 10;
  return linha + 1;
}

function cabecalho(ws: ExcelJS.Worksheet, linha: number, titulos: string[], alinhar: Array<"left" | "right" | "center"> = []) {
  const r = ws.getRow(linha);
  titulos.forEach((t, i) => {
    const c = r.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ESCURO } };
    c.alignment = { vertical: "middle", horizontal: alinhar[i] ?? "left" };
  });
  r.height = 20;
  return linha + 1;
}

function dados(ws: ExcelJS.Worksheet, linha: number, valores: Array<string | number | null>, opcoes: { negrito?: number[]; mono?: number[]; alinhar?: Array<"left" | "right" | "center" | undefined>; zebra?: boolean } = {}) {
  const r = ws.getRow(linha);
  valores.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v;
    c.alignment = { vertical: "middle", horizontal: opcoes.alinhar?.[i] ?? (typeof v === "number" ? "right" : "left"), wrapText: true };
    c.font = { size: 10, bold: opcoes.negrito?.includes(i) ?? false, name: opcoes.mono?.includes(i) ? "Consolas" : "Calibri" };
    c.border = { bottom: { style: "hair", color: { argb: LINHA } } };
    if (opcoes.zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF8F8" } };
    if (typeof v === "number") c.numFmt = "#,##0";
  });
  return linha + 1;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  const v = Number(new URL(request.url).searchParams.get("v"));
  const ata = await montarAtaExport(usuario, id, Number.isInteger(v) && v > 0 ? v : undefined);
  const ev = ata.evento;
  const reu = ata.reuniao;
  const rotuloVersao = ata.versao ? `v${ata.versao}` : "em construção";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();

  /* ---------- Ata ---------- */
  const ws = wb.addWorksheet("Ata", { views: [{ showGridLines: false }] });
  [14, 46, 9, 26, 18, 24, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let l = 1;
  ws.getRow(l).getCell(1).value = "NORTE MKT · ATA DA REUNIÃO DE OS";
  ws.getRow(l).getCell(1).font = { bold: true, size: 9, color: { argb: VINHO } };
  ws.mergeCells(l, 1, l, 7);
  l++;
  ws.getRow(l).getCell(1).value = `${ev.codigo} · ${ev.nome}`;
  ws.getRow(l).getCell(1).font = { bold: true, size: 16, color: { argb: ESCURO } };
  ws.mergeCells(l, 1, l, 7);
  ws.getRow(l).height = 26;
  l++;
  ws.getRow(l).getCell(1).value = `Ata ${rotuloVersao}${reu?.fechadaEm ? ` · fechada em ${formatarDataHora(reu.fechadaEm)}` : " · ainda não fechada"}`;
  ws.getRow(l).getCell(1).font = { size: 10, italic: true, color: { argb: "FF6B6263" } };
  ws.mergeCells(l, 1, l, 7);
  l += 2;

  // Cabeçalho em dois blocos: evento (esquerda) e reunião (direita), como na planilha de ata.
  const esquerda: Array<[string, string]> = [
    ["Cliente", ev.cliente || "—"],
    ["Local", ev.local || "—"],
    ["Data do evento", formatarPeriodo(ev.dataInicio, ev.dataFim)],
    ["Público esperado", reu?.publicoEsperado != null ? reu.publicoEsperado.toLocaleString("pt-BR") : "—"],
    ["Caminhão carrega", reu?.caminhaoCarrega || "—"],
    ["Caminhão sai", reu?.caminhaoSai || "—"],
    ["Arena descarrega", reu?.arenaDescarrega || "—"],
    ["Kit descarrega", reu?.kitDescarrega || "—"],
  ];
  const direita: Array<[string, string]> = [
    ["Reunião marcada", formatarDataHora(ev.dataReuniao)],
    ["Iniciada", reu?.iniciadaEm ? formatarDataHora(reu.iniciadaEm) : "—"],
    ["Ata fechada", reu?.fechadaEm ? formatarDataHora(reu.fechadaEm) : "—"],
    ["Fechada por", reu?.fechadaPor || "—"],
    ["Conduzida por", reu?.conduzidaPor || ev.responsavel],
    ["Linhas conferidas", `${ata.linhas.filter((x) => x.conferidoPor).length} de ${ata.linhas.length}`],
  ];
  const inicio = l;
  esquerda.forEach(([k, val], i) => {
    const r = ws.getRow(inicio + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { size: 10, color: { argb: "FF6B6263" } };
    r.getCell(2).value = val;
    r.getCell(2).font = { size: 10 };
  });
  direita.forEach(([k, val], i) => {
    const r = ws.getRow(inicio + i);
    r.getCell(4).value = k;
    r.getCell(4).font = { size: 10, color: { argb: "FF6B6263" } };
    r.getCell(5).value = val;
    r.getCell(5).font = { size: 10, bold: k === "Ata fechada" };
    ws.mergeCells(inicio + i, 5, inicio + i, 7);
  });
  l = inicio + esquerda.length + 1;

  ws.getRow(l).getCell(1).value = "Pessoas presentes";
  ws.getRow(l).getCell(1).font = { size: 10, color: { argb: "FF6B6263" } };
  ws.getRow(l).getCell(2).value = reu?.presentes?.trim() || "—";
  ws.getRow(l).getCell(2).alignment = { wrapText: true, vertical: "top" };
  ws.mergeCells(l, 2, l, 7);
  ws.getRow(l).height = Math.max(18, Math.ceil((reu?.presentes?.length ?? 0) / 90) * 15);
  l += 2;

  l = titulo(ws, l, "O que vai para o evento", 7);
  l = cabecalho(ws, l, ["Código", "Item", "Qtd.", "Destino", "Área", "Origem", "Conferido por"], ["left", "left", "right", "left", "left", "left", "left"]);
  ata.linhas.forEach((x, i) => {
    l = dados(ws, l, [x.codigo ?? "", `${x.descricao}${x.versao ? ` (v${x.versao})` : ""} · ${TIPO_LABEL[x.tipo]}`, x.quantidade, x.destino ?? "—", x.area ?? "Logística", x.origem, x.conferidoPor ?? "—"], { negrito: [2], mono: [0], zebra: i % 2 === 1 });
  });
  const tot = ws.getRow(l);
  tot.getCell(2).value = `${ata.linhas.length} ${ata.linhas.length === 1 ? "linha" : "linhas"} · total de unidades`;
  tot.getCell(2).font = { bold: true, size: 10 };
  tot.getCell(3).value = ata.linhas.reduce((a, x) => a + x.quantidade, 0);
  tot.getCell(3).font = { bold: true, size: 10 };
  tot.getCell(3).numFmt = "#,##0";
  tot.getCell(3).alignment = { horizontal: "right" };
  [1, 2, 3, 4, 5, 6, 7].forEach((c) => (tot.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } }));
  l += 2;

  l = titulo(ws, l, "Observações da reunião", 7);
  ws.getRow(l).getCell(1).value = ata.observacoes?.trim() || "Nenhuma observação registrada.";
  ws.getRow(l).getCell(1).alignment = { wrapText: true, vertical: "top" };
  ws.mergeCells(l, 1, l, 7);
  ws.getRow(l).height = Math.max(18, Math.ceil((ata.observacoes?.length ?? 0) / 110) * 15);
  l += 2;

  ws.getRow(l).getCell(1).value = "Assinatura logística: ______________________________";
  ws.getRow(l).getCell(4).value = "Assinatura cliente / gestão: ______________________________";
  ws.mergeCells(l, 1, l, 3);
  ws.mergeCells(l, 4, l, 7);
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  ws.headerFooter = { oddHeader: `&L&"Calibri,Bold"Ata ${ev.codigo} · ${ev.nome} · ${rotuloVersao}&R&D`, oddFooter: "&RPágina &P de &N" };

  /* ---------- Pedidos das áreas ---------- */
  if (ata.solicitacoesPreReuniao.length > 0) {
    const ws2 = wb.addWorksheet("Pedidos das áreas", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    [12, 18, 46, 10, 10, 16, 50].forEach((w, i) => (ws2.getColumn(i + 1).width = w));
    let k = cabecalho(ws2, 1, ["Solicitação", "Área", "Item", "Pedido", "Atendido", "Situação", "Observação da logística"], ["left", "left", "left", "right", "right", "left", "left"]);
    let z = 0;
    for (const s of ata.solicitacoesPreReuniao) {
      for (const it of s.itens) {
        k = dados(ws2, k, [s.codigo, s.area, it.descricao, it.solicitada, it.atendida, ITEM_STATUS_LABEL[it.status], it.observacao ?? ""], { mono: [0], zebra: z++ % 2 === 1 });
      }
    }
    ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
    ws2.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ATA-${ev.codigo}-${ata.versao ? `v${ata.versao}` : "em-construcao"}.xlsx"`,
    },
  });
}
