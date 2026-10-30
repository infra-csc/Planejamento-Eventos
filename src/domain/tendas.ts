/**
 * Tendas: como a cenografia pede hoje na planilha de OS de estrutura — por local, com a quantidade
 * de tendas, os fechamentos laterais e as calhas de união daquele local.
 *
 * Regra de domínio: um projeto é "de tenda" quando a lista de peças dele contém uma peça própria do tamanho
 * (fechamento, travessa, pé, mastro, cabo ou calha) de um dos kits abaixo (códigos do catálogo real,
 * scripts/dados/catalogo.ts). O tamanho da tenda vem do kit encontrado. A cantoneira é a mesma nos dois
 * tamanhos (cantoneira universal, 26/10) e por isso não diz o tamanho.
 *
 * Fechamento e calha variam por local. O fechamento não faz parte do padrão do projeto; a calha da
 * 5×5 faz (1 por tenda) e o quadro ajusta o total do local. O que não está no padrão (a lista de peças
 * de um projeto não aceita quantidade 0): entram como ajuste "extra" da linha, permitido só para as
 * peças por local do kit da própria tenda (ver `extrasPermitidosTenda`).
 */

import { ajustarDescricoes, descricoesEsperadas } from "./descricoes-itens";

export type PapelTenda = "fechamento" | "cantoneira" | "travessa" | "pe" | "mastro" | "cabo" | "calha";

/** Ordem e rótulo das colunas, como na planilha (FECHAMENTOS, CANTONEIRAS, TRAVESSA, PÉ, MASTRO, CABO, CALHA). */
export const PAPEIS_TENDA: ReadonlyArray<{ papel: PapelTenda; rotulo: string }> = [
  { papel: "fechamento", rotulo: "Fechamentos" },
  { papel: "cantoneira", rotulo: "Cantoneiras" },
  { papel: "travessa", rotulo: "Travessas" },
  { papel: "pe", rotulo: "Pés" },
  { papel: "mastro", rotulo: "Mastros" },
  { papel: "cabo", rotulo: "Cabos" },
  { papel: "calha", rotulo: "Calhas" },
];

/** Peças que variam por local: não estão no padrão do projeto e são pedidas como ajuste. */
export const PAPEIS_POR_LOCAL: readonly PapelTenda[] = ["fechamento", "calha"];

export type KitTenda = { tamanho: string; pecas: Partial<Record<PapelTenda, string>> };

/** Cantoneira universal: serve à tenda 3×3 e à 5×5 (26/10). Ficou com o código da antiga da 5×5. */
export const CANTONEIRA_UNIVERSAL = "TND5-CANT";
export const NOME_CANTONEIRA_UNIVERSAL = "Cantoneira universal";
/** Peças que viraram outra (código antigo → código atual): OS já geradas e listas antigas somam na atual. */
export const PECAS_UNIFICADAS: Readonly<Record<string, string>> = { "TND3-CANT": CANTONEIRA_UNIVERSAL };

export const KITS_TENDA: readonly KitTenda[] = [
  {
    tamanho: "5×5",
    pecas: { fechamento: "TND5-FECH", cantoneira: CANTONEIRA_UNIVERSAL, travessa: "TND5-TRAV", pe: "TND5-PE", mastro: "TND5-MASTRO", cabo: "TND5-CABO", calha: "TND5-CALHA" },
  },
  {
    tamanho: "3×3",
    pecas: { fechamento: "TND3-FECH", cantoneira: CANTONEIRA_UNIVERSAL, travessa: "TND3-TRAV", pe: "TND3-PE", mastro: "TND3-MASTRO", cabo: "TND3-CABO" },
  },
];

/** Kit da tenda do projeto (pela lista de peças), ou `null` quando o projeto não é de tenda. */
export function kitDaTenda(codigosBom: Iterable<string>): KitTenda | null {
  const codigos = new Set(codigosBom);
  // A cantoneira universal não diz o tamanho; a antiga da 3×3 (listas de antes de 26/10) ainda diz.
  if (codigos.has("TND3-CANT")) return KITS_TENDA.find((k) => k.tamanho === "3×3")!;
  return KITS_TENDA.find((k) => Object.entries(k.pecas).some(([papel, c]) => papel !== "cantoneira" && c && codigos.has(c))) ?? null;
}

export function ehProjetoTenda(codigosBom: Iterable<string>): boolean {
  return kitDaTenda(codigosBom) !== null;
}

