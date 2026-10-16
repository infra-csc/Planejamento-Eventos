/**
 * Carga e descarga do galpão: veículos de cada evento, com ida e volta, e as operações que eles geram
 * no calendário da operação (o que sai, o que volta, quando e em quantos veículos). Substitui a
 * planilha "Resumo semanal de carga e descarga".
 *
 * Datas e horas são texto local de São Paulo ("AAAA-MM-DDTHH:mm", como o campo de data e hora do
 * navegador): a posição no calendário é a data local, sem conversão de fuso.
 *
 * Glossário: ida = caminhão sai do galpão para o evento; volta = retorna ao galpão. Carga (↑) = material
 * entrando no caminhão (na ida, no galpão; na volta, no evento). Descarga (↓) = material saindo do
 * caminhão (na ida, no destino; na volta, no galpão).
 */

export const TIPOS_VEICULO = ["carreta", "truck", "toco"] as const;
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number];
export const TIPO_VEICULO_LABEL: Record<TipoVeiculo, string> = { carreta: "Carreta", truck: "Truck", toco: "Toco" };

export const TAGS_CARGA = ["kit", "ceno", "estrutura", "ativacao"] as const;
export type TagCarga = (typeof TAGS_CARGA)[number];
export const TAG_CARGA_LABEL: Record<TagCarga, string> = { kit: "Kit", ceno: "Ceno", estrutura: "Estrutura", ativacao: "Ativação" };
export const TAG_CARGA_DICA: Record<TagCarga, string> = {
  kit: "Kit do atleta",
  ceno: "Cenografia",
  estrutura: "Box, tendas, pórtico, material de percurso",
  ativacao: "Ativação de patrocinador",
};

export type TrechoIda = {
  /** false = "descartar ida". */
  ativo: boolean;
  tags: TagCarga[];
  cargaTexto: string;
  inicioCarga: string;
  /** Aparece no card do calendário. */
  fimCarga: string;
  saida: string;
  destino: string;
  chegadaDestino: string;
  descarga: string;
  obs: string;
};

export type TrechoVolta = {
  /** false = "descartar volta". */
  ativo: boolean;
  tags: TagCarga[];
  cargaTexto: string;
  inicioCarga: string;
  /** Aparece no card do calendário. */
  fimCarga: string;
  saida: string;
  /** Padrão "Galpão". */
  destino: string;
  chegadaGalpao: string;
  /** Aparece no card do calendário. */
  descargaGalpao: string;
  obs: string;
};

export type DadosVeiculo = { tipo: TipoVeiculo; ident: string; ida: TrechoIda; volta: TrechoVolta };

export const idaVazia = (destino = ""): TrechoIda => ({ ativo: true, tags: [], cargaTexto: "", inicioCarga: "", fimCarga: "", saida: "", destino, chegadaDestino: "", descarga: "", obs: "" });
export const voltaVazia = (): TrechoVolta => ({ ativo: true, tags: [], cargaTexto: "", inicioCarga: "", fimCarga: "", saida: "", destino: "Galpão", chegadaGalpao: "", descargaGalpao: "", obs: "" });

/** Data e hora local válida ("AAAA-MM-DDTHH:mm") ou vazia. */
const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const CAMPOS_IDA = ["inicioCarga", "fimCarga", "saida", "chegadaDestino", "descarga"] as const;
const CAMPOS_VOLTA = ["inicioCarga", "fimCarga", "saida", "chegadaGalpao", "descargaGalpao"] as const;

/**
 * Regras de salvamento (as do protótipo validado): ao menos um trecho ativo; ida ativa com início ou
 * fim da carga; volta ativa com ao menos fim ou início da carga, chegada ou descarga no galpão; o fim da
 * carga não vem antes do início. Devolve a primeira mensagem de erro, com o campo, ou null.
 */
