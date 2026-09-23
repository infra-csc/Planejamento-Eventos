import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETOR_LABEL } from "@/domain/os";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import type { OsConteudo } from "@/server/db/schema";
import { blocoDados, CHECK, COR, faixaTitulo, impressao, tabela, tituloSecao } from "@/server/export/excel";
import { NaoEncontradoError } from "@/domain/errors";

/*
 * OS completa em Excel: capa com resumo e, em abas, tudo que vai no caminhão nas três leituras da tela
 * (totais por peça, por projeto, peças soltas) mais os itens avulsos. Tabelas nativas do Excel:
 * filtros, listras, linha de totais com fórmula e coluna de separação para marcar no galpão.
 */

function montarPastaOs(ev: { codigo: string; nome: string; cliente: string | null; local: string | null; dataInicio: string; dataFim: string; dataReuniao: Date; responsavel: { nome: string } }, os: OsConteudo, versao: string, geradaPor: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  const cab = `OS ${ev.codigo} · ${ev.nome} · ${versao}`;
  const rodape = `Separado por: ______________   Conferido por: ______________   Gerado ${formatarDataHora(new Date())} por ${geradaPor}`;

  const totalUnidades = os.setores.reduce((a, s) => a + s.linhas.reduce((b, x) => b + x.total, 0), 0);
  const tiposPeca = os.setores.reduce((a, s) => a + s.linhas.length, 0);

  /* ---------- Resumo ---------- */
  const capa = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  [24, 30, 14, 14, 24, 30].forEach((w, i) => (capa.getColumn(i + 1).width = w));
  let l = faixaTitulo(capa, 6, "NORTE MKT · PLANEJAMENTO DE EVENTOS", `Ordem de Serviço · ${ev.codigo}`, `${ev.nome} · ${versao}`);
  const fimEsq = blocoDados(
    capa,
    l,
    1,
    [
      ["Evento", ev.nome],
      ["Cliente", ev.cliente || "—"],
      ["Local", ev.local || "—"],
      ["Data do evento", formatarPeriodo(ev.dataInicio, ev.dataFim)],
      ["Reunião de OS", formatarDataHora(ev.dataReuniao)],
      ["Responsável", ev.responsavel.nome],
    ],
    2,
  );
  const fimDir = blocoDados(
    capa,
    l,
    5,
    [
      ["Versão da OS", versao],
      ["Gerado em", formatarDataHora(new Date())],
      ["Gerado por", geradaPor],
      ["Projetos padrão", os.projetos?.length ?? 0],
      ["Tipos de peça", tiposPeca],
      ["Unidades no total", totalUnidades],
    ],
    1,
  );
  l = Math.max(fimEsq, fimDir) + 1;

  l = tituloSecao(capa, l, 6, "Resumo por setor", "Quantas peças de cada setor vão no caminhão.");
  const porSetor = os.setores.map((s) => [SETOR_LABEL[s.setor], s.linhas.length, s.linhas.reduce((a, x) => a + x.total, 0)] as Array<string | number>);
  l = tabela(
    capa,
    "ResumoSetor",
    l,
    [
      { nome: "Setor", largura: 24, rotuloTotal: "Total" },
      { nome: "Tipos de peça", largura: 30, numero: true, total: "sum" },
      { nome: "Unidades", largura: 14, numero: true, total: "sum" },
    ],
    porSetor,
  );
  l += 1;

  l = tituloSecao(capa, l, 6, "Como usar esta pasta");
  const guia = [
    ["Totais por peça", "Para carregar o caminhão: cada peça uma vez, com o total somado de todos os projetos e pedidos."],
    ["Por projeto", "Para montar: o que cada projeto padrão leva, unidade por unidade, já com os ajustes."],
    ["Peças soltas", "Peças pedidas fora de projeto (também somadas em Totais por peça)."],
    ["Itens avulsos", "Itens sem peça de catálogo: separação manual, não somam por peça."],
    ["Coluna Sep.", `Marque ${CHECK} conforme separar. Os filtros de cada tabela ajudam a trabalhar por setor.`],
  ];
  for (const [k, v] of guia) {
    capa.getCell(l, 1).value = k;
    capa.getCell(l, 1).font = { bold: true, size: 10 };
    capa.getCell(l, 2).value = v;
    capa.getCell(l, 2).font = { size: 10, color: { argb: COR.texto2 } };
    capa.getCell(l, 2).alignment = { wrapText: true, vertical: "top" };
    capa.mergeCells(l, 2, l, 6);
    l++;
  }
  capa.getCell(l + 1, 1).value = "A OS nunca é editada à mão: toda mudança vem de uma solicitação respondida ou de um ajuste da logística com justificativa, e gera nova versão.";
  capa.getCell(l + 1, 1).font = { size: 9, italic: true, color: { argb: COR.texto2 } };
  capa.mergeCells(l + 1, 1, l + 1, 6);
  impressao(capa, cab, rodape);

  /* ---------- Totais por peça ---------- */
  const tot = wb.addWorksheet("Totais por peça", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  faixaTitulo(tot, 7, "NORTE MKT", "Totais por peça", `${cab} · carregar o caminhão`);
  const linhasTot = os.setores.flatMap((s) => s.linhas.map((x) => [SETOR_LABEL[s.setor], x.codigo, x.nome, x.total, x.unidade, x.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · "), CHECK] as Array<string | number>));
  tabela(
    tot,
    "TotaisPorPeca",
    5,
    [
      { nome: "Setor", largura: 22, rotuloTotal: "Total geral" },
      { nome: "Código", largura: 14, mono: true },
      { nome: "Peça", largura: 44 },
      { nome: "Total", largura: 10, numero: true, total: "sum" },
      { nome: "Un.", largura: 6, alinhar: "center" },
      { nome: "Composição (de onde vem)", largura: 60 },
      { nome: "Sep.", largura: 6, alinhar: "center" },
    ],
    linhasTot,
  );
  impressao(tot, `${cab} · Totais por peça`, rodape, 5, true);

  /* ---------- Por projeto ---------- */
  const proj = wb.addWorksheet("Por projeto", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  faixaTitulo(proj, 11, "NORTE MKT", "Por projeto", `${cab} · montar`);
  const linhasProj = (os.projetos ?? []).flatMap((p) => p.pecas.map((x) => [p.nome, p.quantidade, p.destino ?? "—", p.area ?? "Logística", x.codigo, x.nome, SETOR_LABEL[x.setor], x.porUnidade, x.total, x.unidade, CHECK] as Array<string | number>));
  if (!os.projetos) {
    proj.getCell(5, 1).value = "Esta versão da OS foi gerada antes da visão por projeto. Abra a versão atual.";
    proj.mergeCells(5, 1, 5, 11);
  } else {
    tabela(
      proj,
      "PorProjeto",
      5,
      [
        { nome: "Projeto", largura: 32, rotuloTotal: "Total geral" },
        { nome: "Qtd. projeto", largura: 11, numero: true },
        { nome: "Destino", largura: 24 },
        { nome: "Área", largura: 16 },
        { nome: "Código", largura: 14, mono: true },
        { nome: "Peça", largura: 40 },
        { nome: "Setor", largura: 22 },
        { nome: "Por unidade", largura: 11, numero: true },
        { nome: "Total", largura: 10, numero: true, total: "sum" },
        { nome: "Un.", largura: 6, alinhar: "center" },
        { nome: "Sep.", largura: 6, alinhar: "center" },
      ],
      linhasProj,
    );
  }
  impressao(proj, `${cab} · Por projeto`, rodape, 5, true);

  /* ---------- Peças soltas ---------- */
  const solt = wb.addWorksheet("Peças soltas", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  faixaTitulo(solt, 8, "NORTE MKT", "Peças soltas", `${cab} · pedidas fora de projeto`);
  const linhasSolt = (os.individuais ?? []).map((x) => [x.codigo, x.nome, SETOR_LABEL[x.setor], x.quantidade, x.unidade, x.destino ?? "—", x.area ?? "—", CHECK] as Array<string | number>);
  tabela(
    solt,
    "PecasSoltas",
    5,
    [
      { nome: "Código", largura: 14, mono: true, rotuloTotal: "Total" },
      { nome: "Peça", largura: 44 },
      { nome: "Setor", largura: 22 },
      { nome: "Qtd.", largura: 10, numero: true, total: "sum" },
      { nome: "Un.", largura: 6, alinhar: "center" },
      { nome: "Destino", largura: 26 },
      { nome: "Área", largura: 18 },
      { nome: "Sep.", largura: 6, alinhar: "center" },
    ],
    linhasSolt,
  );
  impressao(solt, `${cab} · Peças soltas`, rodape, 5, true);

  /* ---------- Itens avulsos ---------- */
  const av = wb.addWorksheet("Itens avulsos", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  faixaTitulo(av, 5, "NORTE MKT", "Itens avulsos", `${cab} · sem peça de catálogo, separação manual`);
  tabela(
    av,
    "ItensAvulsos",
    5,
    [
      { nome: "Descrição", largura: 50, rotuloTotal: "Total" },
      { nome: "Qtd.", largura: 10, numero: true, total: "sum" },
      { nome: "Destino", largura: 26 },
      { nome: "Área", largura: 18 },
      { nome: "Sep.", largura: 6, alinhar: "center" },
    ],
    os.semSetor.map((x) => [x.descricao, x.quantidade, x.destino ?? "—", x.area ?? "—", CHECK]),
  );
  impressao(av, `${cab} · Itens avulsos`, rodape, 5);

  return wb;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  // Evento inexistente (link antigo, id digitado): 404 em vez de página de erro.
  const ev = await obterEvento(usuario, id).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) return null;
    throw e;
  });
  if (!ev) return NextResponse.json({ erro: "Evento não encontrado" }, { status: 404 });
  const v = Number(new URL(request.url).searchParams.get("v"));
  const versoes = await listarOsResumo(id);
  const pedida = Number.isInteger(v) && v > 0 ? versoes.find((x) => x.numero === v) : undefined;
  const gravado = pedida ? (await obterConteudosOs(id, [pedida.numero])).get(pedida.numero) : undefined;
  // Sem versão pedida (ou versão atual gravada antes das visões novas): calcula da ata atual.
  const ehAtual = pedida && versoes[0]?.numero === pedida.numero;
  const os = gravado && (gravado.projetos || !ehAtual) ? gravado : await calcularOsAtual(await getDb(), id);
  const rotulo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero} (atual)` : "prévia";
  const wb = montarPastaOs(ev, os, rotulo, usuario.nome);
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="OS-${ev.codigo}-${pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa"}.xlsx"`,
    },
  });
}
