/*
 * UMMENSE → EVENTOS DO PLANEJAMENTO. O Planejamento não fala com o Ummense: lê uma FOTO
 * (src/data/ummense-eventos.json) gerada de um TSV extraído do Ummense ("Calendário 2026" + "Atribuir
 * Entregas") por scripts/importar-ummense.mjs — a mesma foto e as mesmas regras do Sistema Gráfica
 * (infra-csc/Sistema-Grafica, shared/eventos-sugeridos.ts e shared/ummense-foto.ts), sem a parte de
 * patrocinadores, que aqui não existe.
 *
 * "JÁ EXISTE NO PLANEJAMENTO?" Os nomes não se parecem ("Night Run - Etapa 1 - Belo Horizonte" no
 * Ummense, "Night Run BH" aqui). Três sinais sobre o nome normalizado:
 *   · DATA   — início do evento a ±3 dias da data do Ummense;
 *   · CIDADE — a cidade do Ummense no nome do evento (direto ou por apelido: BH, RJ, SP, POA…); nome
 *              sem cidade nenhuma é compatível com qualquer cidade, com OUTRA cidade não é;
 *   · MARCA  — a franquia (Night Run, Girl Power, Circuito das Estações…); fora da tabela, uma palavra
 *              própria de 4+ letras em comum.
 * Decisão (melhor deixar de sugerir do que duplicar): JÁ EXISTE (data ±3 + marca + cidade compatível)
 * some da lista; PODE EXISTIR (mesma cidade e data com marca diferente, ou mesma marca e cidade com a
 * data a até 45 dias) fica na lista, desmarcado e com o aviso; NOVO, o resto.
 *
 * A CIDADE vem do nome ("… - São Luís") ou das TAGS do Ummense (o Ummense não tem campo de cidade).
 *
 * REUNIÃO DE OS (Yan, 16/10): 35 dias antes do evento, sempre numa TERÇA — a terça no 35º dia antes ou
 * logo antes dele (nunca menos de 35 dias: prova de sábado → 39 dias, de domingo → 40), às 14:00.
 */

export interface PatrocinadorDoUmmense {
  nome: string;
  /** Como veio do Ummense: MASTER, GOLD, SILVER, APOIO, MIDIA, O2 PRIME, EXPO… */
  cota: string | null;
}

export interface EventoDoUmmense {
  /** Estável entre fotos enquanto nome e data não mudam: guarda o "Ignorar". */
  id: string;
  nome: string;
  /** "YYYY-MM-DD" */
  data: string;
  /** VERÃO, OUTONO, INVERNO, PRIMAVERA (Circuito das Estações) ou null. */
  estacao: string | null;
  cidade: string | null;
  /** O Ummense marca "DATA NÃO CONFIRMADA" nas tags. */
  dataNaoConfirmada: boolean;
  tags: string[];
  patrocinadores: PatrocinadorDoUmmense[];
}

export interface FotoDoUmmense {
  /** "YYYY-MM-DD": o dia em que a foto foi tirada. */
  fotoDe: string;
  origem: string;
  eventos: EventoDoUmmense[];
}

export interface EventoDoAppParaCasar {
  id: string;
  nome: string;
  /** "YYYY-MM-DD" (início do evento). */
  data: string;
  arquivado?: boolean;
}

export type SituacaoNoApp =
  | { tipo: "existe"; evento: EventoDoAppParaCasar; motivo: string }
  | { tipo: "talvez"; evento: EventoDoAppParaCasar; motivo: string }
  | { tipo: "novo" };

// ── Normalização ────────────────────────────────────────────────────────────

/** Sem acento, minúsculo, só letras/dígitos separados por UM espaço. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A frase inteira aparece no texto, como palavras inteiras (ambos normalizados). */
const contemFrase = (texto: string, frase: string) => !!frase && ` ${texto} `.includes(` ${frase} `);

// ── Cidades ─────────────────────────────────────────────────────────────────

/**
 * Cidades conhecidas (nome de exibição). As do calendário do Ummense e as que
 * aparecem nos eventos do app, mais capitais. "Porto Seguro" fica DE FORA de
 * propósito: é patrocinador ("Ativação Porto Seguro").
 */
