import { NextResponse } from "next/server";
import { getUsuarioDaApi } from "@/server/auth/session";
import { NaoEncontradoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { formatarDataHora } from "@/lib/format";
import { pastaFornecedor } from "@/server/export/logistica-xlsx";
import { contentDisposition, nomeArquivo } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";
import { obterEvento } from "@/server/services/eventos";
import { documentoFornecedor } from "@/server/services/projecao";

/** Documento técnico para o fornecedor de estrutura, em Excel. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "logistica.cadastros")) return erroDownload(request, 403, "Seu perfil não baixa este documento");
  const { id } = await params;
  const ev = await obterEvento(usuario, id).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) return null;
    throw e;
  });
  if (!ev) return erroDownload(request, 404, "Evento não encontrado");
  const d = await documentoFornecedor(id);
  if (!d.terceirizadas.length && !d.enviadoPelaNorte.length) return erroDownload(request, 404, "Este evento não tem linha terceirizada nem complemento ao montador");
  const wb = pastaFornecedor(d.evento, d.terceirizadas, d.enviadoPelaNorte, d.pdfs, formatarDataHora(new Date()));
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(nomeArquivo(["Documento técnico", ev.codigo, ev.nome], "xlsx")),
      "Cache-Control": "no-store",
    },
  });
}
