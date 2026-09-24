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

export type LocalTenda = { local: string; quantidade: number; fechamentos: number; calhas: number };

/**
 * Locais que a cenografia preenche em praticamente toda OS (192 OS de 2026), já com a quantidade de
 * tendas, fechamentos e calhas mais comum de cada um (moda nas OS): o quadro abre assim e quem
 * pede só ajusta — como na planilha. Limpeza aparece em 1 de cada 4 OS, por isso vem zerada; linha
 * com 0 tendas não vira item.
 */
export const LOCAIS_PADRAO_TENDA: Readonly<Record<string, readonly LocalTenda[]>> = {
  "5×5": [
    { local: "Depósito", quantidade: 1, fechamentos: 4, calhas: 1 },
    { local: "GV", quantidade: 3, fechamentos: 5, calhas: 2 },
    { local: "Dispersão", quantidade: 2, fechamentos: 0, calhas: 1 },
    { local: "Médica", quantidade: 1, fechamentos: 4, calhas: 1 },
    { local: "Extra", quantidade: 1, fechamentos: 4, calhas: 0 },
  ],
  "3×3": [
    { local: "Buffet", quantidade: 1, fechamentos: 3, calhas: 0 },
    { local: "Som", quantidade: 2, fechamentos: 6, calhas: 0 },
    { local: "Crono", quantidade: 1, fechamentos: 3, calhas: 0 },
    { local: "Limpeza", quantidade: 0, fechamentos: 4, calhas: 0 },
    { local: "Extra", quantidade: 1, fechamentos: 3, calhas: 0 },
  ],
};

/** Outros locais que aparecem com frequência nas OS: sugeridos ao digitar o local. */
export const LOCAIS_SUGERIDOS_TENDA: Readonly<Record<string, readonly string[]>> = {
  "5×5": ["Lixo", "Dispersão + Fruta", "Guarda-volumes", "Hidratação", "Credenciamento", "Vestiário", "Voluntários", "Premiação", "Fraldário", "Reciclagem", "Kit", "Foto", "Bicicletário", "Mecânica", "Área de sombra", "Recovery"],
  "3×3": ["Lixo", "Limpeza/carregadores", "Apoio", "Cronometragem", "Palco", "Médica", "Painel de LED", "Som palco", "House mix", "Área de descanso", "Video wall", "Equipe de filmagem", "Reciclagem", "Hidratação", "Segurança", "Estacionamento", "Food truck"],
};

export function locaisIniciaisTenda(tamanho: string): LocalTenda[] {
  const linhas = (LOCAIS_PADRAO_TENDA[tamanho] ?? []).map((l) => ({ ...l }));
  return linhas.length ? linhas : [{ local: "", quantidade: 1, fechamentos: 0, calhas: 0 }];
}

/**
 * Prévia dos totais do quadro de tendas (como a linha TOTAL da planilha): peças do padrão × tendas,
 * mais fechamentos e calhas pedidos por local. Só os papéis que o kit tem.
 */
export function previaTendas(kit: KitTenda, bom: ReadonlyArray<{ codigo: string; quantidade: number }>, locais: readonly LocalTenda[]): Array<{ papel: PapelTenda; rotulo: string; total: number }> {
  const tendas = locais.reduce((a, l) => a + Math.max(0, l.quantidade), 0);
  return PAPEIS_TENDA.filter(({ papel }) => kit.pecas[papel]).map(({ papel, rotulo }) => {
    const padrao = bom.find((b) => b.codigo === kit.pecas[papel])?.quantidade ?? 0;
    const porLocal = papel === "fechamento" ? locais.reduce((a, l) => a + (l.quantidade > 0 ? Math.max(0, l.fechamentos) : 0), 0) : papel === "calha" ? locais.reduce((a, l) => a + (l.quantidade > 0 ? Math.max(0, l.calhas) : 0), 0) : 0;
    return { papel, rotulo, total: padrao * tendas + porLocal };
  });
}
