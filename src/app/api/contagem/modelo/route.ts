import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
import { modeloContagem } from "@/server/export/logistica-xlsx";
import { contentDisposition, nomeArquivo } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";

export async function GET(request: Request) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "logistica.contagem")) return erroDownload(request, 403, "Seu perfil não faz contagem de saldo");
  const db = await getDb();
  const lista = await db.select({ codigo: pecas.codigo, nome: pecas.nome, unidade: pecas.unidade }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.nome));
  const buffer = await modeloContagem(lista).xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": contentDisposition(nomeArquivo(["Modelo de contagem"], "xlsx")), "Cache-Control": "no-store" },
  });
}
