import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { anexos, projetos } from "@/server/db/schema";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { impressao, textoSeguro } from "@/server/export/excel";
import { montarOsEstrutura, type OsEstrutura } from "@/server/export/os-estrutura";
import { lerArquivo } from "@/server/armazenamento";

/*
 * OS de estrutura no modelo da planilha da cenografia: TOTAL (blocos lado a lado), SOMATÓRIA
 * (peça × projeto) e uma aba por projeto "Nome (NX)". Os dados vêm de `montarOsEstrutura`, sobre o
 * mesmo conteúdo de OS da rota /excel; aqui só se desenha. Totais em fórmula (SUM) com o resultado
 * já gravado, para abrir certo mesmo em visualizadores que não recalculam.
 */

const AZUL = "FF00B0F0";
const AMARELO = "FFFFFF00";
const AMARELO_TOTAL = "FFF0EA00";
const CINZA = "FFF2F2F2";
const FINO = { style: "thin" as const, color: { argb: "FF808080" } };
const BORDA: Partial<ExcelJS.Borders> = { top: FINO, left: FINO, bottom: FINO, right: FINO };

type Valor = string | number | null | { formula: string; result: number };
type Imagem = { buffer: Buffer; extension: "png" | "jpeg"; largura: number; altura: number };

const letra = (ws: ExcelJS.Worksheet, col: number) => ws.getColumn(col).letter;
const ehNumero = (v: Valor) => typeof v === "number" || (v !== null && typeof v === "object");

function escrever(ws: ExcelJS.Worksheet, r: number, c: number, v: Valor, fmt: { fill?: string; bold?: boolean; centro?: boolean; italico?: boolean } = {}) {
  const cell = ws.getCell(r, c);
  // Texto sempre por textoSeguro: nome de projeto, local e item avulso vêm do usuário.
  cell.value = typeof v === "string" ? textoSeguro(v) : v;
  cell.border = BORDA;
  cell.font = { size: 10, bold: fmt.bold, italic: fmt.italico };
  if (fmt.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fmt.fill } };
  cell.alignment = { vertical: "middle", horizontal: ehNumero(v) || fmt.centro ? "center" : "left", wrapText: !ehNumero(v) };
  if (ehNumero(v)) cell.numFmt = "#,##0";
}

/**
 * Bloco no estilo da planilha: cabeçalho azul, bordas finas e, se pedido, linha TOTAL amarela com
 * SUM nas colunas indicadas (índices dentro do bloco). Retorna a próxima linha livre (com 1 de folga).
 */
function bloco(ws: ExcelJS.Worksheet, linha: number, col: number, cab: string[], linhas: Valor[][], total?: { rotulo: string; colunas: number[] }) {
  cab.forEach((h, i) => escrever(ws, linha, col + i, h, { fill: AZUL, bold: true, centro: i > 0 }));
  const corpo: Valor[][] = linhas.length ? linhas : [["—", ...cab.slice(1).map(() => null)]];
  corpo.forEach((row, k) => row.forEach((v, i) => escrever(ws, linha + 1 + k, col + i, v, i === 0 ? {} : { centro: true })));
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
  return fim + 2;
}

function faixa(ws: ExcelJS.Worksheet, linha: number, de: number, ate: number, texto: string, cor: string) {
  for (let c = de; c <= ate; c++) ws.getCell(linha, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } };
  ws.mergeCells(linha, de, linha, ate);
  const cell = ws.getCell(linha, de);
  cell.value = texto;
  cell.font = { bold: true, size: 16 };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(linha).height = 30;
}

type Evento = Awaited<ReturnType<typeof obterEvento>>;

