import { NextResponse } from "next/server";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { CAMADAS, type Camada } from "@/domain/projecao";
import { formatarDataHora, hojeISO } from "@/lib/format";
import { contentDisposition, nomeArquivo } from "@/server/export/nome-arquivo";
import { pastaProjecao } from "@/server/export/logistica-xlsx";
import { erroDownload } from "@/server/export/resposta-erro";
import { calcularProjecao } from "@/server/services/projecao";

/** Projeção em Excel, com os mesmos filtros da tela. */
export async function GET(request: Request) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "projecao.ver")) return erroDownload(request, 403, "Seu perfil não baixa a Projeção");
  const q = new URL(request.url).searchParams;
  const camadas = (q.get("camadas") ?? CAMADAS.join(",")).split(",").filter((c): c is Camada => (CAMADAS as readonly string[]).includes(c));
  const p = await calcularProjecao(usuario, {
    inicio: /^\d{4}-\d{2}-\d{2}$/.test(q.get("inicio") ?? "") ? q.get("inicio")! : hojeISO(),
    semanas: [4, 8, 16, 26].includes(Number(q.get("semanas"))) ? Number(q.get("semanas")) : undefined,
    almoxarifadoId: q.get("almoxarifado") || null,
    camadas: camadas.length ? camadas : (["__nenhuma__"] as unknown as Camada[]),
    incluirADefinir: q.get("adefinir") !== "0",
    eventoPaiId: q.get("pai") || null,
    tourId: q.get("tour") || null,
    setor: q.get("setor") || null,
    familia: q.get("familia") || null,
    busca: q.get("q")?.slice(0, 80) || null,
    soFaltas: q.get("faltas") === "1",
  });
  const almoxarifado = p.almoxarifados.find((a) => a.id === q.get("almoxarifado"))?.nome ?? "Consolidado";
  const wb = pastaProjecao({ semanas: p.semanas, linhas: p.linhas, faltas: p.faltas }, `${almoxarifado} · ${p.camadas.join(", ").toLocaleLowerCase("pt-BR")}`, formatarDataHora(new Date()), almoxarifado);
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(nomeArquivo(["Projeção", almoxarifado, hojeISO()], "xlsx")),
      "Cache-Control": "no-store",
    },
  });
}
