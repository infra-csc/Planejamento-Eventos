import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioDaApi } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { contentDisposition } from "@/server/export/nome-arquivo";
import { erroDownload } from "@/server/export/resposta-erro";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { formatarDataHora } from "@/lib/format";
import { impressao } from "@/server/export/excel";
import { montarOsEstrutura } from "@/server/export/os-estrutura";
import { abaProjeto, abaSomatoria, abaTotal, type Imagem } from "@/server/export/os-estrutura-xlsx";
import { todasAsImagensDoCatalogo } from "@/server/export/imagens-os";

/*
 * OS de estrutura no modelo exato da planilha da cenografia (OS ESTRUTURA_<evento>.xlsx):
 *  - TOTAL: cabeçalho (evento, data, cidade, diretor, responsável) e os blocos nas mesmas colunas
 *    da planilha — ESTRUTURAS e MARCENARIA em B:C, PEÇA em E:F, TENDAS por local / OUTROS
 *    MATERIAIS / Q-15 KIT / ESTAIAMENTO de H em diante;
 *  - SOMATORIA: "RESUMO BOX TRUSS", peça × projeto com EXTRAS e TOTAL;
 *  - uma aba por projeto "Nome (NX)" com a quantidade por unidade (e o desenho do projeto ao lado).
 * Os dados vêm de `montarOsEstrutura`; aqui só se desenha.
 */

type Evento = Awaited<ReturnType<typeof obterEvento>>;

/** Largura da imagem gravada na planilha: a aba mostra no máximo 560 px, então 800 px sobra. */
const LARGURA_IMAGEM = 800;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioDaApi();
  if (!usuario) return erroDownload(request, 401, "Sua sessão terminou. Entre de novo e baixe outra vez", "/login");
  if (!pode(usuario, "os.exportar")) return erroDownload(request, 403, "Seu perfil não baixa a OS de estrutura");
  const { id } = await params;
  let ev: Evento;
  try {
    ev = await obterEvento(usuario, id);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return erroDownload(request, 404, "Evento não encontrado");
    throw e;
  }
  // Mesma escolha de versão da rota /excel: ?v= pede uma versão; sem ela, a OS calculada da ata atual.
  const v = Number(new URL(request.url).searchParams.get("v"));
  const versoes = await listarOsResumo(id);
  const pedida = Number.isInteger(v) && v > 0 ? versoes.find((x) => x.numero === v) : undefined;
  const gravado = pedida ? (await obterConteudosOs(id, [pedida.numero])).get(pedida.numero) : undefined;
  const ehAtual = pedida && versoes[0]?.numero === pedida.numero;
  const os = gravado && (gravado.projetos || !ehAtual) ? gravado : await calcularOsAtual(await getDb(), id);
  const rotulo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero} (atual)` : "prévia";

  const dados = montarOsEstrutura(os);
  // Desenho do projeto só para quem pode ver projetos (mesma regra do /api/anexos).
  // Todas as imagens do projeto (até 6: modulação, detalhamento…), não só a capa.
  const imagens = pode(usuario, "projeto.ver") ? await todasAsImagensDoCatalogo("projeto", dados.abas.map((a) => a.codigo), LARGURA_IMAGEM, 6) : new Map<string, Imagem[]>();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  // O exceljs não grava resultado 0 em cache: recalcular ao abrir evita total vazio em coluna zerada.
  wb.calcProperties.fullCalcOnLoad = true;
  // Cabeçalho/rodapé de impressão: "&" é código de formatação do Excel; nome digitado vira "&&" (literal).
  const hf = (t: string) => t.replace(/&/g, "&&");
  const cab = hf(`OS de estrutura · ${ev.codigo} · ${ev.nome} · ${rotulo}`);
  const rodape = hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`);
  // "RESPONSAVEL PELA O.S" é o responsável do evento, não quem baixou (a Júlia baixava e saía o nome dela; auditoria
  // 30/10, B-26). Quem gerou o arquivo continua no rodapé.
  impressao(abaTotal(wb, { nome: ev.nome, dataInicio: ev.dataInicio, local: ev.local ?? "", diretor: ev.responsavel.nome, versao: rotulo, geradaPor: ev.responsavel.nome }, dados), cab, rodape, undefined, true);
  impressao(abaSomatoria(wb, dados), `${cab} · SOMATORIA`, rodape, 4, true);
  for (const a of dados.abas) impressao(abaProjeto(wb, a, imagens.get(a.codigo)), `${cab} · ${hf(a.nome)}`, rodape, 5, false);

  const buffer = await wb.xlsx.writeBuffer();
  const sufixo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa";
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // Nome do modelo da cenografia, com o UTF-8 em filename* (auditoria 28/10, nº 180).
      "Content-Disposition": contentDisposition(`OS ESTRUTURA_${ev.nome.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").toUpperCase()}_${sufixo}.xlsx`),
      "Cache-Control": "no-store",
    },
  });
}
