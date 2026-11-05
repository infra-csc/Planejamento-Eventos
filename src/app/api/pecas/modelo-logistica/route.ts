import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
import { modeloPecasLogistica } from "@/server/export/logistica-xlsx";
import { contentDisposition, nomeArquivo } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";

export async function GET(request: Request) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "logistica.cadastros")) return erroDownload(request, 403, "Seu perfil não usa esta planilha");
  const db = await getDb();
  const lista = await db.select({ codigo: pecas.codigo, nome: pecas.nome, tipoItem: pecas.tipoItem, volumeM3: pecas.volumeM3, estoqueMinimo: pecas.estoqueMinimo, apelidos: pecas.apelidos, codigoBarras: pecas.codigoBarras }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome));
  const buffer = await modeloPecasLogistica(lista).xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": contentDisposition(nomeArquivo(["Tipo e m3 das peças"], "xlsx")), "Cache-Control": "no-store" },
  });
}
