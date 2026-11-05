import ExcelJS from "exceljs";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { locadores, pecas, type TipoItem } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { ValidacaoError } from "@/domain/errors";
import { PROPRIETARIO_NORTE } from "@/domain/logistica";
import { QTD_MAXIMA_SALDO } from "@/domain/saldo";
import { CAMINHO_GOOGLE_PLANILHAS, tamanhoDescompactado, valorDaCelula } from "./carga-importacao";
import { registrarHistorico } from "./support";

/** Planilhas da logística: contagem de saldo e tipo/m³ das peças. Sempre em dois passos: conferir e só então gravar. */

const MAX_LINHAS = 5000;
const MAX_DESCOMPACTADO = 60 * 1024 * 1024;
const chave = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\*/g, "")
    .trim();

/** A primeira aba em objetos por título de coluna. Mesma proteção da planilha de carga: só .xlsx de tamanho normal. */
async function lerLinhas(arquivo: ArrayBuffer, colunas: Record<string, readonly string[]>): Promise<Array<{ linha: number; valores: Record<string, string | number | null> }>> {
  const descompactado = tamanhoDescompactado(arquivo);
  if (descompactado === null) throw new ValidacaoError(`Envie um arquivo .xlsx. Se a planilha está em outro formato, salve como .xlsx (${CAMINHO_GOOGLE_PLANILHAS}).`);
  if (descompactado > MAX_DESCOMPACTADO) throw new ValidacaoError("A planilha é grande demais para conferir aqui.");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(arquivo);
  } catch {
    throw new ValidacaoError("Não foi possível ler a planilha. Baixe o modelo e tente de novo.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new ValidacaoError("A planilha está vazia.");
  // O título é a primeira linha que tem a coluna principal: o modelo pode ter faixa de título em cima.
  const principal = Object.values(colunas)[0];
  let linhaTitulo = 0;
  const posicoes = new Map<string, number>();
  ws.eachRow((row, n) => {
    if (linhaTitulo) return;
    const cels = new Map<string, number>();
    row.eachCell((cel, c) => cels.set(chave(valorDaCelula(cel.value)), c));
    if (![...cels.keys()].some((k) => principal.includes(k))) return;
    linhaTitulo = n;
    for (const [nome, apelidos] of Object.entries(colunas)) {
      const achada = apelidos.map((a) => cels.get(a)).find((x) => x !== undefined);
      if (achada !== undefined) posicoes.set(nome, achada);
    }
  });
  if (!linhaTitulo) throw new ValidacaoError("Não achei os títulos das colunas. Baixe o modelo e preencha nele.");
  const out: Array<{ linha: number; valores: Record<string, string | number | null> }> = [];
  ws.eachRow((row, n) => {
    if (n <= linhaTitulo) return;
    const valores: Record<string, string | number | null> = {};
    let vazia = true;
    for (const [nome, c] of posicoes) {
      const v = valorDaCelula(row.getCell(c).value);
      const simples = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? String(v) : v;
      const limpo = typeof simples === "string" ? simples.trim() || null : (simples ?? null);
      valores[nome] = limpo;
      if (limpo !== null) vazia = false;
    }
    if (!vazia) out.push({ linha: n, valores });
  });
  if (out.length > MAX_LINHAS) throw new ValidacaoError(`A planilha tem mais de ${MAX_LINHAS} linhas.`);
  return out;
}

const COLUNAS_CONTAGEM = { codigo: ["codigo", "codigo da peca", "peca (codigo)"], proprietario: ["proprietario", "dono"], quantidade: ["quantidade", "contado", "contagem", "qtd"] } as const;

export type LinhaContagemPlanilha = { linha: number; codigo: string; pecaId: string | null; nome: string | null; locadorId: string | null; proprietario: string; contado: number | null; erro: string | null };

/** Só confere: a tela mostra e a pessoa registra. Linha sem quantidade é ignorada (a peça não foi contada). */
export async function previaContagemPlanilha(usuario: UsuarioAtual, arquivo: ArrayBuffer): Promise<LinhaContagemPlanilha[]> {
  exigir(usuario, "logistica.contagem");
  const linhas = await lerLinhas(arquivo, COLUNAS_CONTAGEM);
  const db = await getDb();
  const [listaPecas, listaLocadores] = await Promise.all([db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(eq(pecas.ativo, true)), db.select({ id: locadores.id, nome: locadores.nome }).from(locadores).where(eq(locadores.ativo, true))]);
  const porCodigo = new Map(listaPecas.map((p) => [p.codigo.toUpperCase(), p]));
  const porLocador = new Map(listaLocadores.map((l) => [chave(l.nome), l]));
  const vistos = new Set<string>();
  return linhas.flatMap((l) => {
    if (l.valores.quantidade === null || l.valores.quantidade === undefined) return [];
    const codigo = String(l.valores.codigo ?? "").trim();
    const p = porCodigo.get(codigo.toUpperCase());
    const dono = String(l.valores.proprietario ?? "").trim();
    const ehNorte = !dono || chave(dono) === chave(PROPRIETARIO_NORTE);
    const loc = ehNorte ? null : porLocador.get(chave(dono));
    const n = Number(l.valores.quantidade);
    const k = `${p?.id ?? codigo}|${loc?.id ?? ""}`;
    const erro = !p ? `Código “${codigo}” não está no catálogo.` : !ehNorte && !loc ? `Locador “${dono}” não está cadastrado.` : !Number.isInteger(n) || n < 0 || n > QTD_MAXIMA_SALDO ? "A quantidade é um inteiro, 0 ou mais." : vistos.has(k) ? "Esta peça e este proprietário já vieram em outra linha." : null;
    vistos.add(k);
    return [{ linha: l.linha, codigo, pecaId: p?.id ?? null, nome: p?.nome ?? null, locadorId: loc?.id ?? null, proprietario: ehNorte ? PROPRIETARIO_NORTE : dono, contado: erro ? null : n, erro }];
  });
}

const COLUNAS_PECAS = {
  codigo: ["codigo"],
  tipo: ["tipo", "tipo do item", "retornavel ou consumivel"],
  volume: ["m3", "m³", "volume", "volume m3", "volume (m3)", "volume (m³)"],
  minimo: ["estoque minimo", "minimo"],
  apelidos: ["apelidos"],
  barras: ["codigo de barras"],
} as const;

export type LinhaPecaPlanilha = { linha: number; codigo: string; pecaId: string | null; nome: string | null; tipoItem: TipoItem | null; volumeM3: number | null; estoqueMinimo: number | null; apelidos: string[] | null; codigoBarras: string | null; erro: string | null };

const lerTipo = (v: unknown): TipoItem | null | "invalido" => {
  const c = chave(v);
  if (!c) return null;
  if (c.startsWith("retorn")) return "RETORNAVEL";
  if (c.startsWith("consum")) return "CONSUMIVEL";
  return "invalido";
};
const lerNumero = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(",", ".")));

