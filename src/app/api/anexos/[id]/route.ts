import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { obterAnexo, obterAnexoMeta } from "@/server/services/projetos";
import { NaoEncontradoError } from "@/domain/errors";
import sharp from "sharp";

/** Larguras de miniatura aceitas (px). Fora disso, serve o original. */
const LARGURAS = new Set([160, 320, 640]);
/** Miniaturas já geradas, por "id-largura". O anexo é imutável, então nunca expiram; só o tamanho é limitado. */
const miniaturas = new Map<string, Uint8Array>();
const MAX_MINIATURAS = 600;

async function miniatura(id: string, conteudo: Uint8Array, largura: number) {
  const chave = `${id}-${largura}`;
  const pronta = miniaturas.get(chave);
  if (pronta) return pronta;
  const out = new Uint8Array(await sharp(conteudo).rotate().resize({ width: largura, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
  if (miniaturas.size >= MAX_MINIATURAS) miniaturas.delete(miniaturas.keys().next().value as string);
  miniaturas.set(chave, out);
  return out;
}

/** Anexos não são editados (só incluídos e removidos): o id identifica o conteúdo para sempre. */
const CACHE = "private, max-age=86400, immutable";

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
    const a = await obterAnexo(usuario, id);
    const nome = encodeURIComponent(a.nomeArquivo);
    // Miniatura só para imagem: listas com dezenas de fotos deixam de baixar os originais.
    const ehImagem = a.mime.startsWith("image/") && a.mime !== "image/svg+xml";
    const corpo = largura && ehImagem ? await miniatura(a.id, new Uint8Array(a.conteudo), largura) : new Uint8Array(a.conteudo);
    return new NextResponse(new Uint8Array(corpo) as unknown as BodyInit, {
      headers: {
        "Content-Type": largura && ehImagem ? "image/webp" : a.mime,
        "Content-Length": String(corpo.byteLength),
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