function abaTotal(wb: ExcelJS.Workbook, ev: Evento, d: OsEstrutura, versao: string, geradaPor: string) {
  const colTenda = 9; // I
  const maxTenda = d.tendas.reduce((a, t) => Math.max(a, t.colunas.length), 0);
  const ultima = d.tendas.length ? colTenda + 1 + maxTenda : 7;
  const ws = wb.addWorksheet("TOTAL", { views: [{ state: "frozen", ySplit: 7, showGridLines: false }] });
  [2, 40, 9, 3, 14, 40, 9, 3, 24].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = colTenda + 1; c <= ultima; c++) ws.getColumn(c).width = 13;

  faixa(ws, 1, 2, ultima, "O.S. DE ESTRUTURAS", AZUL);
  const cabecalho: Array<[string, string]> = [
    ["EVENTO", `${ev.nome} (${ev.codigo})`],
    ["CLIENTE", ev.cliente || "—"],
    ["DATA DA PROVA", formatarPeriodo(ev.dataInicio, ev.dataFim)],
    ["LOCAL", ev.local || "—"],
    ["RESPONSÁVEL PELA O.S.", ev.responsavel.nome],
    ["VERSÃO DA OS", `${versao} · gerada em ${formatarDataHora(new Date())} por ${geradaPor}`],
  ];
  cabecalho.forEach(([k, v], i) => {
    const r = 2 + i;
    escrever(ws, r, 2, k, { bold: true, fill: CINZA });
    ws.mergeCells(r, 3, r, 7);
    escrever(ws, r, 3, v, { bold: i === 0 });
    ws.getRow(r).height = 18;
  });

  // Coluna B–C: estruturas (projetos) e outros materiais.
  let lb = 9;
  lb = bloco(ws, lb, 2, ["ESTRUTURAS", "QTDE"], d.estruturas.map((p) => [p.nome, p.quantidade]), { rotulo: "TOTAL", colunas: [1] });
  if (d.outros.length) {
    lb = bloco(
      ws,
      lb,
      2,
      ["OUTROS MATERIAIS", "QTDE"],
      d.outros.map((o) => [`${o.descricao}${o.local ? ` — ${o.local}` : ""}${o.tipo === "peca" ? " (peça solta)" : ""}`, o.quantidade]),
      { rotulo: "TOTAL", colunas: [1] },
    );
  }

  // Coluna E–G: peças (estrutura, tendas, arena), marcenaria e total geral.
  let le = 9;
  const iniPecas = le;
  le = bloco(ws, le, 5, ["CÓDIGO", "PEÇA", "QTDE"], d.pecas.map((p) => [p.codigo, p.nome, p.total]), { rotulo: d.marcenaria.length ? "TOTAL" : "TOTAL GERAL", colunas: [2] });
  if (d.marcenaria.length) {
    const totPecas = iniPecas + Math.max(1, d.pecas.length) + 1;
    const iniMarc = le;
    le = bloco(ws, le, 5, ["CÓDIGO", "MARCENARIA", "QTDE"], d.marcenaria.map((p) => [p.codigo, p.nome, p.total]), { rotulo: "TOTAL", colunas: [2] });
    const totMarc = iniMarc + d.marcenaria.length + 1;
    escrever(ws, le, 5, "TOTAL GERAL", { fill: AMARELO_TOTAL, bold: true });
    escrever(ws, le, 6, "todas as peças da OS", { fill: AMARELO_TOTAL, italico: true });
    escrever(ws, le, 7, { formula: `G${totPecas}+G${totMarc}`, result: d.totalPecas }, { fill: AMARELO_TOTAL, bold: true });
    le += 2;
  }

  // Coluna I em diante: tendas por tamanho, uma linha por local.
  let li = 9;
  for (const t of d.tendas) {
    const cab = [t.titulo, "QTDE", ...t.colunas.map((c) => c.rotulo.toUpperCase())];
    const linhas: Valor[][] = t.linhas.map((l) => [l.local, l.quantidade, ...l.valores]);
    li = bloco(ws, li, colTenda, cab, linhas, { rotulo: "TOTAL", colunas: cab.slice(1).map((_, i) => i + 1) });
  }
  if (d.semProjetos) {
    ws.getCell(Math.max(lb, le, li), 2).value = "Versão gravada antes da visão por projeto: estruturas e tendas não aparecem separadas. Abra a versão atual.";
    ws.getCell(Math.max(lb, le, li), 2).font = { italic: true, size: 9 };
  }
  return ws;
}

