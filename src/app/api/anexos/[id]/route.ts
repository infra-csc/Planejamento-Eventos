import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { obterAnexo, obterAnexoMeta } from "@/server/services/projetos";
import { NaoEncontradoError, SemPermissaoError } from "@/domain/errors";
import { CACHE, ehImagem, LARGURAS, miniatura, miniaturaPronta, nomeWebp, respostaArquivo } from "@/server/resposta-arquivo";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const wParam = Number(new URL(req.url).searchParams.get("w"));
  const largura = LARGURAS.has(wParam) ? wParam : null;
  try {
    const meta = await obterAnexoMeta(usuario, id);
    const etag = `"${meta.id}-${meta.tamanho}${largura ? `-w${largura}` : ""}"`;
    // O navegador já tem o arquivo: responde sem ler o conteúdo do banco.
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
    // Miniatura já gerada nesta instância: sai da memória, sem trazer o original (até 8 MB) do banco.
    const pronta = largura && ehImagem(meta.mime) ? miniaturaPronta(meta.id, largura) : undefined;
    if (pronta) return respostaArquivo(pronta, "image/webp", nomeWebp(meta.nomeArquivo), etag);

    const a = await obterAnexo(usuario, id);
    // Miniatura só para imagem: listas com dezenas de fotos deixam de baixar os originais. Imagem que o
    // sharp não consegue ler (arquivo corrompido) sai como o original, em vez de erro 500.
    const reduzida = largura && ehImagem(a.mime) ? await miniatura(a.id, new Uint8Array(a.conteudo), largura).catch(() => null) : null;
    if (reduzida) return respostaArquivo(reduzida, "image/webp", nomeWebp(a.nomeArquivo), etag);
    return respostaArquivo(new Uint8Array(a.conteudo), a.mime, a.nomeArquivo, etag);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
    if (e instanceof SemPermissaoError) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    throw e;
  }
}
