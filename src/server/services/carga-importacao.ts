import ExcelJS from "exceljs";
import { inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos as tEventos, veiculosCarga } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { ValidacaoError } from "@/domain/errors";
import { normalizarVeiculo, TIPO_VEICULO_LABEL, validarVeiculo, type DadosVeiculo } from "@/domain/carga-descarga";
import { colunaDoTitulo, interpretarLinha, linhaVazia, MAX_LINHAS_IMPORTACAO, MAX_QUANTIDADE, planejarImportacao, type ChaveColuna, type LinhaPlanilha, type ValorCelula } from "@/domain/carga-importacao";
import { listarCarga } from "./carga-descarga";
import { registrarHistorico } from "./support";

/** Uma linha conferida: o que vai ser criado (ou por que não). */
export type LinhaPrevia = {
  linha: number;
  eventoId: string | null;
  evento: { codigo: string; nome: string } | null;
  veiculo: DadosVeiculo | null;
  quantidade: number;
  /** Quantos serão criados de fato (descontando os iguais já cadastrados). */
  novos: number;
  jaExistiam: number;
  erros: string[];
};

/** Célula do ExcelJS → valor simples (fórmula vira o resultado; rich text e link viram texto). */
function valorDaCelula(v: ExcelJS.CellValue): ValorCelula {
  if (v == null) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    if ("result" in v) return valorDaCelula((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return null;
  }
  return null;
}

/** Caminho do Google Planilhas, igual em todas as mensagens (auditoria 28/10, nº 165). */
export const CAMINHO_GOOGLE_PLANILHAS = "no Google Planilhas: Arquivo › Fazer download › Microsoft Excel (.xlsx)";

/** Teto do conteúdo descompactado: um .xlsx de 500 linhas tem poucos MB; acima disso é arquivo errado ou zip-bomb. */
const MAX_DESCOMPACTADO = 60 * 1024 * 1024;

/**
 * Soma o tamanho descompactado declarado no diretório central do .xlsx (um zip), sem abrir nada. Os 5 MB do
 * arquivo podiam virar centenas de MB dentro do ExcelJS (auditoria de segurança 28/10, E4). null = não é zip.
 */
export function tamanhoDescompactado(arquivo: ArrayBuffer | ArrayBufferView): number | null {
  // Do navegador vem ArrayBuffer; o ExcelJS (testes, scripts) devolve Buffer: lê os dois.
  const v = ArrayBuffer.isView(arquivo) ? new DataView(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength) : new DataView(arquivo);
  const n = v.byteLength;
  // Fim do diretório central: assinatura 0x06054b50 nos últimos 22 + 65535 bytes (comentário do zip).
  let fim = -1;
  for (let i = n - 22; i >= Math.max(0, n - 22 - 65_535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) return null;
  const entradas = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  let total = 0;
  for (let k = 0; k < entradas; k++) {
    if (p + 46 > n || v.getUint32(p, true) !== 0x02014b50) return null;
    const tamanho = v.getUint32(p + 24, true);
    // 0xFFFFFFFF = zip64 (arquivo de mais de 4 GB): nunca é um modelo de verdade.
    if (tamanho === 0xffffffff) return Number.POSITIVE_INFINITY;
    total += tamanho;
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return total;
}

/**
 * Célula de data e hora digitada à meia-noite: o leitor entrega 00:00 e a regra "data sem hora é erro" recusava
 * (auditoria 30/10, parte D N13). Se o formato da célula mostra a hora, a hora 00:00 foi escolhida: vai como texto.
 */
function valorComFormato(cel: ExcelJS.Cell): ValorCelula {
  const v = valorDaCelula(cel.value);
  if (v instanceof Date && /h/i.test(cel.numFmt ?? "") && v.getUTCHours() === 0 && v.getUTCMinutes() === 0) {
    const d2 = (x: number) => String(x).padStart(2, "0");
    return `${v.getUTCFullYear()}-${d2(v.getUTCMonth() + 1)}-${d2(v.getUTCDate())} 00:00`;
  }
  return v;
}

/**
 * Lê o .xlsx: a aba "Veículos" (ou a primeira que tiver o cabeçalho), acha a linha de títulos pelos
 * nomes das colunas (a ordem pode mudar) e devolve as linhas não vazias com o número de cada uma.
 */
async function lerPlanilha(arquivo: ArrayBuffer): Promise<Array<{ linha: number; dados: LinhaPlanilha }>> {
  // Mensagens impessoais, como o resto do app (auditoria 28/10, nº 152).
  const naoAbre = `Não foi possível abrir o arquivo. Envie a planilha .xlsx do modelo (${CAMINHO_GOOGLE_PLANILHAS}).`;
  const tamanho = tamanhoDescompactado(arquivo);
  if (tamanho === null) throw new ValidacaoError(naoAbre);
  if (tamanho > MAX_DESCOMPACTADO) throw new ValidacaoError("A planilha é grande demais para importar. Use o modelo, com até 500 linhas.");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(arquivo);
  } catch {
    throw new ValidacaoError(naoAbre);
  }
  const abas = [wb.getWorksheet("Veículos"), ...wb.worksheets].filter((w): w is ExcelJS.Worksheet => Boolean(w));
  for (const ws of abas) {
    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const mapa = new Map<number, ChaveColuna>();
      ws.getRow(r).eachCell((cel, c) => {
        const chave = colunaDoTitulo(String(valorDaCelula(cel.value) ?? "").replace(/\*\s*$/, ""));
        if (chave) mapa.set(c, chave);
      });
      if (![...mapa.values()].includes("evento") || mapa.size < 3) continue;
      const linhas: Array<{ linha: number; dados: LinhaPlanilha }> = [];
      for (let i = r + 1; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const dados: LinhaPlanilha = {};
        for (const [c, chave] of mapa) dados[chave] = valorComFormato(row.getCell(c));
        if (linhaVazia(dados)) continue;
        linhas.push({ linha: i, dados });
        if (linhas.length > MAX_LINHAS_IMPORTACAO) throw new ValidacaoError(`A planilha tem mais de ${MAX_LINHAS_IMPORTACAO} linhas preenchidas. Divida em arquivos menores.`);
      }
      return linhas;
    }
  }
  throw new ValidacaoError("A aba Veículos com os títulos do modelo (Evento, Tipo, …) não foi encontrada. Baixe o modelo de novo e preencha nele.");
}

/**
 * Conferência antes de gravar: cada linha interpretada com as regras do formulário, e quantos veículos
 * ela cria de fato (os iguais aos já cadastrados no evento não são duplicados).
 */
export async function previaImportacaoCarga(usuario: UsuarioAtual, arquivo: ArrayBuffer): Promise<{ linhas: LinhaPrevia[] }> {
  exigir(usuario, "carga.editar");
  const [linhasPlanilha, { eventos, veiculos }] = await Promise.all([lerPlanilha(arquivo), listarCarga(usuario)]);
  if (!linhasPlanilha.length) throw new ValidacaoError("A planilha não tem nenhuma linha preenchida na aba Veículos.");
  const interpretadas = linhasPlanilha.map(({ linha, dados }) => interpretarLinha(linha, dados, eventos));
  const validas = interpretadas.filter((l) => l.veiculo && l.evento);
  const plano = new Map(
    planejarImportacao(
      validas.map((l) => ({ linha: l.linha, eventoId: l.evento!.id, veiculo: l.veiculo!, quantidade: l.quantidade })),
      veiculos.map((v) => ({ eventoId: v.eventoId, veiculo: v })),
    ).map((p) => [p.linha, p]),
  );
  return {
    linhas: interpretadas.map((l) => ({
      linha: l.linha,
      eventoId: l.evento?.id ?? null,
      evento: l.evento ? { codigo: l.evento.codigo, nome: l.evento.nome } : null,
      veiculo: l.veiculo,
      quantidade: l.quantidade,
      novos: plano.get(l.linha)?.novos ?? 0,
      jaExistiam: plano.get(l.linha)?.jaExistiam ?? 0,
      erros: l.erros,
    })),
  };
}

/**
 * Grava as linhas conferidas numa transação só. Revalida tudo no servidor (o que veio da tela não é
 * confiável) e recalcula os iguais já cadastrados: importar duas vezes não duplica.
 */
export async function importarVeiculosCarga(usuario: UsuarioAtual, itens: ReadonlyArray<{ linha: number; eventoId: string; veiculo: DadosVeiculo; quantidade: number }>) {
  exigir(usuario, "carga.editar");
  if (!itens.length) throw new ValidacaoError("Nenhuma linha válida para importar.");
  if (itens.length > MAX_LINHAS_IMPORTACAO) throw new ValidacaoError(`No máximo ${MAX_LINHAS_IMPORTACAO} linhas por importação.`);
  const limpos = itens.map((it) => {
    const veiculo = normalizarVeiculo(it.veiculo);
    const erro = validarVeiculo(veiculo);
    if (erro) throw new ValidacaoError(`Linha ${it.linha}: ${erro.mensagem}`);
    if (!Number.isInteger(it.quantidade) || it.quantidade < 1 || it.quantidade > MAX_QUANTIDADE) throw new ValidacaoError(`Linha ${it.linha}: quantidade inválida.`);
    return { ...it, veiculo };
  });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ids = [...new Set(limpos.map((l) => l.eventoId))];
    const evs = await tx.select({ id: tEventos.id, nome: tEventos.nome, status: tEventos.status }).from(tEventos).where(inArray(tEventos.id, ids));
    const porId = new Map(evs.map((e) => [e.id, e]));
    for (const l of limpos) {
      const e = porId.get(l.eventoId);
      if (!e) throw new ValidacaoError(`Linha ${l.linha}: evento não encontrado.`);
      if (e.status === "CANCELADO" || e.status === "ENCERRADO") throw new ValidacaoError(`Linha ${l.linha}: o evento ${e.nome} está encerrado ou cancelado.`);
    }
    const existentes = await tx.select({ eventoId: veiculosCarga.eventoId, tipo: veiculosCarga.tipo, ident: veiculosCarga.ident, ida: veiculosCarga.ida, volta: veiculosCarga.volta }).from(veiculosCarga).where(inArray(veiculosCarga.eventoId, ids));
    const plano = planejarImportacao(
      limpos,
      existentes.map((x) => ({ eventoId: x.eventoId, veiculo: { tipo: x.tipo, ident: x.ident, ida: x.ida, volta: x.volta } })),
    );
    let criados = 0;
    let ignorados = 0;
    for (const [i, l] of limpos.entries()) {
      ignorados += plano[i].jaExistiam;
      for (let n = 0; n < plano[i].novos; n++) {
        const agora = new Date();
        const [novo] = await tx
          .insert(veiculosCarga)
          .values({ eventoId: l.eventoId, tipo: l.veiculo.tipo, ident: l.veiculo.ident, ida: l.veiculo.ida, volta: l.veiculo.volta, criadoPorId: usuario.id, atualizadoPorId: usuario.id, criadoEm: agora, atualizadoEm: agora })
          .returning({ id: veiculosCarga.id });
        await registrarHistorico(tx, {
          eventoId: l.eventoId,
          entidade: "veiculo_carga",
          entidadeId: novo.id,
          acao: "CARGA_VEICULO_CRIADO",
          descricao: `Veículo de carga importado da planilha (linha ${l.linha}): ${TIPO_VEICULO_LABEL[l.veiculo.tipo]}${l.veiculo.ident ? ` (${l.veiculo.ident})` : ""} · ${porId.get(l.eventoId)!.nome}`,
          usuarioId: usuario.id,
          dadosDepois: l.veiculo,
        });
        criados++;
      }
    }
    return { criados, ignorados, eventos: ids.filter((id) => limpos.some((l, i) => l.eventoId === id && plano[i].novos > 0)) };
  });
}

/** Eventos que recebem veículos (para o modelo): os ativos, com a data e o local. */
export async function eventosParaModelo(usuario: UsuarioAtual) {
  exigir(usuario, "carga.editar");
  const { eventos } = await listarCarga(usuario);
  return eventos;
}
