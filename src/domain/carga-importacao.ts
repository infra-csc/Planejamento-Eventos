/**
 * Importação em lote dos veículos de carga por planilha (modelo gerado pelo sistema): as colunas do
 * modelo, a leitura de cada célula (data e hora, tags, sim/não) e a montagem do veículo de cada linha
 * com as mesmas regras do formulário. Funções puras: o servidor lê o .xlsx e chama estas funções.
 */
import { idaVazia, normalizarTexto, normalizarVeiculo, TAGS_CARGA, TIPOS_VEICULO, validarVeiculo, voltaVazia, type DadosVeiculo, type EventoCarga, type TagCarga, type TipoVeiculo } from "./carga-descarga";

export type ChaveColuna =
  | "evento"
  | "tipo"
  | "ident"
  | "quantidade"
  | "idaDescartar"
  | "idaTags"
  | "idaCarga"
  | "idaInicioCarga"
  | "idaFimCarga"
  | "idaSaida"
  | "idaDestino"
  | "idaChegada"
  | "idaDescarga"
  | "idaObs"
  | "voltaDescartar"
  | "voltaTags"
  | "voltaCarga"
  | "voltaInicioCarga"
  | "voltaFimCarga"
  | "voltaSaida"
  | "voltaDestino"
  | "voltaChegada"
  | "voltaDescarga"
  | "voltaObs";

export type TipoColuna = "evento" | "tipo" | "texto" | "quantidade" | "simNao" | "tags" | "dataHora";
export type Coluna = { chave: ChaveColuna; titulo: string; grupo: "Veículo" | "Ida" | "Volta"; tipo: TipoColuna; largura: number; obrigatoria?: boolean; dica: string };

