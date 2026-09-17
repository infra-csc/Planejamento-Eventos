import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { montarAtaExport } from "@/server/export/ata";
import { ITEM_STATUS_LABEL } from "@/domain/solicitacao";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { blocoDados, COR, faixaTitulo, impressao, tabela, tituloSecao } from "@/server/export/excel";

/*
 * Ata da reunião de OS em Excel: cabeçalho com os campos da ata (reunião, presentes, público, carga),
 * as linhas conferidas item a item em tabela nativa (filtros, totais) e o que cada área pediu.
 */

const TIPO_LABEL = { PROJETO: "Projeto padrão", PECA: "Peça", AVULSO: "Fora do catálogo" } as const;

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
  const cab = `Ata ${ev.codigo} · ${ev.nome} · ${rotuloVersao}`;
  const rodape = `Logística: ______________________   Cliente/gestão: ______________________   Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();

  /* ---------- Ata ---------- */
  const ws = wb.addWorksheet("Ata", { views: [{ showGridLines: false }] });
  [22, 30, 10, 22, 22, 22, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let l = faixaTitulo(ws, 7, "NORTE MKT · PLANEJAMENTO DE EVENTOS", `Ata da reunião de OS · ${ev.codigo}`, `${ev.nome} · ${rotuloVersao}${reu?.fechadaEm ? ` · fechada em ${formatarDataHora(reu.fechadaEm)}` : " · ainda não fechada"}`);
  const fimEsq = blocoDados(
    ws,
    l,
    1,
    [
      ["Cliente", ev.cliente || "—"],
      ["Local", ev.local || "—"],
      ["Data do evento", formatarPeriodo(ev.dataInicio, ev.dataFim)],
      ["Público esperado", reu?.publicoEsperado != null ? reu.publicoEsperado.toLocaleString("pt-BR") : "—"],
      ["Caminhão carrega", reu?.caminhaoCarrega || "—"],
      ["Caminhão sai", reu?.caminhaoSai || "—"],
      ["Arena descarrega", reu?.arenaDescarrega || "—"],
      ["Kit descarrega", reu?.kitDescarrega || "—"],
    ],
    2,
  );
  const fimDir = blocoDados(
    ws,
    l,
    4,
    [
      ["Reunião marcada", formatarDataHora(ev.dataReuniao)],
      ["Iniciada", reu?.iniciadaEm ? formatarDataHora(reu.iniciadaEm) : "—"],
      ["Ata fechada", reu?.fechadaEm ? formatarDataHora(reu.fechadaEm) : "—"],
      ["Fechada por", reu?.fechadaPor || "—"],
      ["Conduzida por", reu?.conduzidaPor || ev.responsavel],
      ["Linhas conferidas", `${ata.linhas.filter((x) => x.conferidoPor).length} de ${ata.linhas.length}`],
    ],
    3,
  );
  l = Math.max(fimEsq, fimDir) + 1;

  ws.getCell(l, 1).value = "Pessoas presentes";
  ws.getCell(l, 1).font = { size: 10, color: { argb: COR.texto2 } };
  ws.getCell(l, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.claro } };
  ws.getCell(l, 1).alignment = { vertical: "top", indent: 1 };
  ws.getCell(l, 2).value = reu?.presentes?.trim() || "—";
  ws.getCell(l, 2).alignment = { wrapText: true, vertical: "top", indent: 1 };
  ws.mergeCells(l, 2, l, 7);
  ws.getRow(l).height = Math.max(20, Math.ceil((reu?.presentes?.length ?? 0) / 110) * 15 + 5);
  l += 2;

  l = tituloSecao(ws, l, 7, "O que vai para o evento", "Cada linha da ata: item, quantidade, destino, quem pediu e quem conferiu na reunião.");
  const linhaTabela = l;
  l = tabela(
    ws,
    "LinhasAta",
    l,
    [
      { nome: "Código", largura: 14, mono: true, rotuloTotal: "Total" },
      { nome: "Item", largura: 44 },
      { nome: "Qtd.", largura: 10, numero: true, total: "sum" },
      { nome: "Destino", largura: 24 },
      { nome: "Área", largura: 18 },
      { nome: "Origem", largura: 24 },
      { nome: "Conferido por", largura: 22 },
    ],
    ata.linhas.map((x) => [x.codigo ?? "", `${x.descricao.replace(/\s*\(v\d+\)$/, "")}${x.versao ? ` (v${x.versao})` : ""} · ${TIPO_LABEL[x.tipo]}`, x.quantidade, x.destino ?? "—", x.area ?? "Logística", x.origem, x.conferidoPor ? `☑ ${x.conferidoPor}` : "—"]),
  );
  l += 1;

  l = tituloSecao(ws, l, 7, "Observações da reunião");
  ws.getCell(l, 1).value = ata.observacoes?.trim() || "Nenhuma observação registrada.";
  ws.getCell(l, 1).alignment = { wrapText: true, vertical: "top" };
  ws.mergeCells(l, 1, l, 7);
  ws.getRow(l).height = Math.max(20, Math.ceil((ata.observacoes?.length ?? 0) / 120) * 15 + 5);
  l += 2;

  ws.getCell(l, 1).value = "Assinatura logística: ______________________________";
  ws.getCell(l, 4).value = "Assinatura cliente / gestão: ______________________________";
  ws.mergeCells(l, 1, l, 3);
  ws.mergeCells(l, 4, l, 7);
  impressao(ws, cab, rodape, linhaTabela, true);

  /* ---------- Pedidos das áreas ---------- */
  if (ata.solicitacoesPreReuniao.length > 0) {
    const ws2 = wb.addWorksheet("Pedidos das áreas", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
    faixaTitulo(ws2, 7, "NORTE MKT", "Pedidos das áreas", `${cab} · o que cada área enviou antes da reunião`);
    tabela(
      ws2,
      "PedidosAreas",
      5,
      [
        { nome: "Solicitação", largura: 14, mono: true, rotuloTotal: "Total" },
        { nome: "Área", largura: 18 },
        { nome: "Item", largura: 46 },
        { nome: "Pedido", largura: 10, numero: true, total: "sum" },
        { nome: "Na ata", largura: 10, numero: true, total: "sum" },
        { nome: "Situação", largura: 18 },
        { nome: "Observação da logística", largura: 50 },
      ],
      ata.solicitacoesPreReuniao.flatMap((s) => s.itens.map((it) => [s.codigo, s.area, it.descricao, it.solicitada, it.atendida, ITEM_STATUS_LABEL[it.status], it.observacao ?? ""])),
    );
    impressao(ws2, `${cab} · Pedidos das áreas`, rodape, 5, true);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ATA-${ev.codigo}-${ata.versao ? `v${ata.versao}` : "em-construcao"}.xlsx"`,
    },
  });
}
