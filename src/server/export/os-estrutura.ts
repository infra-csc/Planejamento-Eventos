import type { OsConteudo, OsProjeto } from "@/server/db/schema";
import { kitDaTenda, PAPEIS_TENDA, type KitTenda } from "@/domain/tendas";

/*
 * OS de estrutura no formato exato da planilha da cenografia (OS ESTRUTURA_<evento>.xlsx, 193
 * arquivos de 2026): aba TOTAL com os blocos lado a lado (ESTRUTURAS e MARCENARIA em B:C; PEÇA em
 * E:F; TENDAS por local, OUTROS MATERIAIS, Q-15 KIT e ESTAIAMENTO de H em diante), aba SOMATORIA
 * ("RESUMO BOX TRUSS", peça × projeto) e uma aba por projeto com a quantidade POR UNIDADE.
 *
 * As peças aparecem com os rótulos que a cenografia usa (400, 500 … Cubos, Parafusos, Graple,
 * Plataforma Telescopica…), sempre na mesma ordem, inclusive as zeradas. Aqui só se monta a
 * estrutura de dados; a rota /api/os/[id]/estrutura desenha. Fonte única: o conteúdo da OS.
 */

/** Rótulo da planilha por código do catálogo (treliça Q30, conexões e praticável), na ordem do bloco PEÇA. */
export const ROTULOS_Q30: ReadonlyArray<[codigo: string, rotulo: string]> = [
  ["BOX-400", "400"],
  ["BOX-500", "500"],
  ["BOX-600", "600"],
  ["BOX-700", "700"],
  ["BOX-1000", "1000"],
  ["BOX-1300", "1300"],
  ["BOX-2000", "2000"],
  ["BOX-2500", "2500"],
  ["BOX-3000", "3000"],
  ["BOX-3500", "3500"],
  ["BOX-4000", "4000"],
  ["BOX-5000", "5000"],
  ["BOX-6000", "6000"],
  ["ANG-15", "ângulos 15"],
  ["ANG-45", "ângulo 45"],
  ["CUBO", "Cubos"],
  ["PARAF", "Parafusos"],
  ["GRAPPLE", "Graple"],
  ["PRAT-2X1", "Plataforma Telescopica 2M X 1M"],
  ["PRAT-1X1", "Plataforma Telescopica 1M X 1M"],
  ["PE-100", "Pé de 1 metro"],
  ["PE-DUPLO-100", "Pé rampa DUPLO de 1M"],
  ["PE-058", "Pé rampa 0,58m"],
  ["PE-054", "Pé rampa 0,54m"],
  ["GC-2X1", "Guarda-corpos rampa - 2M X 1M"],
  ["GC-1X1", "Guarda-corpos rampa - 1M X 1M"],
];

/** Bloco Q-15 KIT (e abas de projeto Q15): as linhas fixas da planilha; outros trechos Q15 entram depois. */
export const ROTULOS_Q15: ReadonlyArray<[codigo: string, rotulo: string]> = [
  ["Q15-500", "500"],
  ["Q15-1000", "1000"],
  ["Q15-2000", "2000"],
  ["Q15-3000", "3000"],
  ["Q15-CUBO", "CUBO"],
  ["Q15-PARAF", "PARAFUSO"],
];

/** Outras peças de estrutura que a planilha conhece por outro nome. */
const OUTROS_ROTULOS: Readonly<Record<string, string>> = {
  "BOX-300": "300",
  "CUBO-5F": "Cubo 5 faces",
  SAPATA: "Sapata",
  "PE-060": "Pé rampa 0,60m",
  "PE-084": "Pé 0,84m",
  "PE-067": "Pé 0,67m",
  "PE-050": "Pé 0,50m",
  "PE-037": "Pé 0,37m",
  "PE-025": "Pé 0,25m",
  SARGENTO: "Sargento",
  "Q15-SAPATA": "SAPATA Q15",
};

/** Bloco ESTAIAMENTO (H, abaixo de OUTROS MATERIAIS). */
const ESTAIAMENTO: ReadonlyArray<[codigo: string, rotulo: string]> = [
  ["MALOTE", "MALOTES"],
  ["ESTACA", "ESTACAS"],
  ["CORDA", "CORDAS"],
  ["GANCHO-MALOTE", "GANCHO P/ MALOTE"],
];

