import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { montarAtaExport } from "@/server/export/ata";
import { calcularOsAtual } from "@/server/services/os";
import { getDb } from "@/server/db";
import { osVersoes } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatarDataHora } from "@/lib/format";
import { impressao } from "@/server/export/excel";
import { montarAtaLista } from "@/server/export/ata-lista";
import { abaListaMateriais } from "@/server/export/ata-lista-xlsx";
import { contentDisposition } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";

/*
 * Ata no modelo da planilha da cenografia (ATA <evento>.xlsx, aba LISTA DE MATERIAIS): cabeçalho da
 * reunião (data, diretor, presentes, carga/descarga, público) e as seções PERCURSO, ESTRUTURA
 * (tendas por local e box truss), ATIVAÇÃO, ARENA e OBSERVACOES. As quantidades vêm da OS calculada
 * da ata atual; o cabeçalho, da versão pedida (?v=) ou da ata em construção.
 * Por isso o nome e o rodapé dizem de qual OS são as quantidades: antes diziam só "v1" (a versão da ata), e quem
 * comparava com o Excel da ata v1 achava itens que entraram depois (auditoria 30/10, B-02). Se a lista deve sair
 * congelada como a reunião decidiu, é decisão do time (a ata guarda as linhas, mas não as peças de cada projeto).
 */

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "os.exportar")) return erroDownload(request, 403, "Seu perfil não baixa a ata");
  const { id } = await params;
  const v = Number(new URL(request.url).searchParams.get("v"));
  const ata = await montarAtaExport(usuario, id, Number.isInteger(v) && v > 0 ? v : undefined).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) return null;
    throw e;
  });
  if (!ata) return erroDownload(request, 404, "Evento ou versão da ata não encontrados");
  const db = await getDb();
  const [os, [ultimaOs]] = await Promise.all([
    calcularOsAtual(db, id),
    db.select({ numero: osVersoes.numero }).from(osVersoes).where(eq(osVersoes.eventoId, id)).orderBy(desc(osVersoes.numero)).limit(1),
  ]);
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
  const quantidades = ultimaOs ? `quantidades da OS v${ultimaOs.numero}` : "quantidades de hoje";
  const rotulo = ata.versao ? `cabeçalho da ata v${ata.versao} · ${quantidades}` : `em construção · ${quantidades}`;
  const hf = (t: string) => t.replace(/&/g, "&&");
  impressao(ws, hf(`Ata ${ev.codigo} · ${ev.nome} · ${rotulo}`), hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`), undefined, false);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // Nome do modelo da cenografia (fica como a equipe espera), com o UTF-8 em filename* (auditoria 28/10, nº 180).
      "Content-Disposition": contentDisposition(`ATA ${ev.nome.replace(/[^\p{L}\p{N} _-]/gu, "").trim().toUpperCase()}${ultimaOs ? ` - lista OS v${ultimaOs.numero}` : " - lista atual"}.xlsx`),
      "Cache-Control": "no-store",
    },
  });
}
