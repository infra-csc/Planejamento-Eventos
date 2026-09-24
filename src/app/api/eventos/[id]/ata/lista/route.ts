import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { montarAtaExport } from "@/server/export/ata";
import { calcularOsAtual } from "@/server/services/os";
import { getDb } from "@/server/db";
import { formatarDataHora } from "@/lib/format";
import { impressao } from "@/server/export/excel";
import { montarAtaLista } from "@/server/export/ata-lista";
import { abaListaMateriais } from "@/server/export/ata-lista-xlsx";

/*
 * Ata no modelo da planilha da cenografia (ATA <evento>.xlsx, aba LISTA DE MATERIAIS): cabeçalho da
 * reunião (data, diretor, presentes, carga/descarga, público) e as seções PERCURSO, ESTRUTURA
 * (tendas por local e box truss), ATIVAÇÃO, ARENA e OBSERVACOES. As quantidades vêm da OS calculada
 * da ata atual; o cabeçalho, da versão pedida (?v=) ou da ata em construção.
 */

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  const v = Number(new URL(request.url).searchParams.get("v"));
  const ata = await montarAtaExport(usuario, id, Number.isInteger(v) && v > 0 ? v : undefined).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) return null;
    throw e;
  });
  if (!ata) return NextResponse.json({ erro: "Evento ou versão da ata não encontrados" }, { status: 404 });
  const os = await calcularOsAtual(await getDb(), id);
  const d = montarAtaLista(os);
  const ev = ata.evento;
  const reu = ata.reuniao;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = abaListaMateriais(
    wb,
    {
      nome: ev.nome,
      dataReuniao: ev.dataReuniao,
      diretor: ev.responsavel,
      presentes: reu?.presentes ?? null,
      caminhaoCarrega: reu?.caminhaoCarrega ?? null,
      caminhaoSai: reu?.caminhaoSai ?? null,
      arenaDescarrega: reu?.arenaDescarrega ?? null,
      kitDescarrega: reu?.kitDescarrega ?? null,
      dataEvento: ev.dataInicio,
      local: ev.local,
      publicoEsperado: reu?.publicoEsperado ?? null,
      observacoes: ata.observacoes,
    },
    d,
  );
  const rotulo = ata.versao ? `v${ata.versao}` : "em construção";
  const hf = (t: string) => t.replace(/&/g, "&&");
  impressao(ws, hf(`Ata ${ev.codigo} · ${ev.nome} · ${rotulo}`), hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`), undefined, false);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ATA ${ev.nome.replace(/[^\p{L}\p{N} _-]/gu, "").trim().toUpperCase()}${ata.versao ? ` v${ata.versao}` : ""}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