/** As colunas do modelo, na ordem da planilha. O título é o que a leitura procura no cabeçalho. */
export const COLUNAS_CARGA: readonly Coluna[] = [
  { chave: "evento", titulo: "Evento", grupo: "Veículo", tipo: "evento", largura: 42, obrigatoria: true, dica: "Escolha na lista (aba Eventos). Vale também só o código, ex.: EVT-0195." },
  { chave: "tipo", titulo: "Tipo", grupo: "Veículo", tipo: "tipo", largura: 11, obrigatoria: true, dica: "carreta, truck ou toco." },
  { chave: "ident", titulo: "Identificação", grupo: "Veículo", tipo: "texto", largura: 22, dica: "Opcional: placa, motorista ou transportadora." },
  { chave: "quantidade", titulo: "Quantidade", grupo: "Veículo", tipo: "quantidade", largura: 11, dica: "Quantos veículos iguais a este (1 a 20). Vazio = 1." },
  { chave: "idaDescartar", titulo: "Ida: descartar", grupo: "Ida", tipo: "simNao", largura: 10, dica: "sim = este veículo não tem ida. Vazio = tem ida." },
  { chave: "idaTags", titulo: "Ida: tipo de carga", grupo: "Ida", tipo: "tags", largura: 20, dica: "kit, ceno, estrutura, ativação (separe por vírgula)." },
  { chave: "idaCarga", titulo: "Ida: o que vai", grupo: "Ida", tipo: "texto", largura: 24, dica: "Opcional. Ex.: box, pórtico, 4 tendas." },
  { chave: "idaInicioCarga", titulo: "Ida: início da carga", grupo: "Ida", tipo: "dataHora", largura: 17, dica: "No galpão. dd/mm/aaaa hh:mm. Informe o início ou o fim." },
  { chave: "idaFimCarga", titulo: "Ida: fim da carga", grupo: "Ida", tipo: "dataHora", largura: 17, dica: "No galpão. Aparece no card do calendário." },
  { chave: "idaSaida", titulo: "Ida: saída do caminhão", grupo: "Ida", tipo: "dataHora", largura: 17, dica: "Opcional. dd/mm/aaaa hh:mm." },
  { chave: "idaDestino", titulo: "Ida: destino", grupo: "Ida", tipo: "texto", largura: 22, dica: "Opcional. Vazio = local do evento." },
  { chave: "idaChegada", titulo: "Ida: chegada no destino", grupo: "Ida", tipo: "dataHora", largura: 17, dica: "Opcional. dd/mm/aaaa hh:mm." },
  { chave: "idaDescarga", titulo: "Ida: descarga no destino", grupo: "Ida", tipo: "dataHora", largura: 17, dica: "Opcional. dd/mm/aaaa hh:mm." },
  { chave: "idaObs", titulo: "Ida: observações", grupo: "Ida", tipo: "texto", largura: 24, dica: "Opcional." },
  { chave: "voltaDescartar", titulo: "Volta: descartar", grupo: "Volta", tipo: "simNao", largura: 10, dica: "sim = este veículo não tem volta. Vazio = tem volta." },
  { chave: "voltaTags", titulo: "Volta: tipo de carga", grupo: "Volta", tipo: "tags", largura: 20, dica: "kit, ceno, estrutura, ativação. Vazio = o mesmo da ida." },
  { chave: "voltaCarga", titulo: "Volta: o que volta", grupo: "Volta", tipo: "texto", largura: 24, dica: "Opcional. Vazio = o mesmo da ida." },
  { chave: "voltaInicioCarga", titulo: "Volta: início da carga", grupo: "Volta", tipo: "dataHora", largura: 17, dica: "No evento. dd/mm/aaaa hh:mm." },
  { chave: "voltaFimCarga", titulo: "Volta: fim da carga", grupo: "Volta", tipo: "dataHora", largura: 17, dica: "No evento. Aparece no card do calendário." },
  { chave: "voltaSaida", titulo: "Volta: saída do caminhão", grupo: "Volta", tipo: "dataHora", largura: 17, dica: "Opcional. dd/mm/aaaa hh:mm." },
  { chave: "voltaDestino", titulo: "Volta: destino", grupo: "Volta", tipo: "texto", largura: 16, dica: "Opcional. Vazio = Galpão." },
  { chave: "voltaChegada", titulo: "Volta: chegada no galpão", grupo: "Volta", tipo: "dataHora", largura: 17, dica: "Opcional. dd/mm/aaaa hh:mm." },
  { chave: "voltaDescarga", titulo: "Volta: descarga no galpão", grupo: "Volta", tipo: "dataHora", largura: 17, dica: "Aparece no card do calendário. dd/mm/aaaa hh:mm." },
  { chave: "voltaObs", titulo: "Volta: observações", grupo: "Volta", tipo: "texto", largura: 24, dica: "Opcional." },
];

/** Limite de linhas por arquivo (o resto é recusado com mensagem). */
export const MAX_LINHAS_IMPORTACAO = 500;
export const MAX_QUANTIDADE = 20;

/** Valor de uma célula já simplificado pelo leitor do .xlsx. */
export type ValorCelula = string | number | boolean | Date | null;
export type LinhaPlanilha = Partial<Record<ChaveColuna, ValorCelula>>;

/** Rótulo de cada evento na lista suspensa do modelo: "EVT-0195 · Bota Pra Correr RJ · 18/10/2026". */
export const rotuloEventoModelo = (e: Pick<EventoCarga, "codigo" | "nome" | "data">) => `${e.codigo} · ${e.nome} · ${e.data.slice(8, 10)}/${e.data.slice(5, 7)}/${e.data.slice(0, 4)}`;

const chaveTitulo = (s: string) =>
  normalizarTexto(s)
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
const POR_TITULO = new Map(COLUNAS_CARGA.map((c) => [chaveTitulo(c.titulo), c.chave]));
/** Cabeçalho da planilha → coluna (ignora acento, caixa e pontuação; coluna desconhecida = null). */
export const colunaDoTitulo = (titulo: string): ChaveColuna | null => POR_TITULO.get(chaveTitulo(titulo)) ?? null;

const texto = (v: ValorCelula | undefined) => (v == null ? "" : v instanceof Date ? "" : String(v)).trim();
export const linhaVazia = (l: LinhaPlanilha) => COLUNAS_CARGA.every((c) => texto(l[c.chave]) === "" && !(l[c.chave] instanceof Date));

