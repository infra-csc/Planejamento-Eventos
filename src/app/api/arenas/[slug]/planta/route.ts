import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterPlanta, obterPlantaMeta } from "@/server/services/arenas";

const CACHE = "private, max-age=300";

/** Imagem da planta de uma arena de evento (fundo do plano 2D). Só quem vê a Arena 3D. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "arena.ver")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { slug } = await params;
  const meta = await obterPlantaMeta(usuario, slug);
  if (!meta) return NextResponse.json({ erro: "Planta não encontrada" }, { status: 404 });
  const etag = `"${slug}-${meta.versao}"`;
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
  const planta = await obterPlanta(usuario, slug);
  if (!planta) return NextResponse.json({ erro: "Planta não encontrada" }, { status: 404 });
  const corpo = new Uint8Array(planta.bytes);
  return new NextResponse(corpo as unknown as BodyInit, {
    headers: {
      "Content-Type": planta.mime,
      "Content-Length": String(corpo.byteLength),
      "Cache-Control": CACHE,
      ETag: `"${slug}-${planta.versao}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
