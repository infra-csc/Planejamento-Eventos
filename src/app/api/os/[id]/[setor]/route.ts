import { NextResponse } from "next/server";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";
import { osParaLeitura, SETOR_LABEL } from "@/domain/os";
import { NaoEncontradoError } from "@/domain/errors";
import { GRUPO_LABEL, GRUPOS_MATERIAL, totaisPorGrupo, type GrupoMaterial } from "@/domain/grupos-material";
import { mapaGruposPecas } from "@/server/services/grupos-material";
import { contentDisposition, nomeArquivo } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";

/**
 * Escapa uma célula para CSV aberto no Excel. Valores que começam com = + - @ tab ou CR viram texto
 * (prefixo ') para não serem executados como fórmula (CSV injection).
 */
export function csvEscape(v: string | number) {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; setor: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "os.exportar")) return erroDownload(request, 403, "Seu perfil não baixa a OS");
  const { id, setor } = await params;
  // Seção dos totais: grupo de material (como a lista da ata) ou, em links antigos, o setor.
  // "MARCENARIA" é setor e também grupo (27/10): o nome exato do setor continua valendo como setor.
  const ehSetor = (SETORES as readonly string[]).includes(setor);
  const grupo = ehSetor ? undefined : (GRUPOS_MATERIAL.find((g) => g.toLowerCase() === setor.toLowerCase()) as GrupoMaterial | undefined);
  if (!grupo && !(SETORES as readonly string[]).includes(setor)) return erroDownload(request, 400, "Esta seção da OS não existe");
  // Evento inexistente (link antigo, id digitado): 404 em vez de página de erro.
  const ev = await obterEvento(usuario, id).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) return null;
    throw e;
  });
  if (!ev) return erroDownload(request, 404, "Evento não encontrado");
  const v = Number(new URL(request.url).searchParams.get("v"));
  // Versão pedida: só aquele JSON. Sem versão: OS calculada da ata atual.
  const sel = Number.isInteger(v) && v > 0 ? (await obterConteudosOs(id, [v])).get(v) : undefined;
  const os = osParaLeitura(sel ?? (await calcularOsAtual(await getDb(), id)));
  // Sem versão pedida: a OS de agora, com o número da última versão gravada ("v5 (atual)"), como no Excel.
  const ultima = sel ? null : (await listarOsResumo(id))[0]?.numero;
  const rotulo = sel ? `v${v}` : ultima ? `v${ultima} (atual)` : "prévia";
  const s = grupo ? totaisPorGrupo(os.setores, await mapaGruposPecas()).find((x) => x.grupo === grupo) : os.setores.find((x) => x.setor === (setor as Setor));
  const linhas = [["Evento", ev.codigo, ev.nome], grupo ? ["Material", GRUPO_LABEL[grupo]] : ["Setor", SETOR_LABEL[setor as Setor]], ["Versão", rotulo], [], ["Código", "Peça", "Unidade", "Total", "Composição"]];
  for (const l of s?.linhas ?? []) linhas.push([l.codigo, l.nome, l.unidade, String(l.total), l.origens.map((o) => `${o.descricao}: ${o.quantidade}`).join(" · ")]);
  if (!s?.linhas.length) linhas.push(["", grupo ? "Nenhuma peça deste material nesta OS." : "Nenhuma peça deste setor nesta OS."]);
  const csv = "﻿" + linhas.map((r) => r.map(csvEscape).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // "OS EVT-0001 Nome Tendas v3.csv" (auditoria 28/10, nº 180).
      "Content-Disposition": contentDisposition(nomeArquivo(["OS", ev.codigo, ev.nome, grupo ? GRUPO_LABEL[grupo] : SETOR_LABEL[setor as Setor], sel ? `v${v}` : ultima ? `v${ultima}` : "prévia"], "csv")),
    },
  });
}
