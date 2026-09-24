import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode, PERFIL_LABEL } from "@/domain/permissions";
import { exportarHistoricoGeral } from "@/server/services/historico-geral";
import { CATEGORIAS_HISTORICO, ehCategoria, ehPeriodo, rotuloAcao } from "@/domain/historico-geral";
import { formatarDataHora, hojeISO } from "@/lib/format";

/*
 * Histórico em CSV com os mesmos filtros da tela (?cat=&periodo=&evento=&quem=&q=), até 5000
 * registros, do mais recente para o mais antigo. Separador ";" e BOM: abre certo no Excel em pt-BR.
 */
const celula = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "historico.ver_tudo")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const cat = sp.get("cat") ?? undefined;
  const periodo = sp.get("periodo") ?? undefined;
  const evento = sp.get("evento");
  const quem = sp.get("quem");
  const { itens, total } = await exportarHistoricoGeral(usuario, {
    categoria: ehCategoria(cat) ? cat : null,
    periodo: ehPeriodo(periodo) ? periodo : "30",
    eventoId: evento && /^[\w-]{1,64}$/.test(evento) ? evento : null,
    usuarioId: quem && /^[\w-]{1,64}$/.test(quem) ? quem : null,
    busca: sp.get("q")?.trim().slice(0, 80) || null,
  });

  const linhas = [
    ["Quando", "Quem", "Perfil", "Vendo como", "Categoria", "Ação", "Descrição", "Evento", "Entidade", "Id"].map(celula).join(";"),
    ...itens.map((h) =>
      [
        formatarDataHora(h.em),
        h.autor?.nome ?? "",
        h.autor ? PERFIL_LABEL[h.autor.perfil] : "",
        h.verComo ?? "",
        h.categoria ? CATEGORIAS_HISTORICO[h.categoria].rotulo : h.entidade,
        rotuloAcao(h.acao),
        h.descricao,
        h.evento ? `${h.evento.codigo} ${h.evento.nome}` : "",
        h.entidade,
        h.entidadeId,
      ]
        .map(celula)
        .join(";"),
    ),
  ];
  if (total > itens.length) linhas.push(celula(`Exportados ${itens.length} de ${total} registros: refine os filtros para ver o restante.`));
  const corpo = "﻿" + linhas.join("\r\n");
  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historico-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
