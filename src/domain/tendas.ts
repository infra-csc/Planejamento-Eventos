/**
 * Tendas: como a cenografia pede hoje na planilha de OS de estrutura — por local, com a quantidade
 * de tendas, os fechamentos laterais e as calhas de união daquele local.
 *
 * Regra de domínio: um projeto é "de tenda" quando a lista de peças dele contém a cantoneira ou o
 * fechamento de um dos kits abaixo (códigos do catálogo real, scripts/dados/catalogo.ts). O tamanho
 * da tenda vem do kit encontrado.
 *
 * Fechamento e calha variam por local, então não fazem parte do padrão do projeto (a lista de peças
 * de um projeto não aceita quantidade 0): entram como ajuste "extra" da linha, permitido só para as
 * peças por local do kit da própria tenda (ver `extrasPermitidosTenda`).
 */

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

export const KITS_TENDA: readonly KitTenda[] = [
  {
    tamanho: "5×5",
    pecas: { fechamento: "TND5-FECH", cantoneira: "TND5-CANT", travessa: "TND5-TRAV", pe: "TND5-PE", mastro: "TND5-MASTRO", cabo: "TND5-CABO", calha: "TND5-CALHA" },
  },
  {
    tamanho: "3×3",
    pecas: { fechamento: "TND3-FECH", cantoneira: "TND3-CANT", travessa: "TND3-TRAV", pe: "TND3-PE", mastro: "TND3-MASTRO", cabo: "TND3-CABO" },
  },
];

/** Kit da tenda do projeto (pela lista de peças), ou `null` quando o projeto não é de tenda. */
export function kitDaTenda(codigosBom: Iterable<string>): KitTenda | null {
  const codigos = new Set(codigosBom);
  return KITS_TENDA.find((k) => (k.pecas.cantoneira && codigos.has(k.pecas.cantoneira)) || (k.pecas.fechamento && codigos.has(k.pecas.fechamento))) ?? null;
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
export type LocalTenda = { local: string; quantidade: number; totais: Partial<Record<PapelTenda, number>> };

/**
 * Locais que a cenografia preenche em praticamente toda OS (192 OS de 2026), já com a quantidade de
 * tendas, fechamentos e calhas mais comum de cada um (moda nas OS): o quadro abre assim e quem
 * pede só ajusta — como na planilha. Limpeza aparece em 1 de cada 4 OS, por isso vem zerada; linha
 * com 0 tendas não vira item.
 */
export const LOCAIS_PADRAO_TENDA: Readonly<Record<string, readonly LocalTenda[]>> = {
  "5×5": [
    { local: "Depósito", quantidade: 1, totais: { fechamento: 4, calha: 1 } },
    { local: "GV", quantidade: 3, totais: { fechamento: 5, calha: 2 } },
    { local: "Dispersão", quantidade: 2, totais: { fechamento: 0, calha: 1 } },
    { local: "Médica", quantidade: 1, totais: { fechamento: 4, calha: 1 } },
    { local: "Extra", quantidade: 1, totais: { fechamento: 4, calha: 0 } },
  ],
  "3×3": [
    { local: "Buffet", quantidade: 1, totais: { fechamento: 3 } },
    { local: "Som", quantidade: 2, totais: { fechamento: 6 } },
    { local: "Crono", quantidade: 1, totais: { fechamento: 3 } },
    { local: "Limpeza", quantidade: 0, totais: { fechamento: 4 } },
    { local: "Extra", quantidade: 1, totais: { fechamento: 3 } },
  ],
};

/** Outros locais que aparecem com frequência nas OS: sugeridos ao digitar o local. */
export const LOCAIS_SUGERIDOS_TENDA: Readonly<Record<string, readonly string[]>> = {
  "5×5": ["Lixo", "Dispersão + Fruta", "Guarda-volumes", "Hidratação", "Credenciamento", "Vestiário", "Voluntários", "Premiação", "Fraldário", "Reciclagem", "Kit", "Foto", "Bicicletário", "Mecânica", "Área de sombra", "Recovery"],
  "3×3": ["Lixo", "Limpeza/carregadores", "Apoio", "Cronometragem", "Palco", "Médica", "Painel de LED", "Som palco", "House mix", "Área de descanso", "Video wall", "Equipe de filmagem", "Reciclagem", "Hidratação", "Segurança", "Estacionamento", "Food truck"],
};

export function locaisIniciaisTenda(tamanho: string): LocalTenda[] {
  const linhas = (LOCAIS_PADRAO_TENDA[tamanho] ?? []).map((l) => ({ ...l, totais: { ...l.totais } }));
  return linhas.length ? linhas : [novoLocalTenda()];
}

export function novoLocalTenda(): LocalTenda {
  return { local: "", quantidade: 0, totais: {} };
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

export type ItemDoQuadro = { local: string; quantidade: number; ajustes: Record<string, number> };

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
    for (const g of dividirPorUnidade(l.quantidade, totais)) {
      const ajustes: Record<string, number> = {};
      papeis.forEach(({ papel, codigo }, k) => {
        const delta = g.porUnidade[k] - padraoPorTenda(kit, bom, papel);
        if (delta !== 0) ajustes[codigo] = delta;
      });
      itens.push({ local: l.local.trim().slice(0, 60), quantidade: g.quantidade, ajustes });
    }
  }
  return itens;
}