export function validarVeiculo(v: DadosVeiculo): { campo: string; mensagem: string } | null {
  if (!TIPOS_VEICULO.includes(v.tipo)) return { campo: "tipo", mensagem: "Escolha o tipo do veículo." };
  for (const c of CAMPOS_IDA) if (v.ida[c] && !DATA_HORA.test(v.ida[c])) return { campo: `ida.${c}`, mensagem: "Data e hora inválidas na ida." };
  for (const c of CAMPOS_VOLTA) if (v.volta[c] && !DATA_HORA.test(v.volta[c])) return { campo: `volta.${c}`, mensagem: "Data e hora inválidas na volta." };
  if (!v.ida.ativo && !v.volta.ativo) return { campo: "trechos", mensagem: "Mantenha a ida ou a volta: o veículo precisa de ao menos um trecho." };
  if (v.ida.ativo && !v.ida.inicioCarga && !v.ida.fimCarga) return { campo: "ida.inicioCarga", mensagem: "Na ida, informe o início ou o fim da carga no galpão." };
  if (v.ida.ativo && v.ida.inicioCarga && v.ida.fimCarga && v.ida.fimCarga < v.ida.inicioCarga) return { campo: "ida.fimCarga", mensagem: "Na ida, o fim da carga não pode ser antes do início." };
  if (v.volta.ativo && !v.volta.fimCarga && !v.volta.inicioCarga && !v.volta.chegadaGalpao && !v.volta.descargaGalpao) {
    return { campo: "volta.fimCarga", mensagem: "Na volta, informe ao menos o fim ou o início da carga, a chegada ou a descarga no galpão." };
  }
  if (v.volta.ativo && v.volta.inicioCarga && v.volta.fimCarga && v.volta.fimCarga < v.volta.inicioCarga) return { campo: "volta.fimCarga", mensagem: "Na volta, o fim da carga não pode ser antes do início." };
  return null;
}

/** Normaliza o que chega do formulário (texto aparado, tags conhecidas e sem repetir). */
export function normalizarVeiculo(v: DadosVeiculo): DadosVeiculo {
  const tags = (t: readonly string[]) => [...new Set(t)].filter((x): x is TagCarga => (TAGS_CARGA as readonly string[]).includes(x));
  const txt = (s: string, max: number) => String(s ?? "").trim().slice(0, max);
  return {
    tipo: v.tipo,
    ident: txt(v.ident, 120),
    ida: { ...v.ida, ativo: Boolean(v.ida.ativo), tags: tags(v.ida.tags), cargaTexto: txt(v.ida.cargaTexto, 500), destino: txt(v.ida.destino, 160), obs: txt(v.ida.obs, 2000) },
    volta: { ...v.volta, ativo: Boolean(v.volta.ativo), tags: tags(v.volta.tags), cargaTexto: txt(v.volta.cargaTexto, 500), destino: txt(v.volta.destino, 160) || "Galpão", obs: txt(v.volta.obs, 2000) },
  };
}

/* ------------------------------------------------------------------ */
/* Operações do calendário (derivadas; nada disso é gravado)            */
/* ------------------------------------------------------------------ */

export type TipoOperacao = "cargaGalpao" | "cargaDestino" | "descDestino" | "descGalpao" | "evento";
export const OPERACAO: Record<TipoOperacao, { direcao: "carga" | "descarga" | "evento"; rotulo: string; sub: string }> = {
  cargaGalpao: { direcao: "carga", rotulo: "Carga no galpão", sub: "Galpão · ida" },
  cargaDestino: { direcao: "carga", rotulo: "Carga no evento", sub: "No evento · volta" },
  descDestino: { direcao: "descarga", rotulo: "Descarga no destino", sub: "No destino · ida" },
  descGalpao: { direcao: "descarga", rotulo: "Descarga no galpão", sub: "Galpão · volta" },
  evento: { direcao: "evento", rotulo: "Evento", sub: "" },
};

export type EventoCarga = { id: string; codigo: string; nome: string; data: string; local: string | null };
export type VeiculoCarga = DadosVeiculo & { id: string; eventoId: string };

