import { NextResponse } from "next/server";
import { getUsuarioDaApi } from "@/server/auth/session";
import { obterAnexoPeca, obterAnexoPecaMeta } from "@/server/services/catalogo";
import { NaoEncontradoError, SemPermissaoError } from "@/domain/errors";
import { CACHE, ehImagem, LARGURAS, miniatura, miniaturaPronta, nomeWebp, respostaArquivo } from "@/server/resposta-arquivo";

/** Foto ou PDF de uma peça do catálogo (?w=160|320|640 numa foto devolve a miniatura em WEBP). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const wParam = Number(new URL(req.url).searchParams.get("w"));
  const largura = LARGURAS.has(wParam) ? wParam : null;
  try {
    const meta = await obterAnexoPecaMeta(usuario, id);
    const etag = `"p${meta.id}-${meta.tamanho}${largura ? `-w${largura}` : ""}"`;
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
    // Chave própria no cache de miniaturas: os ids das peças e dos projetos vêm de tabelas diferentes.
    const chave = `peca-${meta.id}`;
    const pronta = largura && ehImagem(meta.mime) ? miniaturaPronta(chave, largura) : undefined;
    if (pronta) return respostaArquivo(pronta, "image/webp", nomeWebp(meta.nomeArquivo), etag);
    const a = await obterAnexoPeca(usuario, id);
    const reduzida = largura && ehImagem(a.mime) ? await miniatura(chave, new Uint8Array(a.conteudo), largura).catch(() => null) : null;
    if (reduzida) return respostaArquivo(reduzida, "image/webp", nomeWebp(a.nomeArquivo), etag);
    return respostaArquivo(new Uint8Array(a.conteudo), a.mime, a.nomeArquivo, etag);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
    if (e instanceof SemPermissaoError) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    throw e;
  }
}
