import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getUsuarioAtual } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { NaoEncontradoError } from "@/domain/errors";
import { obterEvento } from "@/server/services/eventos";
import { calcularOsAtual, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { getDb } from "@/server/db";
import { anexos, projetos } from "@/server/db/schema";
import { formatarDataHora } from "@/lib/format";
import { impressao } from "@/server/export/excel";
import { montarOsEstrutura } from "@/server/export/os-estrutura";
import { abaProjeto, abaSomatoria, abaTotal, type Imagem } from "@/server/export/os-estrutura-xlsx";
import { lerArquivo } from "@/server/armazenamento";

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
/**
 * Imagens já reduzidas, por id do anexo (null = ilegível). Anexo não é editado, só incluído e removido:
 * o id identifica o conteúdo para sempre. Exportar de novo não relê o original do banco nem refaz o sharp.
 */
const imagensProntas = new Map<string, Imagem | null>();
/** Uma por projeto com capa (o catálogo tem algumas dezenas); limita a memória da instância. */
const MAX_IMAGENS = 80;

function guardarImagem(id: string, imagem: Imagem | null) {
  if (imagensProntas.size >= MAX_IMAGENS) imagensProntas.delete(imagensProntas.keys().next().value as string);
  imagensProntas.set(id, imagem);
}

/** Primeira imagem anexada de cada projeto (a capa), só PNG/JPEG, reduzida para não pesar a pasta. */
async function imagensDosProjetos(codigos: string[]): Promise<Map<string, Imagem>> {
  const out = new Map<string, Imagem>();
  if (codigos.length === 0) return out;
  const db = await getDb();
  const projs = await db.select({ id: projetos.id, codigo: projetos.codigo }).from(projetos).where(inArray(projetos.codigo, codigos));
  if (projs.length === 0) return out;
  const metas = await db
    .select({ id: anexos.id, projetoId: anexos.projetoId, mime: anexos.mime })
    .from(anexos)
    .where(and(inArray(anexos.projetoId, projs.map((p) => p.id)), eq(anexos.tipo, "IMAGEM")))
    .orderBy(asc(anexos.criadoEm));
  const capa = new Map<string, { id: string; mime: string }>();
  for (const m of metas) if (!capa.has(m.projetoId)) capa.set(m.projetoId, m);
  const escolhidas = [...capa.entries()].filter(([, m]) => m.mime === "image/png" || m.mime === "image/jpeg");
  if (escolhidas.length === 0) return out;
  // Só os originais que ainda não foram reduzidos nesta instância vêm do banco.
  const faltam = escolhidas.map(([, m]) => m.id).filter((id) => !imagensProntas.has(id));
  const conteudos = faltam.length ? await db.select({ id: anexos.id, conteudo: anexos.conteudo }).from(anexos).where(inArray(anexos.id, faltam)) : [];
  const conteudoDe = new Map(conteudos.map((c) => [c.id, c.conteudo]));
  for (const [projetoId, m] of escolhidas) {
    const codigo = projs.find((p) => p.id === projetoId)?.codigo;
    if (!codigo) continue;
    if (imagensProntas.has(m.id)) {
      const pronta = imagensProntas.get(m.id);
      if (pronta) out.set(codigo, pronta);
      continue;
    }
    const valor = conteudoDe.get(m.id);
    if (!valor) continue;
    try {
      // O valor pode ser o arquivo (banco) ou a referência ao Object Storage.
      const bruto = await lerArquivo(valor);
      const base = sharp(new Uint8Array(bruto)).rotate().resize({ width: LARGURA_IMAGEM, withoutEnlargement: true });
      const extension = m.mime === "image/png" ? "png" : "jpeg";
      const { data, info } = await (extension === "png" ? base.png() : base.jpeg({ quality: 82 })).toBuffer({ resolveWithObject: true });
      const imagem: Imagem = { buffer: data, extension, largura: info.width, altura: info.height };
      guardarImagem(m.id, imagem);
      out.set(codigo, imagem);
    } catch {
      // Imagem ilegível: a aba sai sem o desenho (e não se tenta de novo a cada exportação).
      guardarImagem(m.id, null);
    }
  }
  return out;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!pode(usuario, "os.exportar")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  let ev: Evento;
  try {
    ev = await obterEvento(usuario, id);
  } catch (e) {
    if (e instanceof NaoEncontradoError) return NextResponse.json({ erro: "Evento não encontrado" }, { status: 404 });
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
  const imagens = pode(usuario, "projeto.ver") ? await imagensDosProjetos(dados.abas.map((a) => a.codigo)) : new Map<string, Imagem>();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Norte Mkt · Planejamento de Eventos";
  wb.created = new Date();
  // O exceljs não grava resultado 0 em cache: recalcular ao abrir evita total vazio em coluna zerada.
  wb.calcProperties.fullCalcOnLoad = true;
  // Cabeçalho/rodapé de impressão: "&" é código de formatação do Excel; nome digitado vira "&&" (literal).
  const hf = (t: string) => t.replace(/&/g, "&&");
  const cab = hf(`OS de estrutura · ${ev.codigo} · ${ev.nome} · ${rotulo}`);
  const rodape = hf(`Gerado ${formatarDataHora(new Date())} por ${usuario.nome}`);
  impressao(abaTotal(wb, { nome: ev.nome, dataInicio: ev.dataInicio, local: ev.local ?? "", diretor: ev.responsavel.nome, versao: rotulo, geradaPor: usuario.nome }, dados), cab, rodape, undefined, true);
  impressao(abaSomatoria(wb, dados), `${cab} · SOMATORIA`, rodape, 4, true);
  for (const a of dados.abas) impressao(abaProjeto(wb, a, imagens.get(a.codigo)), `${cab} · ${hf(a.nome)}`, rodape, 5, false);

  const buffer = await wb.xlsx.writeBuffer();
  const sufixo = pedida ? `v${pedida.numero}` : versoes[0] ? `v${versoes[0].numero}` : "previa";
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="OS ESTRUTURA_${ev.nome.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").toUpperCase()}_${sufixo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
