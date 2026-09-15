import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { obterAnexo, obterAnexoMeta } from "@/server/services/projetos";
import { NaoEncontradoError } from "@/domain/errors";

/** Anexos não são editados (só incluídos e removidos): o id identifica o conteúdo para sempre. */
const CACHE = "private, max-age=86400, immutable";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const meta = await obterAnexoMeta(usuario, id);
    const etag = `"${meta.id}-${meta.tamanho}"`;
    // O navegador já tem o arquivo: responde sem ler o conteúdo do banco.
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
    const a = await obterAnexo(usuario, id);
    const nome = encodeURIComponent(a.nomeArquivo);
    return new NextResponse(new Uint8Array(a.conteudo), {
      headers: {
        "Content-Type": a.mime,
        "Content-Length": String(a.tamanho),
        "Content-Disposition": `inline; filename*=UTF-8''${nome}`,
        "Cache-Control": CACHE,
        ETag: etag,
        // O navegador não "adivinha" outro tipo e o arquivo abre isolado, sem scripts nem acesso à origem do app.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    if (e instanceof NaoEncontradoError) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
    throw e;
  }
}
