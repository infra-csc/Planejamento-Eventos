import { NextResponse } from "next/server";
import sharp from "sharp";

/*
 * Entrega de arquivos guardados (anexos de projeto, fotos de peça): miniaturas sob demanda e a resposta
 * com cabeçalhos de segurança. Os arquivos nunca mudam (só são incluídos e removidos), então o id
 * identifica o conteúdo para sempre e o ETag responde 304 sem ler o banco.
 */

/** Larguras de miniatura aceitas (px). Fora disso, serve o original. */
export const LARGURAS = new Set([160, 320, 640]);
/** Miniaturas já geradas, por "id-largura". Nunca expiram; só o tamanho é limitado. */
const miniaturas = new Map<string, Uint8Array>();
const MAX_MINIATURAS = 600;

/**
 * 5 minutos, como a planta da arena: com 1 dia e "immutable", quem perdia o acesso (troca de área, conta
 * desativada, saiu) ainda abria o arquivo pelo cache do navegador (endurecimento E3 da auditoria de segurança
 * 28/10). Depois disso o navegador revalida: a permissão é conferida antes do 304.
 */
export const CACHE = "private, max-age=300";

export const ehImagem = (mime: string) => mime.startsWith("image/") && mime !== "image/svg+xml";
export const nomeWebp = (nome: string) => nome.replace(/\.[^.]+$/, "") + ".webp";
export const miniaturaPronta = (id: string, largura: number) => miniaturas.get(`${id}-${largura}`);

export async function miniatura(id: string, conteudo: Uint8Array, largura: number) {
  const chave = `${id}-${largura}`;
  const pronta = miniaturas.get(chave);
  if (pronta) return pronta;
  const out = new Uint8Array(await sharp(conteudo).rotate().resize({ width: largura, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
  if (miniaturas.size >= MAX_MINIATURAS) miniaturas.delete(miniaturas.keys().next().value as string);
  miniaturas.set(chave, out);
  return out;
}

export function respostaArquivo(corpo: Uint8Array, tipo: string, nomeArquivo: string, etag: string) {
  return new NextResponse(new Uint8Array(corpo) as unknown as BodyInit, {
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(corpo.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
      "Cache-Control": CACHE,
      ETag: etag,
      // O navegador não "adivinha" outro tipo e o arquivo abre isolado, sem scripts nem acesso à origem do app.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
