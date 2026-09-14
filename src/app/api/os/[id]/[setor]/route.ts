import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsVersoes } from "@/server/services/os";
import { getDb } from "@/server/db";
import { SETORES, type Setor } from "@/server/db/schema";
import { SETOR_LABEL } from "@/domain/os";

function csvEscape(v: string | number) {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; setor: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id, setor } = await params;
  if (!(SETORES as readonly string[]).includes(setor)) return NextResponse.json({ erro: "Setor inválido" }, { status: 400 });
  const ev = await obterEvento(usuario, id);
  const v = new URL(request.url).searchParams.get("v");
  let os = await calcularOsAtual(await getDb(), id);
  let rotulo = "atual";
  if (v) {
    const versoes = await listarOsVersoes(id);
    const sel = versoes.find((x) => String(x.numero) === v);
    if (sel) {
      os = sel.conteudo;
      rotulo = `v${sel.numero}`;
    }
  }
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