/** Papel da peça no kit (fechamento, cantoneira…), ou `null` se não é peça do kit. */
export function papelNoKit(kit: KitTenda, codigo: string): PapelTenda | null {
  for (const { papel } of PAPEIS_TENDA) if (kit.pecas[papel] === codigo) return papel;
  return null;
}

/**
 * Códigos que podem entrar como ajuste mesmo fora da lista padrão do projeto: as peças por local
 * (fechamento, calha) do kit da própria tenda. Projeto que não é tenda: nenhum.
 */
export function extrasPermitidosTenda(codigosBom: Iterable<string>): string[] {
  const lista = [...codigosBom];
  const kit = kitDaTenda(lista);
  if (!kit) return [];
  return PAPEIS_POR_LOCAL.map((p) => kit.pecas[p]).filter((c): c is string => Boolean(c) && !lista.includes(c as string));
}

/**
 * Os ajustes de projeto valem por unidade. A planilha pede o total do local ("2 tendas, 5
 * fechamentos"), então o total é dividido entre as tendas do local o mais igual possível, e
 * tendas com a mesma divisão viram um grupo (uma linha): 2 tendas com 5 fechamentos →
 * 1 tenda com 3 e 1 com 2. A soma dos grupos sempre bate com os totais pedidos.
 */
export function dividirPorUnidade(quantidade: number, totais: readonly number[]): Array<{ quantidade: number; porUnidade: number[] }> {
  if (!Number.isInteger(quantidade) || quantidade <= 0) return [];
  const grupos: Array<{ quantidade: number; porUnidade: number[] }> = [];
  for (let u = 0; u < quantidade; u++) {
    const porUnidade = totais.map((t) => {
      const total = Math.max(0, Math.floor(t));
      return Math.floor(total / quantidade) + (u < total % quantidade ? 1 : 0);
    });
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.porUnidade.every((v, i) => v === porUnidade[i])) ultimo.quantidade++;
    else grupos.push({ quantidade: 1, porUnidade });
  }
  return grupos;
}

/**
 * Uma linha do quadro de tendas: o local, quantas tendas e, por papel, o total de peças do local.
 * Papel sem valor em `totais` segue o padrão (peças por tenda × tendas); quem digita outro número
 * sobrescreve, como na planilha.
 */
type DescricoesTenda = { descricoes?: string[]; semDescricao?: boolean };
export type LocalTenda = { local: string; quantidade: number; totais: Partial<Record<PapelTenda, number>> } & DescricoesTenda;

/**
 * Locais e quantidades de tendas mais comuns nas OS. O quadro abre com estes locais e 0 tendas (a quantidade comum
 * aparece ao lado, como referência); fechamentos e calhas também começam zerados. Linha com 0 tendas não vira item.
 */
export const LOCAIS_PADRAO_TENDA: Readonly<Record<string, readonly LocalTenda[]>> = {
  "5×5": [
    { local: "Depósito", quantidade: 1, totais: { fechamento: 0, calha: 0 } },
    { local: "GV", quantidade: 3, totais: { fechamento: 0, calha: 0 } },
    { local: "Dispersão", quantidade: 2, totais: { fechamento: 0, calha: 0 } },
    { local: "Médica", quantidade: 1, totais: { fechamento: 0, calha: 0 } },
    { local: "Extra", quantidade: 1, totais: { fechamento: 0, calha: 0 } },
  ],
  "3×3": [
    { local: "Buffet", quantidade: 1, totais: { fechamento: 0 } },
    { local: "Som", quantidade: 2, totais: { fechamento: 0 } },
    { local: "Crono", quantidade: 1, totais: { fechamento: 0 } },
    { local: "Limpeza", quantidade: 0, totais: { fechamento: 0 } },
    { local: "Extra", quantidade: 1, totais: { fechamento: 0 } },
  ],
};

/** Outros locais que aparecem com frequência nas OS: sugeridos ao digitar o local. */
export const LOCAIS_SUGERIDOS_TENDA: Readonly<Record<string, readonly string[]>> = {
  "5×5": ["Lixo", "Dispersão + Fruta", "Guarda-volumes", "Hidratação", "Credenciamento", "Vestiário", "Voluntários", "Premiação", "Fraldário", "Reciclagem", "Kit", "Foto", "Bicicletário", "Mecânica", "Área de sombra", "Recovery"],
  "3×3": ["Lixo", "Limpeza/carregadores", "Apoio", "Cronometragem", "Palco", "Médica", "Painel de LED", "Som palco", "House mix", "Área de descanso", "Video wall", "Equipe de filmagem", "Reciclagem", "Hidratação", "Segurança", "Estacionamento", "Food truck"],
};

