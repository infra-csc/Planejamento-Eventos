import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { buscar } from "@/server/services/busca";

export async function GET(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const resultados = await buscar(usuario, q);
  return NextResponse.json({ resultados }, { headers: { "Cache-Control": "no-store" } });
}