/**
 * Bloco OUTROS MATERIAIS: a lista fixa que toda OS traz (a cenografia marca "X" no que vai), com a
 * quantidade quando a peça está na OS. Itens fora do catálogo e peças soltas que não têm lugar
 * noutro bloco entram depois.
 */
const OUTROS_FIXOS: ReadonlyArray<{ rotulo: string; codigo?: string; marca?: "X" }> = [
  { rotulo: "LONA 9X6", codigo: "LONA-9X6" },
  { rotulo: "GARFO", codigo: "GARFO" },
  { rotulo: "MEDALHA", marca: "X" },
  { rotulo: "AGUA DE MONTAGEM" },
  { rotulo: "MARRETA 10KG", codigo: "MARRETA-10" },
  { rotulo: "CASE MARCENARIA", codigo: "CASE-MARC", marca: "X" },
  { rotulo: "CASE MONTAGEM", marca: "X" },
  { rotulo: "CASE DE PROD.", marca: "X" },
  { rotulo: "PONTOS DE ELÉTRICA" },
];

const ROTULO_Q30 = new Map(ROTULOS_Q30);
const ROTULO_Q15 = new Map(ROTULOS_Q15);
const CODIGOS_OUTROS_BLOCOS = new Set([...ESTAIAMENTO.map(([c]) => c), ...OUTROS_FIXOS.flatMap((o) => (o.codigo ? [o.codigo] : []))]);
const ehQ15 = (codigo: string) => codigo.startsWith("Q15-");
const ehTenda = (codigo: string) => codigo.startsWith("TND");

/** Rótulo da peça como na planilha; peça que a cenografia não nomeia sai com o nome do catálogo. */
export function rotuloPeca(codigo: string, nome: string): string {
  return ROTULO_Q30.get(codigo) ?? ROTULO_Q15.get(codigo) ?? OUTROS_ROTULOS[codigo] ?? nome;
}

export type LinhaRotulada = { codigo: string | null; rotulo: string; total: number };
export type BlocoTenda = {
  titulo: string;
  /** Depois de LOCAL e QTDE: FECHAMENTOS, CANTONEIRAS, TRAVESSA, PE, MASTRO, CABO (e CALHA na 5×5). */
  colunas: Array<{ codigo: string; rotulo: string }>;
  /** Uma linha por local, na ordem da ata; "EXTRA" quando sem local. */
  linhas: Array<{ local: string; quantidade: number; valores: number[] }>;
};
export type LinhaMarcenaria = { tipo: "secao"; nome: string; quantidade: number } | { tipo: "peca"; nome: string; total: number };
export type AbaProjeto = {
  nomeAba: string;
  codigo: string;
  /** Nome em maiúsculas, como a cenografia escreve em B3. */
  nome: string;
  quantidade: number;
  q15: boolean;
  /** Quantidade POR UNIDADE (a planilha multiplica na SOMATORIA); linha zerada fica em branco. */
  pecas: Array<{ rotulo: string; porUnidade: number }>;
  total: number;
  locais: Array<{ local: string; quantidade: number }>;
};

export type OsEstrutura = {
  /** Versão gravada antes da visão por projeto: só dá para somar por peça. */
  semProjetos: boolean;
  estruturas: Array<{ nome: string; quantidade: number }>;
  /** Bloco PEÇA | QTDE: as linhas fixas (mesmo zeradas) e depois o que mais houver de estrutura/arena. */
  pecas: LinhaRotulada[];
  totalPecas: number;
  /** Bloco Q-15 KIT (null quando a OS não tem treliça Q15). */
  q15: LinhaRotulada[] | null;
  estaiamento: LinhaRotulada[];
  outros: Array<{ rotulo: string; valor: number | "X" | null }>;
  marcenaria: LinhaMarcenaria[];
  tendas: BlocoTenda[];
  somatoria: {
    projetos: Array<{ nome: string; quantidade: number }>;
    /** Uma linha por rótulo do bloco PEÇA; EXTRAS = peças soltas (fora de projeto). */
    linhas: Array<{ rotulo: string; porProjeto: number[]; extras: number; total: number }>;
  };
  abas: AbaProjeto[];
};

export const SEM_LOCAL = "EXTRA";
export const ABAS_FIXAS = ["TOTAL", "SOMATORIA"];
const MAX_ABA = 31;

