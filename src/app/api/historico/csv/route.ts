import { NextResponse } from "next/server";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode, PERFIL_LABEL } from "@/domain/permissions";
import { exportarHistoricoGeral } from "@/server/services/historico-geral";
import { CATEGORIAS_HISTORICO, ehCategoria, ehPeriodo, rotuloAcao } from "@/domain/historico-geral";
import { formatarDataHora, hojeISO } from "@/lib/format";

/*
 * Histórico em CSV com os mesmos filtros da tela (?cat=&periodo=&evento=&quem=&q=), até 5000
 * registros, do mais recente para o mais antigo. Separador ";" e BOM: abre certo no Excel em pt-BR.
 */
// Texto que começa com = + - @ (ou tab/CR) vira texto no Excel (prefixo '), como no CSV da OS: a descrição pode trazer o
// que um requisitante escreveu (CSV injection, auditoria de segurança).
const FORMULA = /^[=+\-@\t\r]/;
const celula = (v: string | null | undefined) => {
  const s = String(v ?? "");
  const texto = FORMULA.test(s) ? "'" + s : s;
  return '"' + texto.replace(/"/g, '""') + '"';
};

export async function GET(request: Request) {
  const usuario = await getUsuarioDaApi();
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
    ["Quando", "Quem", "Perfil", "Vendo como", "Categoria", "Ação", "Descrição", "Evento", "Tipo de registro", "Código interno"].map(celula).join(";"),
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
  const hoje = hojeISO();
  const dataArquivo = `${hoje.slice(8, 10)}-${hoje.slice(5, 7)}-${hoje.slice(0, 4)}`;
  const corpo = "﻿" + linhas.join("\r\n");
  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Mesmo padrão do modelo da carga ("Modelo carga e descarga 30-10-2026.xlsx"): nome legível e data DD-MM-AAAA
      // (auditoria 28/10, nº 180). O ASCII em `filename` fica para navegador antigo; o acentuado vai em `filename*`.
      "Content-Disposition": `attachment; filename="Historico ${dataArquivo}.csv"; filename*=UTF-8''${encodeURIComponent(`Histórico ${dataArquivo}.csv`)}`,
      "Cache-Control": "no-store",
    },
  });
}
