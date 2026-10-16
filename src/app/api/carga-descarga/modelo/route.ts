import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { eventosParaModelo } from "@/server/services/carga-importacao";
import { montarModeloCarga } from "@/server/export/carga-modelo";
import { hojeISO } from "@/lib/format";

/**
 * Modelo .xlsx para subir veículos de carga em lote (logística e administrador). Vem com a lista dos
 * eventos ativos de hoje, para escolher na lista suspensa.
 */
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "carga.editar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const hoje = hojeISO();
  const wb = montarModeloCarga(await eventosParaModelo(usuario), hoje);
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Modelo carga e descarga ${hoje.slice(8, 10)}-${hoje.slice(5, 7)}-${hoje.slice(0, 4)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