const localDe = (destino: string | null | undefined) => destino?.trim() || SEM_LOCAL;
const maiusculas = (s: string) => s.toLocaleUpperCase("pt-BR");

/**
 * Nome de aba válido no Excel: até 31 caracteres, sem []:*?/\, sem apóstrofo nas pontas e único
 * (o Excel compara sem diferenciar maiúsculas). O sufixo " (NX)" é preservado; corta-se o nome.
 */
export function nomeAba(nome: string, quantidade: number, usados: Set<string>): string {
  const limpo = nome.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().replace(/^'+|'+$/g, "").trim() || "Projeto";
  const sufixo = ` (${quantidade}X)`;
  for (let k = 1; ; k++) {
    const extra = k === 1 ? "" : ` ${k}`;
    const base = limpo.slice(0, Math.max(1, MAX_ABA - sufixo.length - extra.length)).trim().replace(/'+$/, "");
    const candidato = `${base}${extra}${sufixo}`.slice(0, MAX_ABA);
    const chave = candidato.toLocaleLowerCase("pt-BR");
    if (!usados.has(chave) && chave !== "history") {
      usados.add(chave);
      return candidato;
    }
  }
}

type Variante = { codigo: string; nome: string; quantidade: number; linhas: OsProjeto[]; kit: KitTenda | null; assinatura: string };

export function montarOsEstrutura(os: OsConteudo): OsEstrutura {
  const semProjetos = !os.projetos;
  const linhasProjeto = (os.projetos ?? []).filter((l) => l.quantidade > 0);

  /* ---------- Projetos: por código (ESTRUTURAS, SOMATORIA) e por lista de peças (abas) ---------- */
  const porCodigo = new Map<string, OsProjeto[]>();
  for (const l of linhasProjeto) porCodigo.set(l.codigo, [...(porCodigo.get(l.codigo) ?? []), l]);
  const projetos = [...porCodigo.entries()].map(([codigo, linhas]) => ({
    codigo,
    nome: linhas[0].nome,
    quantidade: linhas.reduce((a, l) => a + l.quantidade, 0),
    linhas,
    kit: kitDaTenda(linhas.flatMap((l) => l.pecas.map((p) => p.codigo))),
    q15: linhas.some((l) => l.pecas.some((p) => ehQ15(p.codigo))),
  }));
  const naoTenda = projetos.filter((p) => !p.kit);

  const estruturas = naoTenda.map((p) => ({ nome: maiusculas(p.nome), quantidade: p.quantidade }));

  /* ---------- Totais por peça (código → total), vindos do resumo por setor da OS ---------- */
  const totalPorCodigo = new Map<string, { nome: string; setor: string; total: number }>();
  for (const s of os.setores) for (const l of s.linhas) totalPorCodigo.set(l.codigo, { nome: l.nome, setor: s.setor, total: l.total });

  /* ---------- Bloco PEÇA: linhas fixas + o resto da estrutura/arena que não vai noutro bloco ---------- */
  const pecas: LinhaRotulada[] = ROTULOS_Q30.map(([codigo, rotulo]) => ({ codigo, rotulo, total: totalPorCodigo.get(codigo)?.total ?? 0 }));
  for (const [codigo, p] of totalPorCodigo) {
    // Só estrutura Q30: arena e marcenaria têm bloco próprio (OUTROS MATERIAIS / MARCENARIA).
    if (p.setor !== "ESTRUTURA" || ehTenda(codigo) || ehQ15(codigo) || ROTULO_Q30.has(codigo) || CODIGOS_OUTROS_BLOCOS.has(codigo)) continue;
    if (p.total > 0) pecas.push({ codigo, rotulo: rotuloPeca(codigo, p.nome), total: p.total });
  }
  const totalPecas = pecas.reduce((a, p) => a + p.total, 0);

  /* ---------- Q-15 KIT ---------- */
  const temQ15 = [...totalPorCodigo.keys()].some((c) => ehQ15(c) && (totalPorCodigo.get(c)?.total ?? 0) > 0);
  const q15: LinhaRotulada[] | null = temQ15
    ? [
        ...ROTULOS_Q15.map(([codigo, rotulo]) => ({ codigo, rotulo, total: totalPorCodigo.get(codigo)?.total ?? 0 })),
        ...[...totalPorCodigo].filter(([c, p]) => ehQ15(c) && !ROTULO_Q15.has(c) && p.total > 0).map(([c, p]) => ({ codigo: c, rotulo: rotuloPeca(c, p.nome), total: p.total })),
      ]
    : null;

  /* ---------- ESTAIAMENTO e OUTROS MATERIAIS ---------- */
  const estaiamento: LinhaRotulada[] = ESTAIAMENTO.map(([codigo, rotulo]) => ({ codigo, rotulo, total: totalPorCodigo.get(codigo)?.total ?? 0 }));
  const outros: OsEstrutura["outros"] = OUTROS_FIXOS.map((o) => {
    const total = o.codigo ? (totalPorCodigo.get(o.codigo)?.total ?? 0) : 0;
    return { rotulo: o.rotulo, valor: total > 0 ? total : (o.marca ?? null) };
  });
  const comLocal = (descricao: string, destino: string | null | undefined) => (destino?.trim() ? `${descricao} — ${destino.trim()}` : descricao);
  for (const x of os.semSetor) outros.push({ rotulo: maiusculas(comLocal(x.descricao, x.destino)), valor: x.quantidade });
  for (const s of os.setores) for (const x of s.avulsos) outros.push({ rotulo: maiusculas(comLocal(x.descricao, x.destino)), valor: x.quantidade });
  // Peças soltas que não têm linha em bloco nenhum (ex.: cone, grade, tina): entram aqui pelo nome.
  for (const x of os.individuais ?? []) {
    if (x.setor === "MARCENARIA" || ROTULO_Q30.has(x.codigo) || ehQ15(x.codigo) || ehTenda(x.codigo) || CODIGOS_OUTROS_BLOCOS.has(x.codigo) || pecas.some((p) => p.codigo === x.codigo)) continue;
    outros.push({ rotulo: maiusculas(comLocal(x.nome, x.destino)), valor: x.quantidade });
  }

  /* ---------- MARCENARIA: por projeto (seção com a quantidade) e depois o que foi pedido solto ---------- */
  const marcenaria: LinhaMarcenaria[] = [];
  const marcContada = new Map<string, number>();
  for (const p of projetos) {
    const porPeca = new Map<string, { nome: string; total: number }>();
    for (const l of p.linhas) for (const pc of l.pecas) if (pc.setor === "MARCENARIA") porPeca.set(pc.codigo, { nome: pc.nome, total: (porPeca.get(pc.codigo)?.total ?? 0) + pc.total });
    if (porPeca.size === 0) continue;
    marcenaria.push({ tipo: "secao", nome: maiusculas(p.nome), quantidade: p.quantidade });
    for (const [codigo, v] of porPeca) {
      marcenaria.push({ tipo: "peca", nome: maiusculas(v.nome), total: v.total });
      marcContada.set(codigo, (marcContada.get(codigo) ?? 0) + v.total);
    }
  }
  for (const [codigo, p] of totalPorCodigo) {
    if (p.setor !== "MARCENARIA") continue;
    const resto = p.total - (marcContada.get(codigo) ?? 0);
    if (resto > 0) marcenaria.push({ tipo: "peca", nome: maiusculas(p.nome), total: resto });
  }

  /* ---------- TENDAS por tamanho e local ---------- */
  const tamanhos = new Map<string, number>();
  for (const p of projetos) if (p.kit) tamanhos.set(p.kit.tamanho, (tamanhos.get(p.kit.tamanho) ?? 0) + 1);
  const ROTULO_PAPEL: Record<string, string> = { fechamento: "FECHAMENTOS", cantoneira: "CANTONEIRAS", travessa: "TRAVESSA", pe: "PE", mastro: "MASTRO", cabo: "CABO", calha: "CALHA" };
  const tendas: BlocoTenda[] = projetos
    .filter((p) => p.kit)
    .map((p) => {
      const kit = p.kit!;
      const colunas = PAPEIS_TENDA.filter(({ papel }) => kit.pecas[papel]).map(({ papel }) => ({ codigo: kit.pecas[papel]!, rotulo: ROTULO_PAPEL[papel] }));
      const porLocal = new Map<string, { quantidade: number; valores: number[] }>();
      for (const l of p.linhas) {
        const local = localDe(l.destino);
        const acc = porLocal.get(local) ?? { quantidade: 0, valores: colunas.map(() => 0) };
        acc.quantidade += l.quantidade;
        for (const pc of l.pecas) {
          const i = colunas.findIndex((c) => c.codigo === pc.codigo);
          if (i >= 0) acc.valores[i] += pc.total;
        }
        porLocal.set(local, acc);
      }
      const titulo = `TENDAS ${kit.tamanho.replace("×", "X")}${(tamanhos.get(kit.tamanho) ?? 0) > 1 ? ` · ${maiusculas(p.nome)}` : ""}`;
      return { titulo, colunas, linhas: [...porLocal.entries()].map(([local, v]) => ({ local, ...v })) };
    });

  /* ---------- SOMATORIA: rótulos do bloco PEÇA × projetos (sem tendas e sem Q15); EXTRAS = peças soltas ---------- */
  const colunasSomatoria = naoTenda.filter((p) => !p.q15);
  const somatoria: OsEstrutura["somatoria"] = {
    projetos: colunasSomatoria.map((p) => ({ nome: maiusculas(p.nome), quantidade: p.quantidade })),
    linhas: pecas.map((pc) => {
      const porProjeto = colunasSomatoria.map((p) => p.linhas.reduce((a, l) => a + (l.pecas.find((x) => x.codigo === pc.codigo)?.total ?? 0), 0));
      const deProjetos = porProjeto.reduce((a, v) => a + v, 0);
      return { rotulo: pc.rotulo, porProjeto, extras: Math.max(0, pc.total - deProjetos), total: pc.total };
    }),
  };

  /* ---------- Uma aba por projeto e por lista de peças (como "Trimandala (X1)" / "(X2)" na planilha) ---------- */
  const variantes: Variante[] = [];
  for (const p of naoTenda) {
    for (const l of p.linhas) {
      const assinatura = l.pecas.map((pc) => `${pc.codigo}:${pc.porUnidade}`).sort().join("|");
      const v = variantes.find((x) => x.codigo === p.codigo && x.assinatura === assinatura);
      if (v) {
        v.quantidade += l.quantidade;
        v.linhas.push(l);
      } else variantes.push({ codigo: p.codigo, nome: p.nome, quantidade: l.quantidade, linhas: [l], kit: null, assinatura });
    }
  }
  const usados = new Set(ABAS_FIXAS.map((n) => n.toLocaleLowerCase("pt-BR")));
  const abas: AbaProjeto[] = variantes.map((v) => {
    const q15 = v.linhas[0].pecas.some((pc) => ehQ15(pc.codigo));
    const fixas = q15 ? ROTULOS_Q15 : ROTULOS_Q30;
    const porUnidade = new Map<string, number>();
    // Só a estrutura: marcenaria, lona e contrapesos têm bloco próprio na aba TOTAL.
    for (const pc of v.linhas[0].pecas) if (pc.setor === "ESTRUTURA" && !ehTenda(pc.codigo) && !CODIGOS_OUTROS_BLOCOS.has(pc.codigo)) porUnidade.set(pc.codigo, pc.porUnidade);
    const lista: AbaProjeto["pecas"] = fixas.map(([codigo, rotulo]) => ({ rotulo, porUnidade: porUnidade.get(codigo) ?? 0 }));
    for (const [codigo, qtd] of porUnidade) if (!fixas.some(([c]) => c === codigo) && qtd > 0) lista.push({ rotulo: rotuloPeca(codigo, v.linhas[0].pecas.find((pc) => pc.codigo === codigo)!.nome), porUnidade: qtd });
    const locais = new Map<string, number>();
    for (const l of v.linhas) locais.set(localDe(l.destino), (locais.get(localDe(l.destino)) ?? 0) + l.quantidade);
    return {
      nomeAba: nomeAba(v.nome, v.quantidade, usados),
      codigo: v.codigo,
      nome: maiusculas(v.nome),
      quantidade: v.quantidade,
      q15,
      pecas: lista,
      total: lista.reduce((a, p) => a + p.porUnidade, 0),
      locais: [...locais.entries()].map(([local, quantidade]) => ({ local, quantidade })),
    };
  });

  return { semProjetos, estruturas, pecas, totalPecas, q15, estaiamento, outros, marcenaria, tendas, somatoria, abas };
}