export const CIDADES_CONHECIDAS = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Porto Alegre", "Curitiba", "Florianópolis",
  "Salvador", "Recife", "Fortaleza", "Belém", "Manaus", "São Luís", "Aracaju", "Maceió", "João Pessoa",
  "Natal", "Teresina", "Palmas", "Goiânia", "Cuiabá", "Campo Grande", "Vitória", "Vila Velha", "Serra",
  "Cariacica", "Fundão", "João Neiva", "Baixo Guandu", "Santos", "Campinas", "Ribeirão Preto",
  "São José dos Campos", "Indaiatuba", "Pirassununga", "Limeira", "Piracicaba", "Pindamonhangaba",
  "Londrina", "Foz do Iguaçu", "Campo Largo", "Navegantes", "Joinville", "Novo Hamburgo", "Rio Branco",
  "Porto Velho", "Macapá", "Boa Vista", "Itabira", "Nova Lima", "Mangaratiba", "Búzios", "Barra do Sahy",
  "Niterói", "Sorocaba", "Jundiaí", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo",
  "Uberlândia", "Juiz de Fora", "Blumenau", "Caxias do Sul", "Maringá", "Cascavel", "Petrolina",
  "Campina Grande", "Feira de Santana", "Balneário Camboriú", "Itajaí", "Cabo Frio", "Petrópolis", "Macaé",
  "Angra dos Reis", "Guarujá", "Bertioga", "Ubatuba", "Ilhabela", "Taubaté", "Bauru", "São Carlos",
  "Araraquara", "Americana", "Barueri", "Cotia", "Mogi das Cruzes", "Itu", "Atibaia",
] as const;

/** Apelidos (normalizados) → cidade normalizada. */
export const APELIDOS_DE_CIDADE: Record<string, string> = {
  bh: "belo horizonte",
  rj: "rio de janeiro",
  sp: "sao paulo",
  sampa: "sao paulo",
  poa: "porto alegre",
  bsb: "brasilia",
  floripa: "florianopolis",
  sjc: "sao jose dos campos",
  "sao luiz": "sao luis",
};

const CIDADE_POR_CHAVE = new Map<string, string>(CIDADES_CONHECIDAS.map((c) => [normalizar(c), c]));

/** Nome normalizado → cidade canônica (normalizada), resolvendo apelidos. */
export function cidadeCanonica(cidade: string | null | undefined): string | null {
  const n = normalizar(cidade);
  if (!n) return null;
  return APELIDOS_DE_CIDADE[n] ?? n;
}

/** Nome de exibição de uma cidade conhecida (ou null). */
export function exibicaoDaCidade(cidade: string): string | null {
  const c = cidadeCanonica(cidade);
  return c ? CIDADE_POR_CHAVE.get(c) ?? null : null;
}

/** É cidade conhecida (ou apelido de uma)? */
export function ehCidadeConhecida(texto: string): boolean {
  const c = cidadeCanonica(texto);
  return !!c && CIDADE_POR_CHAVE.has(c);
}

/**
 * Cidades citadas num nome (canônicas, normalizadas). Casa a frase MAIS LONGA
 * primeiro, consumindo as palavras: "Rio Branco" não deixa sobrar "rio".
 */
export function cidadesNoNome(nome: string): Set<string> {
  const tokens = normalizar(nome).split(" ").filter(Boolean);
  const achadas = new Set<string>();
  for (let i = 0; i < tokens.length; ) {
    let pulo = 0;
    for (let tam = Math.min(4, tokens.length - i); tam >= 1; tam--) {
      const frase = tokens.slice(i, i + tam).join(" ");
      const canon = APELIDOS_DE_CIDADE[frase] ?? frase;
      if (CIDADE_POR_CHAVE.has(canon)) { achadas.add(canon); pulo = tam; break; }
    }
    i += pulo || 1;
  }
  return achadas;
}

// ── Marcas ──────────────────────────────────────────────────────────────────

/**
 * As franquias, na ORDEM de teste (a primeira que casar vence): o mais
 * específico antes ("circuitinho" antes das Estações; "night run" antes de
 * qualquer "run"). Termos normalizados, casados como palavras inteiras.
 */