/**
 * Linhas com que o quadro abre: os locais comuns, todos com 0 tendas. Antes vinham com a quantidade comum já
 * preenchida (8 tendas na 5×5) e quem só ajustava um local pedia tenda a mais nos outros (auditoria de usabilidade 28/10).
 */
export function locaisIniciaisTenda(tamanho: string): LocalTenda[] {
  const linhas = (LOCAIS_PADRAO_TENDA[tamanho] ?? []).map((l) => ({ ...l, quantidade: 0, totais: { ...l.totais } }));
  return linhas.length ? linhas : [novoLocalTenda()];
}

/** Quantas tendas o local costuma ter nas OS (referência ao lado do campo), ou 0. */
export function quantidadeComumTenda(tamanho: string, local: string): number {
  const alvo = local.trim().toLocaleLowerCase("pt-BR");
  return (LOCAIS_PADRAO_TENDA[tamanho] ?? []).find((l) => l.local.toLocaleLowerCase("pt-BR") === alvo)?.quantidade ?? 0;
}

export function novoLocalTenda(): LocalTenda {
  return { local: "", quantidade: 0, totais: { fechamento: 0, calha: 0 } };
}

type LinhaPadrao = { codigo: string; quantidade: number };

/** Peças por tenda que o padrão do projeto traz para o papel (fechamento e calha não estão no padrão: 0). */
export function padraoPorTenda(kit: KitTenda, bom: ReadonlyArray<LinhaPadrao>, papel: PapelTenda): number {
  const codigo = kit.pecas[papel];
  return codigo ? (bom.find((b) => b.codigo === codigo)?.quantidade ?? 0) : 0;
}

/** Total de peças do papel no local: o digitado, ou padrão × tendas. */
export function totalDoLocal(kit: KitTenda, bom: ReadonlyArray<LinhaPadrao>, l: LocalTenda, papel: PapelTenda): number {
  const digitado = l.totais[papel];
  if (digitado !== undefined) return Math.max(0, Math.floor(digitado));
  return padraoPorTenda(kit, bom, papel) * Math.max(0, l.quantidade);
}

/** Papéis que o kit tem, na ordem das colunas da planilha. */
export function papeisDoKit(kit: KitTenda): Array<{ papel: PapelTenda; rotulo: string; codigo: string }> {
  return PAPEIS_TENDA.flatMap(({ papel, rotulo }) => (kit.pecas[papel] ? [{ papel, rotulo, codigo: kit.pecas[papel]! }] : []));
}

/**
 * Prévia dos totais do quadro de tendas (como a linha TOTAL da planilha): soma do total de cada
 * local, por papel. Local com 0 tendas não conta.
 */
export function previaTendas(kit: KitTenda, bom: ReadonlyArray<LinhaPadrao>, locais: readonly LocalTenda[]): Array<{ papel: PapelTenda; rotulo: string; total: number }> {
  return papeisDoKit(kit).map(({ papel, rotulo }) => ({ papel, rotulo, total: locais.reduce((a, l) => a + (l.quantidade > 0 ? totalDoLocal(kit, bom, l, papel) : 0), 0) }));
}

export type ItemDoQuadro = { local: string; quantidade: number; ajustes: Record<string, number> } & DescricoesTenda;

/** Expande a descrição única (>50 unidades) antes de redistribuir as peças do kit. */
function descricoesDasUnidades(quantidade: number, lista?: readonly string[]): string[] {
  if (descricoesEsperadas("ADICIONAR", quantidade) === 1 && quantidade > 1) {
    return Array.from({ length: quantidade }, () => lista?.[0] ?? "");
  }
  return ajustarDescricoes(lista, quantidade);
}

function metadadosDescricao(quantidade: number, lista: string[], semDescricao: boolean): DescricoesTenda {
  return {
    semDescricao,
    descricoes: semDescricao && !lista.some((d) => d.trim()) ? [] : ajustarDescricoes(lista, descricoesEsperadas("ADICIONAR", quantidade)),
  };
}

