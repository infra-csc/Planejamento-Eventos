import { NextResponse } from "next/server";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { osParaLeitura, ROTULO_KIT } from "@/domain/os";
import { formatarDataHora } from "@/lib/format";
import { getDb } from "@/server/db";
import { contentDisposition, nomeArquivo } from "@/server/export/nome-arquivo";
import { pastaMateriaisKit } from "@/server/export/os-kit-xlsx";
import { erroDownload } from "@/server/export/resposta-erro";
import { obterEvento } from "@/server/services/eventos";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";

/** Materiais KIT em Excel: a lista à parte do que a área Kit pediu (versão pedida ou a ata de agora). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "os.exportar")) return erroDownload(request, 403, "Seu perfil não baixa os materiais do Kit");
  const { id } = await params;
  const [ev, versoes, mapa] = await Promise.all([
    obterEvento(usuario, id).catch((e: unknown) => {
      if (e instanceof NaoEncontradoError) return null;
      throw e;
    }),
    listarOsResumo(id),
    mapaGruposPecas(),
  ]);
  if (!ev) return erroDownload(request, 404, "Evento não encontrado");
  const v = Number(new URL(request.url).searchParams.get("v"));
  const pedida = Number.isInteger(v) && v > 0 ? versoes.find((x) => x.numero === v) : undefined;
  const gravado = pedida ? (await obterConteudosOs(id, [pedida.numero])).get(pedida.numero) : undefined;
  const { kit } = osParaLeitura(gravado ?? (await calcularOsAtual(await getDb(), id)));
  if (!kit) return erroDownload(request, 404, "Este evento não tem materiais do Kit");
  const rotulo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero} (atual)` : "prévia";
  const wb = pastaMateriaisKit(ev, kit, mapa, rotulo, usuario.nome, formatarDataHora(new Date()));
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(nomeArquivo([ROTULO_KIT, ev.codigo, ev.nome, pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "prévia"], "xlsx")),
      "Cache-Control": "no-store",
    },
  });
}