export const MARCAS: Array<{ chave: string; termos: string[] }> = [
  { chave: "circuitinho", termos: ["circuitinho"] },
  { chave: "night-run", termos: ["night run"] },
  { chave: "girl-power", termos: ["girl power"] },
  { chave: "eco-run", termos: ["eco run"] },
  { chave: "blue-run", termos: ["blue run"] },
  { chave: "bota-pra-correr", termos: ["bota pra correr", "bota para correr"] },
  { chave: "banco-do-brasil", termos: ["circuito banco do brasil", "banco do brasil"] },
  { chave: "s-run", termos: ["circuito s run", "s run", "srun"] },
  { chave: "treinao", termos: ["treinao", "running land"] },
  { chave: "desafio-petrobras", termos: ["desafio energia petrobras", "desafio petrobras"] },
  { chave: "viva-esporte", termos: ["viva esporte"] },
  { chave: "makai", termos: ["makai"] },
  { chave: "netshoes", termos: ["netshoes"] },
  { chave: "smart-fit", termos: ["smart fit", "smartfit"] },
  { chave: "running-hour", termos: ["running hour"] },
  { chave: "new-balance", termos: ["new balance"] },
  { chave: "longevidade", termos: ["longevidade bradesco", "longevidade"] },
  { chave: "trofeu-brasil", termos: ["trofeu brasil"] },
  { chave: "meia-de-sampa", termos: ["meia de sampa"] },
  { chave: "superhumans", termos: ["superhumans", "super humans"] },
  { chave: "ilumina", termos: ["ilumina running", "ilumina run"] },
  { chave: "agro-power", termos: ["agro power"] },
  { chave: "bravus", termos: ["bravus"] },
  { chave: "fuga-das-ilhas", termos: ["fuga das ilhas"] },
  { chave: "dpsp-run", termos: ["dpsp run"] },
  { chave: "circuito-vale", termos: ["circuito vale"] },
  // Por último: "Verão Campinas" é o Circuito das Estações no app.
  { chave: "estacoes", termos: ["circuito das estacoes", "circuito estacoes", "4 estacoes", "quatro estacoes", "verao", "outono", "inverno", "primavera"] },
];

const ESTACOES = ["verao", "outono", "inverno", "primavera"];

/** Palavras que não distinguem um evento de outro (fora da tabela de marcas). */
const PALAVRAS_GENERICAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "etapa", "edicao", "special", "edition",
  "corrida", "circuito", "run", "running", "race", "night", "desafio", "ano", "evento",
]);

export interface MarcaDoNome {
  chave: string | null;
  estacao: string | null;
  /** Palavras próprias (sem cidade, número e genéricas) — para quando uma das marcas é desconhecida. */
  palavras: Set<string>;
}

export function marcaDoNome(nome: string, estacao?: string | null): MarcaDoNome {
  const n = normalizar(nome);
  const marca = MARCAS.find((m) => m.termos.some((t) => contemFrase(n, t)));
  const est = normalizar(estacao) || ESTACOES.find((e) => contemFrase(n, e)) || null;
  // Palavras próprias: tira as cidades (frase inteira) antes de quebrar.
  let semCidade = ` ${n} `;
  const cidades = cidadesNoNome(nome);
  for (const c of Array.from(cidades)) semCidade = semCidade.split(` ${c} `).join(" ");
  for (const [apelido, c] of Object.entries(APELIDOS_DE_CIDADE)) if (cidades.has(c)) semCidade = semCidade.split(` ${apelido} `).join(" ");
  const palavras = new Set(
    semCidade.split(" ").filter((p) => p.length >= 4 && !/^\d+$/.test(p) && !PALAVRAS_GENERICAS.has(p)),
  );
  return { chave: marca?.chave ?? null, estacao: marca?.chave === "estacoes" ? est : null, palavras };
}

export function marcasBatem(a: MarcaDoNome, b: MarcaDoNome): boolean {
  if (a.chave && b.chave) {
    if (a.chave !== b.chave) return false;
    return !(a.estacao && b.estacao && a.estacao !== b.estacao);
  }
  return Array.from(a.palavras).some((p) => b.palavras.has(p));
}

// ── Datas ───────────────────────────────────────────────────────────────────

const diaMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
export const diasEntre = (a: string, b: string) => Math.round(Math.abs(diaMs(a) - diaMs(b)) / 86_400_000);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export const JANELA_DE_DATA = 3;
export const JANELA_DE_DATA_MUDADA = 45;

// ── O casamento de eventos ──────────────────────────────────────────────────

interface AppPreparado {
  ev: EventoDoAppParaCasar;
  n: string;
  cidades: Set<string>;
  marca: MarcaDoNome;
}

/**
 * Para cada evento da foto, a situação no app. Roda sobre a LISTA inteira
 * (e não um por vez) porque um evento do app reconhecido como "o mesmo" de uma
 * linha do Ummense deixa de valer como dúvida para as outras.
 */
