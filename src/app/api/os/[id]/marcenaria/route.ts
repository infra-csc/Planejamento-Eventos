import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { inArray } from "drizzle-orm";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { pecas, projetos } from "@/server/db/schema";
import { formatarDataHora } from "@/lib/format";
import { impressao } from "@/server/export/excel";
import { montarOsMarcenaria } from "@/server/export/os-marcenaria";
import { abaOsMarcenaria } from "@/server/export/os-marcenaria-xlsx";

/*
 * OS de marcenaria no modelo da planilha da cenografia (OS CENO MARCENARIA_<evento>.xlsx): aba O.S
 * com o cabeçalho (evento, data da carga, responsáveis) e as seções ESTANDES, PALCO, TENDAS, MESAS,
 * ATIVAÇÃO, ITENS ESPECÍFICOS DA PROVA e GERAL, cada uma com ITEM | PEÇAS | QUANTIDADE |
 * REFERENCIA | OBSERVAÇÃO. Os dados vêm de `montarOsMarcenaria`, sobre o mesmo conteúdo de OS das
 * outras rotas.
 */

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const db = await getDb();
  const v = Number(new URL(request.url).searchParams.get("v"));
  const versoes = await listarOsResumo(id);
  const pedida = Number.isInteger(v) && v > 0 ? versoes.find((x) => x.numero === v) : undefined;
  const gravado = pedida ? (await obterConteudosOs(id, [pedida.numero])).get(pedida.numero) : undefined;
  const ehAtual = pedida && versoes[0]?.numero === pedida.numero;
  const os = gravado && (gravado.projetos || !ehAtual) ? gravado : await calcularOsAtual(db, id);
  const rotulo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero} (atual)` : "prévia";

  // Seção de cada projeto vem da categoria do catálogo; a das peças soltas, da família.
  const codigosProj = [...new Set((os.projetos ?? []).map((p) => p.codigo))];
  const codigosPecas = [...new Set((os.individuais ?? []).map((p) => p.codigo))];
  const [cats, fams] = await Promise.all([
    codigosProj.length ? db.select({ codigo: projetos.codigo, categoria: projetos.categoria }).from(projetos).where(inArray(projetos.codigo, codigosProj)) : [],
    codigosPecas.length ? db.select({ codigo: pecas.codigo, familia: pecas.familia }).from(pecas).where(inArray(pecas.codigo, codigosPecas)) : [],
  ]);
  const d = montarOsMarcenaria(os, new Map(cats.map((c) => [c.codigo, c.categoria])), new Map(fams.map((f) => [f.codigo, f.familia])));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  const ws = abaOsMarcenaria(wb, { nome: ev.nome, dataCarga: ev.dataCarga, responsavelEvento: ev.responsavel.nome }, d);

  const hf = (t: string) => t.replace(/&/g, "&&");
  impressao(ws, hf(`OS de marcenaria · ${ev.codigo} · ${ev.nome} · ${rotulo}`), hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`), undefined, false);
  wb.calcProperties.fullCalcOnLoad = true;
  const buffer = await wb.xlsx.writeBuffer();
  const sufixo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa";
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="OS CENO MARCENARIA_${ev.nome.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").toUpperCase()}_${sufixo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
