import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { inArray } from "drizzle-orm";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { contentDisposition } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { pecas, projetos } from "@/server/db/schema";
import { formatarDataHora } from "@/lib/format";
import { impressao } from "@/server/export/excel";
import { montarOsMarcenaria } from "@/server/export/os-marcenaria";
import { abaOsMarcenaria } from "@/server/export/os-marcenaria-xlsx";
import { imagensDoCatalogo } from "@/server/export/imagens-os";

/** Miniatura gravada na planilha (a coluna mostra ~104 px; 240 px fica nítida no zoom e na impressão). */
const LARGURA_FOTO = 240;

/*
 * OS de marcenaria no modelo da planilha da cenografia (OS CENO MARCENARIA_<evento>.xlsx): aba O.S
 * com o cabeçalho (evento, data da carga, responsáveis) e as seções STANDS, PALCO, TENDAS, MESAS,
 * ATIVAÇÃO, ITENS ESPECÍFICOS DA PROVA e GERAL, cada uma com ITEM | PEÇAS | QUANTIDADE |
 * REFERENCIA | OBSERVAÇÃO. Os dados vêm de `montarOsMarcenaria`, sobre o mesmo conteúdo de OS das
 * outras rotas.
 */

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "os.exportar")) return erroDownload(request, 403, "Seu perfil não baixa a OS de marcenaria");
  const { id } = await params;
  let ev: Awaited<ReturnType<typeof obterEvento>>;
  try {
    ev = await obterEvento(usuario, id);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return erroDownload(request, 404, "Evento não encontrado");
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
  // Foto de cada peça (e do projeto, para a peça sem foto): mesma regra de quem vê projetos e catálogo.
  const refs = [...new Set(d.secoes.flatMap((s) => s.itens.flatMap((it) => it.pecas.map((p) => p.referencia))).filter((c): c is string => Boolean(c)))];
  const projs = [...new Set(d.secoes.flatMap((s) => s.itens.map((it) => it.projetoCodigo)).filter((c): c is string => Boolean(c)))];
  const [fotosPecas, fotosProjetos] = await Promise.all([
    pode(usuario, "catalogo.ver") ? imagensDoCatalogo("peca", refs, LARGURA_FOTO) : new Map(),
    pode(usuario, "projeto.ver") ? imagensDoCatalogo("projeto", projs, LARGURA_FOTO) : new Map(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  const ws = abaOsMarcenaria(wb, { nome: ev.nome, dataCarga: ev.dataCarga, responsavelEvento: ev.responsavel.nome }, d, { pecas: fotosPecas, projetos: fotosProjetos });

  const hf = (t: string) => t.replace(/&/g, "&&");
  impressao(ws, hf(`OS de marcenaria · ${ev.codigo} · ${ev.nome} · ${rotulo}`), hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`), undefined, false);
  wb.calcProperties.fullCalcOnLoad = true;
  const buffer = await wb.xlsx.writeBuffer();
  const sufixo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa";
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // Nome do modelo da cenografia, com o UTF-8 em filename* (auditoria 28/10, nº 180).
      "Content-Disposition": contentDisposition(`OS CENO MARCENARIA_${ev.nome.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").toUpperCase()}_${sufixo}.xlsx`),
      "Cache-Control": "no-store",
    },
  });
}