export function casarComOApp(ummense: EventoDoUmmense[], app: EventoDoAppParaCasar[]): Map<string, SituacaoNoApp> {
  const preparados: AppPreparado[] = app.map((ev) => ({ ev, n: normalizar(ev.nome), cidades: cidadesNoNome(ev.nome), marca: marcaDoNome(ev.nome) }));
  const ativos = preparados.filter((p) => !p.ev.arquivado);
  const arquivados = preparados.filter((p) => p.ev.arquivado);

  const cidadeDe = (u: EventoDoUmmense) => cidadeCanonica(u.cidade);
  /** A cidade do Ummense está no nome do app (pela lista, ou escrita por extenso)? */
  const cidadeBate = (u: EventoDoUmmense, p: AppPreparado) => {
    const c = cidadeDe(u);
    return !!c && (p.cidades.has(c) || contemFrase(p.n, c));
  };
  const cidadeCompativel = (u: EventoDoUmmense, p: AppPreparado) => !cidadeDe(u) || p.cidades.size === 0 || cidadeBate(u, p);
  const mesmo = (u: EventoDoUmmense, mu: MarcaDoNome, p: AppPreparado) =>
    diasEntre(u.data, p.ev.data) <= JANELA_DE_DATA && marcasBatem(mu, p.marca) && cidadeCompativel(u, p);
  /** O mais provável primeiro: cidade escrita, depois a data mais perto. */
  const melhor = (u: EventoDoUmmense, lista: AppPreparado[]) =>
    [...lista].sort((a, b) =>
      Number(cidadeBate(u, b)) - Number(cidadeBate(u, a)) || diasEntre(u.data, a.ev.data) - diasEntre(u.data, b.ev.data),
    )[0];

  const marcas = new Map(ummense.map((u) => [u.id, marcaDoNome(u.nome, u.estacao)]));
  const situacoes = new Map<string, SituacaoNoApp>();
  const reconhecidos = new Set<string>();

  // 1ª passada: o que JÁ EXISTE.
  for (const u of ummense) {
    const cands = ativos.filter((p) => mesmo(u, marcas.get(u.id)!, p));
    if (cands.length === 0) continue;
    const p = melhor(u, cands);
    reconhecidos.add(p.ev.id);
    const dias = diasEntre(u.data, p.ev.data);
    situacoes.set(u.id, {
      tipo: "existe",
      evento: p.ev,
      motivo: `mesma marca${cidadeBate(u, p) ? " e cidade" : ""}, ${dias === 0 ? "mesma data" : `${dias} dia${dias > 1 ? "s" : ""} de diferença`}`,
    });
  }

  // 2ª passada: a DÚVIDA, só para quem não existe.
  for (const u of ummense) {
    if (situacoes.has(u.id)) continue;
    const mu = marcas.get(u.id)!;
    const livres = ativos.filter((p) => !reconhecidos.has(p.ev.id));
    // (c) Bateria, mas está arquivado.
    const arq = arquivados.filter((p) => mesmo(u, mu, p));
    if (arq.length) {
      const p = melhor(u, arq);
      situacoes.set(u.id, { tipo: "talvez", evento: p.ev, motivo: "evento parecido, arquivado no app" });
      continue;
    }
    // (a) Mesma cidade e data, marca diferente.
    const mesmaCidadeEData = livres.filter((p) => diasEntre(u.data, p.ev.data) <= JANELA_DE_DATA && cidadeBate(u, p));
    if (mesmaCidadeEData.length) {
      const p = melhor(u, mesmaCidadeEData);
      situacoes.set(u.id, { tipo: "talvez", evento: p.ev, motivo: `mesma cidade e data (${ddmm(p.ev.data)})` });
      continue;
    }
    // (b) Mesma marca e cidade, data mudada.
    const dataMudada = livres.filter((p) =>
      diasEntre(u.data, p.ev.data) <= JANELA_DE_DATA_MUDADA && marcasBatem(mu, p.marca) && cidadeBate(u, p));
    if (dataMudada.length) {
      const p = melhor(u, dataMudada);
      situacoes.set(u.id, { tipo: "talvez", evento: p.ev, motivo: `mesma marca e cidade, em ${ddmm(p.ev.data)} no app` });
      continue;
    }
    situacoes.set(u.id, { tipo: "novo" });
  }
  return situacoes;
}

// ── A foto (TSV do Ummense → JSON) ──────────────────────────────────────────

export const ORIGEM_PADRAO = "Ummense — Calendário 2026 + Atribuir Entregas";

/** Id estável: nome normalizado + data ("night-run-etapa-1-belem-2026-10-17"). */
export const idDoEventoDoUmmense = (nome: string, data: string) => `${normalizar(nome).replace(/ /g, "-")}-${data}`;