function abaSomatoria(wb: ExcelJS.Workbook, d: OsEstrutura) {
  const ws = wb.addWorksheet("SOMATÓRIA", { views: [{ state: "frozen", xSplit: 3, ySplit: 4, showGridLines: false }] });
  const projs = d.somatoria.projetos;
  const colExtras = 4 + projs.length;
  const colTotal = colExtras + 1;
  [2, 14, 38].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = 4; c <= colTotal; c++) ws.getColumn(c).width = c >= colExtras ? 11 : 15;
  faixa(ws, 1, 2, colTotal, "SOMATÓRIA — PEÇA × PROJETO", AMARELO);
  ws.getCell(2, 2).value = d.semProjetos
    ? "Versão gravada antes da visão por projeto: tudo aparece em EXTRAS."
    : "Quantidade de cada peça em cada projeto (por unidade × quantidade do projeto). EXTRAS = peças pedidas soltas, fora de projeto.";
  ws.getCell(2, 2).font = { italic: true, size: 9 };
  ws.mergeCells(2, 2, 2, colTotal);

  const cab = ["CÓDIGO", "PEÇA", ...projs.map((p) => `${p.nome} (${p.quantidade}X)`), "EXTRAS", "TOTAL"];
  cab.forEach((h, i) => escrever(ws, 4, 2 + i, h, { fill: 2 + i === colTotal ? AMARELO_TOTAL : AMARELO, bold: true, centro: i > 1 }));
  ws.getRow(4).height = 48;
  const ini = 5;
  const L = (c: number) => letra(ws, c);
  d.somatoria.linhas.forEach((l, k) => {
    const r = ini + k;
    escrever(ws, r, 2, l.codigo);
    escrever(ws, r, 3, l.nome);
    l.porProjeto.forEach((v, j) => escrever(ws, r, 4 + j, v || null, { centro: true }));
    escrever(ws, r, colExtras, l.extras || null, { centro: true });
    escrever(ws, r, colTotal, { formula: `SUM(${L(4)}${r}:${L(colExtras)}${r})`, result: l.total }, { fill: AMARELO_TOTAL, bold: true });
  });
  const fim = ini + Math.max(0, d.somatoria.linhas.length - 1);
  const rt = ini + d.somatoria.linhas.length;
  escrever(ws, rt, 2, "TOTAL", { fill: AMARELO, bold: true });
  escrever(ws, rt, 3, null, { fill: AMARELO });
  for (let c = 4; c <= colTotal; c++) {
    const soma = c === colTotal ? d.totalPecas : c === colExtras ? d.somatoria.linhas.reduce((a, l) => a + l.extras, 0) : d.somatoria.linhas.reduce((a, l) => a + l.porProjeto[c - 4], 0);
    escrever(ws, rt, c, d.somatoria.linhas.length ? { formula: `SUM(${L(c)}${ini}:${L(c)}${fim})`, result: soma } : 0, { fill: c === colTotal ? AMARELO_TOTAL : AMARELO, bold: true });
  }
  return ws;
}