export type Operacao = {
  chave: string;
  data: string;
  tipo: TipoOperacao;
  origem: "cadastro" | "planilha";
  nome: string;
  tags: TagCarga[];
  /** Hora que o card mostra (fim da carga; descarga) e o rótulo dela. */
  hora: string;
  rotuloHora: string;
  /** Volta: "fim carga dd/mm hh:mm", no card da descarga no galpão. */
  extra: string;
  eventoId: string | null;
  veiculo: VeiculoCarga | null;
  /** Planilha: texto original, materiais entre parênteses e a coluna de onde veio. */
  bruto?: string;
  materiais?: string[];
  coluna?: "load" | "kit" | "unload" | "event";
  tokens?: Set<string>;
};

export const dataDe = (s: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
export const horaDe = (s: string) => (s && s.length >= 16 ? s.slice(11, 16) : "");
/** "14/10 08:00" (ou "14/10") a partir de "AAAA-MM-DDTHH:mm". */
export const dataHoraCurta = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}${s.length >= 16 ? ` ${s.slice(11, 16)}` : ""}` : "—");

/** As operações de um veículo (até 4): a regra do protótipo (`buildOps`). Trecho descartado não gera nada. */
export function operacoesDoVeiculo(v: VeiculoCarga, ev: EventoCarga): Operacao[] {
  const base = { origem: "cadastro" as const, nome: ev.nome, eventoId: ev.id, veiculo: v, extra: "" };
  const ops: Operacao[] = [];
  const i = v.ida;
  const o = v.volta;
  if (i.ativo) {
    const d1 = dataDe(i.inicioCarga) ?? dataDe(i.fimCarga) ?? dataDe(i.saida);
    if (d1) ops.push({ ...base, chave: `${v.id}:cargaGalpao`, data: d1, tipo: "cargaGalpao", tags: i.tags, hora: horaDe(i.fimCarga), rotuloHora: "fim carga" });
    const d2 = dataDe(i.descarga) ?? dataDe(i.chegadaDestino);
    if (d2) ops.push({ ...base, chave: `${v.id}:descDestino`, data: d2, tipo: "descDestino", tags: i.tags, hora: horaDe(i.descarga || i.chegadaDestino), rotuloHora: "descarga" });
  }
  if (o.ativo) {
    const d3 = dataDe(o.inicioCarga) ?? dataDe(o.fimCarga);
    if (d3) ops.push({ ...base, chave: `${v.id}:cargaDestino`, data: d3, tipo: "cargaDestino", tags: o.tags, hora: horaDe(o.fimCarga), rotuloHora: "fim carga" });
    const d4 = dataDe(o.descargaGalpao) ?? dataDe(o.chegadaGalpao);
    if (d4)
      ops.push({ ...base, chave: `${v.id}:descGalpao`, data: d4, tipo: "descGalpao", tags: o.tags, hora: horaDe(o.descargaGalpao || o.chegadaGalpao), rotuloHora: "descarga galpão", extra: o.fimCarga ? `fim carga ${dataHoraCurta(o.fimCarga)}` : "" });
  }
  return ops;
}

/* ------------------------------------------------------------------ */
/* Planilha 2026 (legado, somente leitura)                              */
/* ------------------------------------------------------------------ */

export type DiaPlanilha = { date: string; load: string[]; kit: string[]; unload: string[]; events: string[]; turnos: string | null; holiday: string | null };

export const normalizarTexto = (s: string) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Abreviações e erros de digitação da planilha (BSB, POA, BB…) → nome por extenso, para comparar nomes. */
const ABREV: Record<string, string> = {
  BSB: "BRASILIA", CWB: "CURITIBA", SSA: "SALVADOR", POA: "PORTO ALEGRE", RIB: "RIBEIRAO", PETRO: "PETROBRAS", BB: "BANCO DO BRASIL", LONG: "LONGEVIDADE",
  FLORIPA: "FLORIANOPOLIS", CPS: "CAMPINAS", REC: "RECIFE", FORT: "FORTALEZA", FOR: "FORTALEZA", BH: "BELO HORIZONTE", INV: "INVERNO", PIRA: "PIRACICABA",
  PINDA: "PINDAMONHANGABA", SJC: "SAO JOSE DOS CAMPOS", RJ: "RIO DE JANEIRO", SP: "SAO PAULO", BRAD: "BRADESCO", BRADSCO: "BRADESCO", BIIKE: "BIKE",
  PRIMAVEERA: "PRIMAVERA", TRIATHLHON: "TRIATLHON", TRIALHON: "TRIATLHON", TRIATHLON: "TRIATLHON", SANNTOS: "SANTOS", JANIERO: "JANEIRO", INVERO: "INVERNO",
  BRASLIA: "BRASILIA", IILHAS: "ILHAS", VIT: "VITORIA",
};
const STOP = new Set(["DE", "DO", "DA", "DOS", "DAS", "E", "RUN", "CORRIDA", "TOUR", "DESC", "ULTIMO", "CARRO", "DESAFIO", "I", ""]);

/** Palavras do nome, normalizadas (sem acento, abreviações por extenso, sem números e palavras vazias). */
export function tokens(s: string): Set<string> {
  const out = new Set<string>();
  normalizarTexto(s)
    .replace(/\([^)]*\)?/g, " ")
    .split(/[^A-Z0-9]+/)
    .forEach((w) => {
      if (/^\d+$/.test(w)) return;
      (ABREV[w] ?? w).split(" ").forEach((x) => {
        if (!STOP.has(x)) out.add(x);
      });
    });
  return out;
}
/** Todas as palavras de `a` estão em `b` (nome equivalente, um contido no outro). */
export const contido = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((x) => b.has(x));
export const nomesEquivalentes = (a: Set<string>, b: Set<string>) => contido(a, b) || contido(b, a);

/** "OUTONO RJ (BOX, TENDA)" → nome "OUTONO RJ" e materiais ["BOX", "TENDA"]. */
export function separarItem(txt: string): { nome: string; materiais: string[] } {
  const materiais: string[] = [];
  let nome = txt.replace(/\(([^)]*)\)?/g, (_, dentro: string) => {
    dentro
      .split(/,|\s+E\s+|\s+\+\s+/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => materiais.push(t));
    return " ";
  });
  nome = nome.replace(/\s+/g, " ").trim().replace(/[-–]\s*$/, "").trim();
  return { nome: nome || txt, materiais };
}

/** Tags inferidas do texto da planilha: KIT → kit, CENO → ceno, BOX/ESTRUTURA/TENDA → estrutura, ATIVAÇÃO → ativação. */
export function tagsDoTexto(t: string, coluna: string): TagCarga[] {
  const n = normalizarTexto(t);
  const s = new Set<TagCarga>();
  if (coluna === "kit" || /\bKIT\b/.test(n)) s.add("kit");
  if (/CENO/.test(n)) s.add("ceno");
  if (/\b(BOX|ESTRUTURA|TENDA|MAT PERCURSO|MATERIAL)\b/.test(n)) s.add("estrutura");
  if (/ATIVA/.test(n)) s.add("ativacao");
  return [...s];
}

/** Itens da planilha como operações (carregar estrutura e kit → carga no galpão; descarregar → descarga no galpão). */
export function operacoesDaPlanilha(dias: readonly DiaPlanilha[]): Operacao[] {
  const ops: Operacao[] = [];
  for (const d of dias) {
    const add = (tipo: TipoOperacao, t: string, coluna: Operacao["coluna"]) => {
      const s = separarItem(t);
      ops.push({
        chave: `p:${d.date}:${coluna}:${ops.length}`,
        data: d.date,
        tipo,
        origem: "planilha",
        nome: s.nome,
        tags: tagsDoTexto(t, coluna!),
        hora: "",
        rotuloHora: "",
        extra: "",
        eventoId: null,
        veiculo: null,
        bruto: t,
        materiais: s.materiais,
        coluna,
        tokens: tokens(t),
      });
    };
    d.load.forEach((t) => add("cargaGalpao", t, "load"));
    d.kit.forEach((t) => add("cargaGalpao", t, "kit"));
    d.unload.forEach((t) => add("descGalpao", t, "unload"));
    d.events.forEach((t) => add("evento", t, "event"));
  }
  return ops;
}

const diasEntre = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

/**
 * Todas as operações: as dos veículos cadastrados, o dia de cada evento com veículo e, se pedido, os itens
 * da planilha. Item da planilha com nome equivalente a um evento cadastrado (±30 dias) some: o cadastro
 * substitui a planilha.
 */
export function construirOperacoes(eventos: readonly EventoCarga[], veiculos: readonly VeiculoCarga[], planilha: readonly Operacao[] | null): Operacao[] {
  const porId = new Map(eventos.map((e) => [e.id, e]));
  const comVeiculo = new Set(veiculos.map((v) => v.eventoId));
  const cadastrados = eventos.filter((e) => comVeiculo.has(e.id)).map((e) => ({ ...e, tk: tokens(e.nome) }));
  const ops: Operacao[] = cadastrados.map((e) => ({ chave: `e:${e.id}`, data: e.data, tipo: "evento", origem: "cadastro", nome: e.nome, tags: [], hora: "", rotuloHora: "", extra: "", eventoId: e.id, veiculo: null }));
  for (const v of veiculos) {
    const ev = porId.get(v.eventoId);
    if (ev) ops.push(...operacoesDoVeiculo(v, ev));
  }
  if (planilha) {
    for (const l of planilha) {
      const substituido = cadastrados.some((e) => diasEntre(l.data, e.data) <= 30 && nomesEquivalentes(l.tokens!, e.tk));
      if (!substituido) ops.push(l);
    }
  }
  return ops;
}

/** Descarga da planilha: o evento de origem pelo nome, nos 30 dias antes ("← evento de dom 18 out"). */
export function origemDaDescarga(bruto: string, data: string, dias: readonly DiaPlanilha[]): string | null {
  const u = tokens(bruto);
  let melhor: string | null = null;
  for (const d of dias) {
    if (d.date >= data || diasEntre(d.date, data) > 30) continue;
    if (d.events.some((e) => nomesEquivalentes(u, tokens(e))) && (!melhor || d.date > melhor)) melhor = d.date;
  }
  return melhor;
}

export type FiltrosCarga = {
  direcao: "tudo" | "carga" | "descarga";
  /** Por evento (agrupa veículos do mesmo evento, operação e dia) ou por veículo. */
  ver: "evento" | "veiculo";
  tags: TagCarga[];
  eventos: boolean;
  soGalpao: boolean;
  planilha: boolean;
};
export const FILTROS_PADRAO: FiltrosCarga = { direcao: "tudo", ver: "evento", tags: [], eventos: true, soGalpao: false, planilha: true };

/** O item passa nos filtros? (`visible` do protótipo.) */
export function operacaoVisivel(op: Operacao, f: FiltrosCarga): boolean {
  if (op.tipo === "evento") return f.eventos;
  const dir = OPERACAO[op.tipo].direcao;
  if (f.direcao === "carga" && dir !== "carga") return false;
  if (f.direcao === "descarga" && dir !== "descarga") return false;
  if (f.soGalpao && (op.tipo === "descDestino" || op.tipo === "cargaDestino")) return false;
  if (f.tags.length && !op.tags.some((t) => f.tags.includes(t))) return false;
  if (f.ver === "veiculo" && op.origem === "planilha") return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Semanas                                                              */
/* ------------------------------------------------------------------ */

export const somarDias = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/** Segunda-feira da semana de `d`. */
export const segundaDe = (d: string) => somarDias(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
/** Número da semana ISO. */
export function semanaIso(d: string): number {
  const t = new Date(`${d}T12:00:00Z`);
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - y0) / 86_400_000 + 1) / 7);
}