/**
 * O quadro vira itens: um por local (ou mais, quando o total não divide igual entre as tendas do
 * local — ver `dividirPorUnidade`), com o ajuste por unidade de cada peça do kit em relação ao
 * padrão (código → delta; 0 não entra). Local sem tendas é ignorado.
 */
export function itensDoQuadro(kit: KitTenda, bom: ReadonlyArray<LinhaPadrao>, locais: readonly LocalTenda[]): ItemDoQuadro[] {
  const papeis = papeisDoKit(kit);
  const itens: ItemDoQuadro[] = [];
  for (const l of locais) {
    if (l.quantidade <= 0) continue;
    const totais = papeis.map(({ papel }) => totalDoLocal(kit, bom, l, papel));
    const temDescricao = l.descricoes !== undefined || l.semDescricao !== undefined;
    const descricoes = descricoesDasUnidades(l.quantidade, l.descricoes);
    const semDescricao = l.semDescricao ?? !l.descricoes?.some((d) => d.trim());
    let unidade = 0;
    for (const g of dividirPorUnidade(l.quantidade, totais)) {
      const ajustes: Record<string, number> = {};
      papeis.forEach(({ papel, codigo }, k) => {
        const delta = g.porUnidade[k] - padraoPorTenda(kit, bom, papel);
        if (delta !== 0) ajustes[codigo] = delta;
      });
      itens.push({
        local: l.local.trim().slice(0, 60),
        quantidade: g.quantidade,
        ajustes,
        ...(temDescricao ? metadadosDescricao(g.quantidade, descricoes.slice(unidade, unidade + g.quantidade), semDescricao) : {}),
      });
      unidade += g.quantidade;
    }
  }
  return itens;
}

/**
 * Caminho de volta do `itensDoQuadro`: os itens da tenda já na solicitação (um por local, ou mais de
 * um quando o total não dividia igual) viram de novo as linhas do quadro, somando por local. Só marca
 * como "digitado" o total que foge do padrão × tendas (o resto segue o padrão se mudar a quantidade).
 * `ajustes` por código da peça (delta por unidade).
 */
export function locaisDosItens(kit: KitTenda, bom: ReadonlyArray<LinhaPadrao>, itens: ReadonlyArray<{ destino: string; quantidade: number; ajustes: Record<string, number> } & DescricoesTenda>): LocalTenda[] {
  const papeis = papeisDoKit(kit);
  const norm = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
  const locais: Array<{ local: string; quantidade: number; somas: Partial<Record<PapelTenda, number>>; descricoes: string[]; semDescricao: boolean; temDescricao: boolean }> = [];
  for (const it of itens) {
    if (it.quantidade <= 0) continue;
    let l = locais.find((x) => norm(x.local) === norm(it.destino));
    if (!l) {
      l = { local: it.destino.trim(), quantidade: 0, somas: {}, descricoes: [], semDescricao: true, temDescricao: false };
      locais.push(l);
    }
    l.quantidade += it.quantidade;
    l.temDescricao ||= it.descricoes !== undefined || it.semDescricao !== undefined;
    l.semDescricao &&= it.semDescricao ?? !it.descricoes?.some((d) => d.trim());
    l.descricoes.push(...descricoesDasUnidades(it.quantidade, it.descricoes));
    for (const { papel, codigo } of papeis) l.somas[papel] = (l.somas[papel] ?? 0) + it.quantidade * Math.max(0, padraoPorTenda(kit, bom, papel) + (it.ajustes[codigo] ?? 0));
  }
  return locais.map((l) => ({
    local: l.local,
    quantidade: l.quantidade,
    totais: Object.fromEntries(papeis.flatMap(({ papel }) => (l.somas[papel] !== padraoPorTenda(kit, bom, papel) * l.quantidade ? [[papel, l.somas[papel]!]] : []))),
    ...(l.temDescricao ? metadadosDescricao(l.quantidade, l.descricoes, l.semDescricao) : {}),
  }));
}

/** Uma linha da ata com tendas de um local: quantas tendas e quantas peças de cada papel por tenda. */
export type LinhaTendaLocal = { id: string; quantidade: number; porUnidade: Partial<Record<PapelTenda, number>>; doPedido: boolean };
/** Parte de uma linha depois do quadro: a primeira fica na própria linha; as outras viram linhas novas da mesma área. */
export type ParteTenda = { quantidade: number; porUnidade: Partial<Record<PapelTenda, number>> };

