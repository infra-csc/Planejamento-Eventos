import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETORES } from "@/domain/constantes";
import type { Setor } from "@/server/db/schema";
import { SETOR_LABEL } from "@/domain/os";
import { NaoEncontradoError } from "@/domain/errors";

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
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id, setor } = await params;
  if (!(SETORES as readonly string[]).includes(setor)) return NextResponse.json({ erro: "Setor inválido" }, { status: 400 });
  // Evento inexistente (link antigo, id digitado): 404 em vez de página de erro.
  const ev = await obterEvento(usuario, id).catch((e: unknown) => {
    if (e instanceof NaoEncontradoError) return null;
    throw e;
  });
  if (!ev) return NextResponse.json({ erro: "Evento não encontrado" }, { status: 404 });
  const v = Number(new URL(request.url).searchParams.get("v"));
  // Versão pedida: só aquele JSON. Sem versão: OS calculada da ata atual.
  const sel = Number.isInteger(v) && v > 0 ? (await obterConteudosOs(id, [v])).get(v) : undefined;
  const os = sel ?? (await calcularOsAtual(await getDb(), id));
  const rotulo = sel ? `v${v}` : "atual";
  const s = os.setores.find((x) => x.setor === (setor as Setor));
  const linhas = [["Evento", ev.codigo, ev.nome], ["Setor", SETOR_LABEL[setor as Setor]], ["Versão", rotulo], [], ["Código", "Peça", "Unidade", "Total", "Composição"]];
  for (const l of s?.linhas ?? []) linhas.push([l.codigo, l.nome, l.unidade, String(l.total), l.origens.map((o) => `${o.descricao} -> ${o.quantidade}`).join(" | ")]);
  const csv = "﻿" + linhas.map((r) => r.map(csvEscape).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="OS-${ev.codigo}-${setor}-${rotulo}.csv"`,
    },
  });
}