/** Célula em branco não muda nada na peça. */
export async function previaPecasPlanilha(usuario: UsuarioAtual, arquivo: ArrayBuffer): Promise<LinhaPecaPlanilha[]> {
  exigir(usuario, "logistica.cadastros");
  const linhas = await lerLinhas(arquivo, COLUNAS_PECAS);
  const db = await getDb();
  const porCodigo = new Map((await db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas)).map((p) => [p.codigo.toUpperCase(), p]));
  return linhas.map((l) => {
    const codigo = String(l.valores.codigo ?? "").trim();
    const p = porCodigo.get(codigo.toUpperCase());
    const tipo = lerTipo(l.valores.tipo);
    const volume = lerNumero(l.valores.volume);
    const minimo = lerNumero(l.valores.minimo);
    const erro = !p ? `Código “${codigo}” não está no catálogo.` : tipo === "invalido" ? "Tipo: use Retornável ou Consumível." : volume !== null && (!Number.isFinite(volume) || volume < 0 || volume > 1000) ? "m³: use um número entre 0 e 1.000." : minimo !== null && (!Number.isInteger(minimo) || minimo < 0) ? "Estoque mínimo: use um inteiro, 0 ou mais." : null;
    return {
      linha: l.linha,
      codigo,
      pecaId: p?.id ?? null,
      nome: p?.nome ?? null,
      tipoItem: tipo === "invalido" ? null : tipo,
      volumeM3: volume,
      estoqueMinimo: minimo,
      apelidos: l.valores.apelidos ? String(l.valores.apelidos).split(/[;,]/).map((a) => a.trim()).filter(Boolean) : null,
      codigoBarras: l.valores.barras ? String(l.valores.barras) : null,
      erro,
    };
  });
}

export async function aplicarPecasPlanilha(usuario: UsuarioAtual, linhas: readonly LinhaPecaPlanilha[]) {
  exigir(usuario, "logistica.cadastros");
  const validas = linhas.filter((l) => l.pecaId && !l.erro && (l.tipoItem || l.volumeM3 !== null || l.estoqueMinimo !== null || l.apelidos || l.codigoBarras));
  if (!validas.length) throw new ValidacaoError("Nenhuma linha com o que atualizar.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ids = validas.map((l) => l.pecaId as string);
    const existentes = new Set((await tx.select({ id: pecas.id }).from(pecas).where(inArray(pecas.id, ids))).map((p) => p.id));
    let n = 0;
    for (const l of validas) {
      if (!existentes.has(l.pecaId as string)) continue;
      // Revalida no servidor: a tela só devolve o que recebeu, mas não é ela quem manda.
      if (l.tipoItem && l.tipoItem !== "RETORNAVEL" && l.tipoItem !== "CONSUMIVEL") throw new ValidacaoError("Tipo inválido.");
      if (l.volumeM3 !== null && !(l.volumeM3 >= 0 && l.volumeM3 <= 1000)) throw new ValidacaoError("m³ inválido.");
      if (l.estoqueMinimo !== null && !(Number.isInteger(l.estoqueMinimo) && l.estoqueMinimo >= 0)) throw new ValidacaoError("Estoque mínimo inválido.");
      await tx
        .update(pecas)
        .set({
          ...(l.tipoItem ? { tipoItem: l.tipoItem } : {}),
          ...(l.volumeM3 !== null ? { volumeM3: l.volumeM3 } : {}),
          ...(l.estoqueMinimo !== null ? { estoqueMinimo: l.estoqueMinimo } : {}),
          ...(l.apelidos ? { apelidos: l.apelidos.map((a) => String(a).slice(0, 60)).slice(0, 20) } : {}),
          ...(l.codigoBarras ? { codigoBarras: String(l.codigoBarras).slice(0, 60) } : {}),
        })
        .where(and(eq(pecas.id, l.pecaId as string)));
      n++;
    }
    await registrarHistorico(tx, { entidade: "peca", entidadeId: "planilha", acao: "IMPORTACAO_LOGISTICA", descricao: `Tipo, m³ e apelidos importados por planilha: ${n} ${n === 1 ? "peça" : "peças"}`, usuarioId: usuario.id });
    return n;
  });
}
