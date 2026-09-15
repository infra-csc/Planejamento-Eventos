import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { obterAnexo } from "@/server/services/projetos";
import { NaoEncontradoError } from "@/domain/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const a = await obterAnexo(usuario, id);
    const nome = encodeURIComponent(a.nomeArquivo);
    return new NextResponse(new Uint8Array(a.conteudo), {
      headers: {
        "Content-Type": a.mime,
        "Content-Length": String(a.tamanho),
        "Content-Disposition": `inline; filename*=UTF-8''${nome}`,
        "Cache-Control": "private, max-age=3600",
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