const doisDig = (n: number) => String(n).padStart(2, "0");
const montar = (a: number, m: number, d: number, h: number, mi: number) => {
  const dt = new Date(Date.UTC(a, m - 1, d, h, mi));
  // Recusa 31/02, 25:00 etc. (a data "rolaria" para outro dia).
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return `${a}-${doisDig(m)}-${doisDig(d)}T${doisDig(h)}:${doisDig(mi)}`;
};

/**
 * Data e hora de uma célula → "AAAA-MM-DDTHH:mm" (hora local, como o formulário grava).
 * Aceita a célula de data do Excel (o leitor entrega a hora "de parede" em UTC), o número de série do
 * Excel e texto "dd/mm/aaaa hh:mm" (ou "dd/mm/aa", "hh:mm:ss", "AAAA-MM-DD hh:mm"). Data sem hora é erro:
 * o calendário precisa do horário.
 */
export function lerDataHora(v: ValorCelula | undefined): { valor: string } | { erro: string } {
  if (v == null || v === "") return { valor: "" };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { erro: "data inválida" };
    if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0) return { erro: "falta a hora" };
    return { valor: montar(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate(), v.getUTCHours(), v.getUTCMinutes() + (v.getUTCSeconds() >= 30 ? 1 : 0)) ?? "" };
  }
  if (typeof v === "number") {
    // Série do Excel: dias desde 30/12/1899, fração = hora.
    if (!(v > 1 && v < 100000)) return { erro: "data inválida" };
    if (Number.isInteger(v)) return { erro: "falta a hora" };
    return lerDataHora(new Date(Math.round((v - 25569) * 86_400_000)));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T,]+(\d{1,2})[:hH](\d{2})(?::\d{2})?)?$/);
  if (m) {
    if (m[4] === undefined) return { erro: "falta a hora" };
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const r = montar(ano, Number(m[2]), Number(m[1]), Number(m[4]), Number(m[5]));
    return r ? { valor: r } : { erro: `data inválida (${s})` };
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (m) {
    if (m[4] === undefined) return { erro: "falta a hora" };
    const r = montar(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
    return r ? { valor: r } : { erro: `data inválida (${s})` };
  }
  return { erro: `use dd/mm/aaaa hh:mm (veio "${s}")` };
}

const SINONIMOS_TAG: Record<string, TagCarga> = {
  KIT: "kit",
  KITS: "kit",
  "KIT DO ATLETA": "kit",
  CENO: "ceno",
  CENOGRAFIA: "ceno",
  ESTRUTURA: "estrutura",
  ESTRUTURAS: "estrutura",
  BOX: "estrutura",
  TENDA: "estrutura",
  TENDAS: "estrutura",
  PORTICO: "estrutura",
  ATIVACAO: "ativacao",
  ATIVACOES: "ativacao",
};

/** "kit, ceno" / "Kit; Estrutura" / "kit e ativação" → tags. Termo desconhecido é erro. */
export function lerTags(v: ValorCelula | undefined): { valor: TagCarga[] } | { erro: string } {
  const s = texto(v);
  if (!s) return { valor: [] };
  const partes = normalizarTexto(s)
    .split(/[,;/+|\n]|\s+E\s+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const tags: TagCarga[] = [];
  for (const p of partes) {
    const t = SINONIMOS_TAG[p];
    if (!t) return { erro: `"${p.toLowerCase()}" não existe (use: ${TAGS_CARGA.map((x) => (x === "ativacao" ? "ativação" : x)).join(", ")})` };
    if (!tags.includes(t)) tags.push(t);
  }
  return { valor: tags };
}

export function lerSimNao(v: ValorCelula | undefined): { valor: boolean } | { erro: string } {
  if (typeof v === "boolean") return { valor: v };
  const s = normalizarTexto(texto(v));
  if (["", "NAO", "N", "0", "FALSO", "FALSE", "-"].includes(s)) return { valor: false };
  if (["SIM", "S", "X", "1", "VERDADEIRO", "TRUE"].includes(s)) return { valor: true };
  return { erro: `use sim ou não (veio "${texto(v)}")` };
}

export function lerTipo(v: ValorCelula | undefined): { valor: TipoVeiculo } | { erro: string } {
  const s = normalizarTexto(texto(v))
    .replace(/^CAMINHAO\s+/, "")
    .trim();
  if (!s) return { erro: "falta o tipo (carreta, truck ou toco)" };
  const t = TIPOS_VEICULO.find((x) => x.toUpperCase() === s || (x === "truck" && s === "TRUCADO"));
  return t ? { valor: t } : { erro: `tipo "${texto(v)}" desconhecido (use carreta, truck ou toco)` };
}

export function lerQuantidade(v: ValorCelula | undefined): { valor: number } | { erro: string } {
  const s = texto(v);
  if (!s) return { valor: 1 };
  const n = Number(s.replace(",", "."));
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTIDADE) return { erro: `quantidade de 1 a ${MAX_QUANTIDADE} (veio "${s}")` };
  return { valor: n };
}

/**
 * Evento da célula: pelo código (o rótulo da lista começa por ele: "EVT-0195 · …") ou, sem código,
 * pelo nome exato (se só um evento tiver esse nome).
 */
export function lerEvento<E extends EventoCarga>(v: ValorCelula | undefined, eventos: readonly E[]): { valor: E } | { erro: string } {
  const s = texto(v);
  if (!s) return { erro: "falta o evento" };
  const cod = s.match(/^\s*([A-Za-z]{2,6}-\d{2,})\b/);
  if (cod) {
    const e = eventos.find((x) => x.codigo.toUpperCase() === cod[1].toUpperCase());
    return e ? { valor: e } : { erro: `evento ${cod[1].toUpperCase()} não encontrado` };
  }
  const alvo = normalizarTexto(s).replace(/\s+/g, " ");
  const achados = eventos.filter((x) => normalizarTexto(x.nome).replace(/\s+/g, " ") === alvo);
  if (achados.length === 1) return { valor: achados[0] };
  if (achados.length > 1) return { erro: `há ${achados.length} eventos "${s}": use o código (aba Eventos)` };
  return { erro: `evento "${s}" não encontrado: escolha na lista` };
}

export type LinhaInterpretada<E extends EventoCarga = EventoCarga> = {
  /** Número da linha na planilha (para a pessoa achar). */
  linha: number;
  evento: E | null;
  veiculo: DadosVeiculo | null;
  quantidade: number;
  erros: string[];
};

/**
 * Uma linha da planilha → veículo pronto para gravar (normalizado e validado como no formulário), ou a
 * lista de problemas, cada um com o nome da coluna. Destino da ida vazio = local do evento; tipo de
 * carga e "o que volta" vazios na volta = os da ida (o "Copiar carga da ida" do formulário).
 */
export function interpretarLinha<E extends EventoCarga & { ativo?: boolean }>(linha: number, l: LinhaPlanilha, eventos: readonly E[]): LinhaInterpretada<E> {
  const erros: string[] = [];
  const titulo = new Map(COLUNAS_CARGA.map((c) => [c.chave, c.titulo]));
  function pegar<T>(chave: ChaveColuna, r: { valor: T } | { erro: string }, padrao: T): T {
    if ("erro" in r) {
      erros.push(`${titulo.get(chave)}: ${r.erro}`);
      return padrao;
    }
    return r.valor;
  }
  const evento = (() => {
    const r = lerEvento(l.evento, eventos);
    if ("erro" in r) {
      erros.push(`Evento: ${r.erro}`);
      return null;
    }
    if (r.valor.ativo === false) erros.push(`Evento: ${r.valor.codigo} está encerrado ou cancelado e não recebe veículos`);
    return r.valor;
  })();
  const tipo = pegar("tipo", lerTipo(l.tipo), "truck" as TipoVeiculo);
  const quantidade = pegar("quantidade", lerQuantidade(l.quantidade), 1);
  const dh = (c: ChaveColuna) => pegar(c, lerDataHora(l[c]), "");
  const idaTags = pegar("idaTags", lerTags(l.idaTags), [] as TagCarga[]);
  const voltaTagsLidas = pegar("voltaTags", lerTags(l.voltaTags), [] as TagCarga[]);
  const idaCarga = texto(l.idaCarga);
  const voltaCarga = texto(l.voltaCarga);

  const ida = {
    ...idaVazia(texto(l.idaDestino) || evento?.local || ""),
    ativo: !pegar("idaDescartar", lerSimNao(l.idaDescartar), false),
    tags: idaTags,
    cargaTexto: idaCarga,
    inicioCarga: dh("idaInicioCarga"),
    fimCarga: dh("idaFimCarga"),
    saida: dh("idaSaida"),
    chegadaDestino: dh("idaChegada"),
    descarga: dh("idaDescarga"),
    obs: texto(l.idaObs),
  };
  const semCargaNaVolta = voltaTagsLidas.length === 0 && !voltaCarga;
  const volta = {
    ...voltaVazia(),
    ativo: !pegar("voltaDescartar", lerSimNao(l.voltaDescartar), false),
    tags: semCargaNaVolta ? idaTags : voltaTagsLidas,
    cargaTexto: semCargaNaVolta ? idaCarga : voltaCarga,
    inicioCarga: dh("voltaInicioCarga"),
    fimCarga: dh("voltaFimCarga"),
    saida: dh("voltaSaida"),
    destino: texto(l.voltaDestino) || "Galpão",
    chegadaGalpao: dh("voltaChegada"),
    descargaGalpao: dh("voltaDescarga"),
    obs: texto(l.voltaObs),
  };
  if (erros.length) return { linha, evento, veiculo: null, quantidade, erros };
  const veiculo = normalizarVeiculo({ tipo, ident: texto(l.ident), ida, volta });
  const problema = validarVeiculo(veiculo);
  if (problema) return { linha, evento, veiculo: null, quantidade, erros: [problema.mensagem] };
  return { linha, evento, veiculo, quantidade, erros: [] };
}

/** Mesmo cadastro (para não duplicar quando a mesma planilha é importada de novo). */
export const mesmoVeiculo = (a: DadosVeiculo, b: DadosVeiculo) => canonico(normalizarVeiculo(a)) === canonico(normalizarVeiculo(b));

/** JSON com as chaves em ordem (o jsonb do banco devolve as chaves em outra ordem). */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

/** Chave de um veículo num evento: veículos com a mesma chave são iguais. */
export const assinaturaVeiculo = (eventoId: string, v: DadosVeiculo) => `${eventoId}|${canonico(normalizarVeiculo(v))}`;

/**
 * Quantos veículos cada linha cria de fato. Para cada veículo igual (mesmo evento e mesmo cadastro), o
 * arquivo pede N (somando as linhas e a coluna Quantidade) e o evento já tem M: cria N − M. Assim
 * importar a mesma planilha de novo não duplica nada, e acrescentar uma linha cria só a nova.
 * As vagas já existentes são descontadas das primeiras linhas.
 */
export function planejarImportacao(
  linhas: ReadonlyArray<{ linha: number; eventoId: string; veiculo: DadosVeiculo; quantidade: number }>,
  existentes: ReadonlyArray<{ eventoId: string; veiculo: DadosVeiculo }>,
): Array<{ linha: number; novos: number; jaExistiam: number }> {
  const restantes = new Map<string, number>();
  for (const e of existentes) {
    const k = assinaturaVeiculo(e.eventoId, e.veiculo);
    restantes.set(k, (restantes.get(k) ?? 0) + 1);
  }
  return linhas.map((l) => {
    const k = assinaturaVeiculo(l.eventoId, l.veiculo);
    const ja = Math.min(l.quantidade, restantes.get(k) ?? 0);
    restantes.set(k, (restantes.get(k) ?? 0) - ja);
    return { linha: l.linha, novos: l.quantidade - ja, jaExistiam: ja };
  });
}