export function cidadeDoEvento(nome: string, tags: string[]): string | null {
  const partes = nome.split(" - ");
  const sufixo = partes.length > 1 ? partes[partes.length - 1].trim() : "";
  if (sufixo && !/^etapa\b/i.test(sufixo)) {
    if (ehCidadeConhecida(sufixo)) return exibicaoDaCidade(sufixo);
    if (tags.some((t) => normalizar(t) === normalizar(sufixo))) return sufixo;
  }
  const tag = tags.find((t) => ehCidadeConhecida(t));
  return tag ? exibicaoDaCidade(tag) : null;
}

/** "Nome:COTA|Nome:COTA" → lista, juntando nomes que tinham "|" dentro. */
export function lerPatrocinadores(cru: string): PatrocinadorDoUmmense[] {
  const saida: PatrocinadorDoUmmense[] = [];
  let pendente = "";
  for (const pedaco of (cru ?? "").split("|")) {
    const i = pedaco.lastIndexOf(":");
    const cota = i >= 0 ? pedaco.slice(i + 1).trim() : "";
    // Cota é CAIXA-ALTA ("MASTER", "O2 PRIME"); sem isso, é pedaço de nome.
    if (i < 0 || !cota || cota !== cota.toUpperCase()) {
      pendente = pendente ? `${pendente} | ${pedaco.trim()}` : pedaco.trim();
      continue;
    }
    const nome = (pendente ? `${pendente} | ${pedaco.slice(0, i).trim()}` : pedaco.slice(0, i)).trim();
    pendente = "";
    if (!nome) continue;
    if (saida.some((p) => normalizar(p.nome) === normalizar(nome))) continue;
    saida.push({ nome, cota });
  }
  if (pendente) saida.push({ nome: pendente, cota: null });
  return saida;
}

export function fotoDoTsv(tsv: string, fotoDe: string, origem = ORIGEM_PADRAO): FotoDoUmmense {
  const linhas = tsv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cab = (linhas.shift() ?? "").split("\t").map((c) => normalizar(c));
  const col = (nome: string) => {
    const i = cab.indexOf(nome);
    if (i < 0) throw new Error(`O TSV não tem a coluna "${nome}" (cabeçalho: ${cab.join(", ")}).`);
    return i;
  };
  const [iNome, iData, iEstacao, iTags, iPatr] = ["nome", "data", "estacao", "tags", "patrocinadores"].map(col);
  const eventos: EventoDoUmmense[] = [];
  const ids = new Set<string>();
  linhas.forEach((linha, n) => {
    const c = linha.split("\t");
    const nome = (c[iNome] ?? "").trim();
    const data = (c[iData] ?? "").trim();
    if (!nome) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`Linha ${n + 2} ("${nome}"): data "${data}" não é YYYY-MM-DD.`);
    const tags = (c[iTags] ?? "").split("|").map((t) => t.trim()).filter(Boolean);
    const id = idDoEventoDoUmmense(nome, data);
    if (ids.has(id)) return; // a mesma linha duas vezes
    ids.add(id);
    eventos.push({
      id,
      nome,
      data,
      estacao: (c[iEstacao] ?? "").trim() || null,
      cidade: cidadeDoEvento(nome, tags),
      dataNaoConfirmada: tags.some((t) => normalizar(t) === "data nao confirmada"),
      tags,
      patrocinadores: lerPatrocinadores(c[iPatr] ?? ""),
    });
  });
  eventos.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, "pt-BR"));
  return { fotoDe, origem, eventos };
}

// ── Reunião de OS sugerida ──────────────────────────────────────────────────

export const DIAS_ANTES_DA_REUNIAO = 35;
export const HORA_DA_REUNIAO = "14:00";

/**
 * Dia da reunião de OS para um evento em `data` ("AAAA-MM-DD"): a terça-feira no 35º dia antes do
 * evento ou a anterior mais próxima. Evento de sábado → terça 39 dias antes; de domingo → 40.
 */
export function reuniaoDoEvento(data: string): string {
  const d = new Date(diaMs(data) - DIAS_ANTES_DA_REUNIAO * 86_400_000);
  // getUTCDay: 0 = domingo … 2 = terça. Volta até a terça (0 dias se já for terça).
  const recuo = (d.getUTCDay() + 7 - 2) % 7;
  return new Date(d.getTime() - recuo * 86_400_000).toISOString().slice(0, 10);
}