/**
 * Quadro do local (tendas e totais de fechamento/calha) aplicado às linhas que já existem, sem trocar o dono de
 * nenhuma tenda (28/10: o quadro casava linhas pela posição, e mudar só os fechamentos tirava a tenda de uma área).
 *
 * - Tendas a mais vão para a linha da logística (sem pedido) ou, sem ela, para a primeira linha; tendas a menos saem
 *   primeiro das linhas da logística e depois das últimas linhas.
 * - Total de um papel que já bate com as linhas fica como está. Senão, cada tenda recebe a divisão inteira e o resto
 *   vai a linhas inteiras quando dá; quando não dá, uma linha se divide em duas partes (preferindo a da logística),
 *   e as duas continuam da mesma linha: a quantidade da linha (e do pedido) não muda por causa dos fechamentos.
 */
export function distribuirTendasDoLocal(
  linhas: readonly LinhaTendaLocal[],
  tendas: number,
  totais: Partial<Record<PapelTenda, number>>,
  papeis: readonly PapelTenda[],
): Array<{ id: string; partes: ParteTenda[] }> {
  const q = linhas.map((l) => l.quantidade);
  let diff = tendas - q.reduce((a, n) => a + n, 0);
  if (diff > 0 && linhas.length) {
    const i = linhas.findIndex((l) => !l.doPedido);
    q[i >= 0 ? i : 0] += diff;
  } else if (diff < 0) {
    const ordem = [...linhas.keys()].reverse().sort((a, b) => Number(linhas[a].doPedido) - Number(linhas[b].doPedido));
    for (const i of ordem) {
      const tira = Math.min(q[i], -diff);
      q[i] -= tira;
      diff += tira;
      if (diff === 0) break;
    }
  }
  type Parte = ParteTenda & { linha: number };
  const partes: Parte[] = linhas.flatMap((l, i) => (q[i] > 0 ? [{ linha: i, quantidade: q[i], porUnidade: { ...l.porUnidade } }] : []));
  const total = partes.reduce((a, p) => a + p.quantidade, 0);
  for (const papel of papeis) {
    const alvo = totais[papel];
    if (alvo === undefined || total === 0) continue;
    if (partes.reduce((a, p) => a + p.quantidade * (p.porUnidade[papel] ?? 0), 0) === alvo) continue;
    const base = Math.floor(alvo / total);
    let resto = alvo - base * total;
    for (const p of partes) p.porUnidade[papel] = base;
    if (!resto) continue;
    // Linhas inteiras que somam o resto (sem dividir nada), se existirem.
    const inteiras = subconjuntoQueSoma(partes.map((p) => p.quantidade), resto);
    if (inteiras) {
      for (const k of inteiras) partes[k].porUnidade[papel] = base + 1;
      continue;
    }
    // Senão, linhas inteiras enquanto cabem e uma dividida (a da logística primeiro, para não mexer no pedido).
    const ordem = [...partes.keys()].sort((a, b) => Number(linhas[partes[a].linha].doPedido) - Number(linhas[partes[b].linha].doPedido) || partes[b].quantidade - partes[a].quantidade);
    for (const k of ordem) {
      const p = partes[k];
      if (p.quantidade <= resto) {
        p.porUnidade[papel] = base + 1;
        resto -= p.quantidade;
      } else {
        partes.push({ linha: p.linha, quantidade: p.quantidade - resto, porUnidade: { ...p.porUnidade, [papel]: base } });
        p.quantidade = resto;
        p.porUnidade[papel] = base + 1;
        resto = 0;
      }
      if (!resto) break;
    }
  }
  return linhas.map((l, i) => ({ id: l.id, partes: partes.filter((p) => p.linha === i).map(({ quantidade, porUnidade }) => ({ quantidade, porUnidade })) }));
}

/** Índices de `valores` que somam exatamente `alvo` (o primeiro conjunto encontrado), ou null. */
function subconjuntoQueSoma(valores: readonly number[], alvo: number): number[] | null {
  const de = new Map<number, number[]>([[0, []]]);
  valores.forEach((v, i) => {
    for (const [soma, idx] of [...de]) if (soma + v <= alvo && !de.has(soma + v)) de.set(soma + v, [...idx, i]);
  });
  return de.get(alvo) ?? null;
}
