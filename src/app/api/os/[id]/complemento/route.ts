import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterEvento } from "@/server/services/eventos";
import { complementoOs } from "@/server/services/os";
import { NaoEncontradoError } from "@/domain/errors";
import { SETOR_LABEL } from "@/domain/os";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";
import { blocoDados, faixaTitulo, impressao, tabela, tituloSecao } from "@/server/export/excel";

/**
 * Complemento da OS: só o que mudou desde a versão que foi enviada ao carregamento.
 * Serve para mandar ao galpão um "adendo" sem reimprimir a OS inteira.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  let ev: Awaited<ReturnType<typeof obterEvento>>;
  try {
    ev = await obterEvento(usuario, id);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return NextResponse.json({ erro: "Evento não encontrado" }, { status: 404 });
    throw e;
  }
  const comp = await complementoOs(id);
  if (!comp) return NextResponse.json({ erro: "A OS ainda não foi marcada como enviada ao carregamento." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  const ws = wb.addWorksheet("Complemento", { views: [{ state: "frozen", ySplit: 9, showGridLines: false }] });
  const cab = `Complemento da OS ${ev.codigo} · ${ev.nome} · desde a v${comp.numero}`;
  faixaTitulo(ws, 7, "NORTE MKT", "Complemento da OS", `${ev.codigo} · ${ev.nome} · o que mudou desde a v${comp.numero}, enviada em ${formatarDataHora(comp.enviadaEm)}`);
  let l = 4;
  l = blocoDados(ws, l, 1, [
    ["Evento", `${ev.codigo} · ${ev.nome}`],
    ["Período", formatarPeriodo(ev.dataInicio, ev.dataFim)],
    ["OS enviada", `v${comp.numero} · ${formatarDataHora(comp.enviadaEm)}${comp.enviadaPor ? ` · ${comp.enviadaPor}` : ""}`],
    ["Gerado", `${formatarDataHora(new Date())} · ${usuario.nome}`],
  ]);
  l += 1;

  const mais = comp.diff.filter((d) => d.depois > d.antes);
  const menos = comp.diff.filter((d) => d.depois < d.antes);
  l = tituloSecao(ws, l, 7, "Peças a mais (embarcam além da OS enviada)", mais.length ? "Some estas quantidades à OS que já está no galpão." : "Nada a acrescentar.");
  l = tabela(
    ws,
    "ComplementoMais",
    l,
    [
      { nome: "Setor", largura: 16 },
      { nome: "Código", largura: 14, mono: true },
      { nome: "Peça", largura: 42 },
      { nome: "Na OS enviada", largura: 14, numero: true },
      { nome: "Agora", largura: 12, numero: true },
      { nome: "A mais", largura: 12, numero: true, total: "sum" },
      { nome: "Separado", largura: 12 },
    ],
    mais.map((d) => [SETOR_LABEL[d.setor], d.codigo, d.nome, d.antes, d.depois, d.depois - d.antes, "☐"]),
  );
  l += 1;
  l = tituloSecao(ws, l, 7, "Peças a menos (não embarcam mais)", menos.length ? "Retire estas quantidades da OS enviada." : "Nada a retirar.");
  l = tabela(
    ws,
    "ComplementoMenos",
    l,
    [
      { nome: "Setor", largura: 16 },
      { nome: "Código", largura: 14, mono: true },
      { nome: "Peça", largura: 42 },
      { nome: "Na OS enviada", largura: 14, numero: true },
      { nome: "Agora", largura: 12, numero: true },
      { nome: "A menos", largura: 12, numero: true, total: "sum" },
      { nome: "Retirado", largura: 12 },
    ],
    menos.map((d) => [SETOR_LABEL[d.setor], d.codigo, d.nome, d.antes, d.depois, d.antes - d.depois, "☐"]),
  );
  if (comp.avulsosNovos.length > 0) {
    l += 1;
    l = tituloSecao(ws, l, 7, "Itens fora do catálogo que entraram depois", "Separação manual: não somam por peça.");
    l = tabela(
      ws,
      "ComplementoAvulsos",
      l,
      [
        { nome: "Item", largura: 44 },
        { nome: "Qtd.", largura: 10, numero: true },
        { nome: "Destino", largura: 24 },
        { nome: "Área", largura: 18 },
      ],
      comp.avulsosNovos.map((a) => [a.descricao, a.quantidade, a.destino ?? "—", a.area ?? "Logística"]),
    );
  }
  impressao(ws, cab, `Separado por: ______________   Conferido por: ______________   Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`, 9);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="complemento-os-${ev.codigo.toLowerCase()}-desde-v${comp.numero}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