function abaProjeto(wb: ExcelJS.Workbook, a: OsEstrutura["abas"][number], imagem: Imagem | undefined) {
  const ws = wb.addWorksheet(a.nomeAba, { views: [{ state: "frozen", ySplit: 6, showGridLines: false }] });
  [2, 40, 14, 11, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  escrever(ws, 2, 2, "ESTRUTURA", { fill: AZUL, bold: true });
  ws.mergeCells(2, 2, 2, 3);
  escrever(ws, 2, 4, "QTDE", { fill: AZUL, bold: true, centro: true });
  escrever(ws, 3, 2, a.nome, { bold: true });
  ws.mergeCells(3, 2, 3, 3);
  escrever(ws, 3, 4, a.quantidade, { bold: true });
  ws.getCell(4, 2).value = textoSeguro(`Locais: ${a.locais.map((l) => `${l.local} (${l.quantidade})`).join(" · ")}`);
  ws.getCell(4, 2).font = { italic: true, size: 9 };
  ws.getCell(4, 2).alignment = { wrapText: true, vertical: "top" };
  ws.mergeCells(4, 2, 4, 5);
  ws.getRow(4).height = 28;

  ["PEÇA", "CÓDIGO", "POR UNID.", `TOTAL (×${a.quantidade})`].forEach((h, i) => escrever(ws, 6, 2 + i, h, { fill: AZUL, bold: true, centro: i > 0 }));
  a.pecas.forEach((p, k) => {
    const r = 7 + k;
    escrever(ws, r, 2, p.nome);
    escrever(ws, r, 3, p.codigo);
    escrever(ws, r, 4, p.porUnidade ?? "varia", { centro: true });
    escrever(ws, r, 5, p.porUnidade !== null ? { formula: `D${r}*$D$3`, result: p.total } : p.total);
  });
  const fim = 6 + Math.max(1, a.pecas.length);
  const rt = fim + 1;
  escrever(ws, rt, 2, "TOTAL", { fill: AMARELO, bold: true });
  escrever(ws, rt, 3, null, { fill: AMARELO });
  escrever(ws, rt, 4, a.varia ? null : { formula: `SUM(D7:D${fim})`, result: a.pecas.reduce((s, p) => s + (p.porUnidade ?? 0), 0) }, { fill: AMARELO, bold: true });
  escrever(ws, rt, 5, { formula: `SUM(E7:E${fim})`, result: a.pecas.reduce((s, p) => s + p.total, 0) }, { fill: AMARELO, bold: true });
  if (a.varia) {
    ws.getCell(rt + 2, 2).value = "“varia”: a quantidade por unidade muda entre os locais (ajustes da solicitação, ex.: fechamentos). O TOTAL já soma cada local.";
    ws.getCell(rt + 2, 2).font = { italic: true, size: 9 };
    ws.getCell(rt + 2, 2).alignment = { wrapText: true };
    ws.mergeCells(rt + 2, 2, rt + 2, 5);
    ws.getRow(rt + 2).height = 28;
  }
  if (imagem) {
    const id = wb.addImage({ buffer: imagem.buffer as unknown as ExcelJS.Buffer, extension: imagem.extension });
    const largura = Math.min(560, imagem.largura);
    ws.addImage(id, { tl: { col: 6, row: 1 }, ext: { width: largura, height: Math.round((largura * imagem.altura) / imagem.largura) } });
  }
  return ws;
}

/** Largura da imagem gravada na planilha: a aba mostra no máximo 560 px, então 800 px sobra. */
const LARGURA_IMAGEM = 800;
/**
 * Imagens já reduzidas, por id do anexo (null = ilegível). Anexo não é editado, só incluído e removido:
 * o id identifica o conteúdo para sempre. Exportar de novo não relê o original do banco nem refaz o sharp.
 */
const imagensProntas = new Map<string, Imagem | null>();
/** Uma por projeto com capa (o catálogo tem algumas dezenas); limita a memória da instância. */
const MAX_IMAGENS = 80;

function guardarImagem(id: string, imagem: Imagem | null) {
  if (imagensProntas.size >= MAX_IMAGENS) imagensProntas.delete(imagensProntas.keys().next().value as string);
  imagensProntas.set(id, imagem);
}

/** Primeira imagem anexada de cada projeto (a capa), só PNG/JPEG, reduzida para não pesar a pasta. */
async function imagensDosProjetos(codigos: string[]): Promise<Map<string, Imagem>> {
  const out = new Map<string, Imagem>();
  if (codigos.length === 0) return out;
  const db = await getDb();
  const projs = await db.select({ id: projetos.id, codigo: projetos.codigo }).from(projetos).where(inArray(projetos.codigo, codigos));
  if (projs.length === 0) return out;
  const metas = await db
    .select({ id: anexos.id, projetoId: anexos.projetoId, mime: anexos.mime })
    .from(anexos)
    .where(and(inArray(anexos.projetoId, projs.map((p) => p.id)), eq(anexos.tipo, "IMAGEM")))
    .orderBy(asc(anexos.criadoEm));
  const capa = new Map<string, { id: string; mime: string }>();
  for (const m of metas) if (!capa.has(m.projetoId)) capa.set(m.projetoId, m);
  const escolhidas = [...capa.entries()].filter(([, m]) => m.mime === "image/png" || m.mime === "image/jpeg");
  if (escolhidas.length === 0) return out;
  // Só os originais que ainda não foram reduzidos nesta instância vêm do banco.
  const faltam = escolhidas.map(([, m]) => m.id).filter((id) => !imagensProntas.has(id));
  const conteudos = faltam.length ? await db.select({ id: anexos.id, conteudo: anexos.conteudo }).from(anexos).where(inArray(anexos.id, faltam)) : [];
  const conteudoDe = new Map(conteudos.map((c) => [c.id, c.conteudo]));
  for (const [projetoId, m] of escolhidas) {
    const codigo = projs.find((p) => p.id === projetoId)?.codigo;
    if (!codigo) continue;
    if (imagensProntas.has(m.id)) {
      const pronta = imagensProntas.get(m.id);
      if (pronta) out.set(codigo, pronta);
      continue;
    }
    const valor = conteudoDe.get(m.id);
    if (!valor) continue;
    try {
      // O valor pode ser o arquivo (banco) ou a referência ao Object Storage.
      const bruto = await lerArquivo(valor);
      const base = sharp(new Uint8Array(bruto)).rotate().resize({ width: LARGURA_IMAGEM, withoutEnlargement: true });
      const extension = m.mime === "image/png" ? "png" : "jpeg";
      const { data, info } = await (extension === "png" ? base.png() : base.jpeg({ quality: 82 })).toBuffer({ resolveWithObject: true });
      const imagem: Imagem = { buffer: data, extension, largura: info.width, altura: info.height };
      guardarImagem(m.id, imagem);
      out.set(codigo, imagem);
    } catch {
      // Imagem ilegível: a aba sai sem o desenho (e não se tenta de novo a cada exportação).
      guardarImagem(m.id, null);
    }
  }
  return out;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  let ev: Evento;
  try {
    ev = await obterEvento(usuario, id);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return NextResponse.json({ erro: "Evento não encontrado" }, { status: 404 });
    throw e;
  }
  // Mesma escolha de versão da rota /excel: ?v= pede uma versão; sem ela, a OS calculada da ata atual.
  const v = Number(new URL(request.url).searchParams.get("v"));
  const versoes = await listarOsResumo(id);
  const pedida = Number.isInteger(v) && v > 0 ? versoes.find((x) => x.numero === v) : undefined;
  const gravado = pedida ? (await obterConteudosOs(id, [pedida.numero])).get(pedida.numero) : undefined;
  const ehAtual = pedida && versoes[0]?.numero === pedida.numero;
  const os = gravado && (gravado.projetos || !ehAtual) ? gravado : await calcularOsAtual(await getDb(), id);
  const rotulo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero} (atual)` : "prévia";

  const dados = montarOsEstrutura(os);
  // Desenho do projeto só para quem pode ver projetos (mesma regra do /api/anexos).
  const imagens = pode(usuario, "projeto.ver") ? await imagensDosProjetos(dados.abas.map((a) => a.codigo)) : new Map<string, Imagem>();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  // O exceljs não grava resultado 0 em cache: recalcular ao abrir evita total vazio em coluna zerada.
  wb.calcProperties.fullCalcOnLoad = true;
  // Cabeçalho/rodapé de impressão: "&" é código de formatação do Excel; nome digitado vira "&&" (literal).
  const hf = (t: string) => t.replace(/&/g, "&&");
  const cab = hf(`OS de estrutura · ${ev.codigo} · ${ev.nome} · ${rotulo}`);
  const rodape = hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`);
  impressao(abaTotal(wb, ev, dados, rotulo, usuario.nome), cab, rodape, undefined, true);
  impressao(abaSomatoria(wb, dados), `${cab} · SOMATÓRIA`, rodape, 4, true);
  for (const a of dados.abas) impressao(abaProjeto(wb, a, imagens.get(a.codigo)), `${cab} · ${hf(a.nome)}`, rodape, 6, true);

  const buffer = await wb.xlsx.writeBuffer();
  const sufixo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa";
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="OS-ESTRUTURA-${ev.codigo}-${sufixo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
