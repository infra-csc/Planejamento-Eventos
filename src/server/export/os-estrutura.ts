import type { OsConteudo, OsProjeto, Setor } from "@/server/db/schema";
import { kitDaTenda, PAPEIS_TENDA } from "@/domain/tendas";

/*
 * OS de estrutura no formato da planilha da cenografia (OS ESTRUTURA_<evento>.xlsx): aba TOTAL com
 * os blocos lado a lado (estruturas, peças, marcenaria, tendas por local, outros materiais), aba
 * SOMATÓRIA (peça × projeto) e uma aba por projeto. Aqui só se monta a estrutura de dados, sem
 * banco nem exceljs; a rota /api/os/[id]/estrutura desenha.
 *
 * Fonte única: o conteúdo da OS (o mesmo que a rota Excel usa), então os números batem com a OS.
 */

export type ProjetoQtd = { codigo: string; nome: string; quantidade: number };

export type BlocoTenda = {
  codigo: string;
  titulo: string;
  /** Colunas depois de LOCAL e QTDE: peças do kit na ordem da planilha, depois as outras (ex.: lona). */
  colunas: Array<{ codigo: string; rotulo: string }>;
  /** Uma linha por local (destino da linha da ata; "Sem local" quando vazio), na ordem da ata. */
  linhas: Array<{ local: string; quantidade: number; valores: number[] }>;
};

export type AbaProjeto = {
  nomeAba: string;
  codigo: string;
  nome: string;
  quantidade: number;
  locais: Array<{ local: string; quantidade: number }>;
  /** Alguma peça tem quantidade por unidade diferente entre as linhas (ajustes por local). */
  varia: boolean;
  pecas: Array<{ codigo: string; nome: string; unidade: string; porUnidade: number | null; total: number }>;
};

export type PecaTotal = { codigo: string; nome: string; setor: Setor; unidade: string; total: number };

export type OsEstrutura = {
  /** Versão gravada antes da visão por projeto: só dá para somar por peça. */
  semProjetos: boolean;
  /** Projetos que não são tenda, com quantas unidades (bloco ESTRUTURAS). */
  estruturas: ProjetoQtd[];
  /** Total por peça fora da marcenaria (estrutura, tendas, arena), como o bloco PEÇA | QTDE. */
  pecas: PecaTotal[];
  /** Total por peça de marcenaria (bloco MARCENARIA | QTDE da planilha). */
  marcenaria: PecaTotal[];
  /** Soma de todas as peças da OS (pecas + marcenaria). */
  totalPecas: number;
  tendas: BlocoTenda[];
  outros: Array<{ descricao: string; quantidade: number; local: string | null; tipo: "avulso" | "peca" }>;
  somatoria: {
    projetos: Array<{ codigo: string; nome: string; quantidade: number }>;
    linhas: Array<{ codigo: string; nome: string; porProjeto: number[]; extras: number; total: number }>;
  };
  abas: AbaProjeto[];
};

export const SEM_LOCAL = "Sem local";
export const ABAS_FIXAS = ["TOTAL", "SOMATÓRIA"];
const MAX_ABA = 31;

const localDe = (destino: string | null | undefined) => destino?.trim() || SEM_LOCAL;

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

export function montarOsEstrutura(os: OsConteudo): OsEstrutura {
  const semProjetos = !os.projetos;
  const linhasProjeto = os.projetos ?? [];

  // Projetos por código, na ordem em que aparecem na OS (ordem da ata).
  const porCodigo = new Map<string, OsProjeto[]>();
  for (const l of linhasProjeto) {
    if (l.quantidade <= 0) continue;
    const lista = porCodigo.get(l.codigo) ?? [];
    lista.push(l);
    porCodigo.set(l.codigo, lista);
  }
  const projetos = [...porCodigo.entries()].map(([codigo, linhas]) => ({
    codigo,
    nome: linhas[0].nome,
    quantidade: linhas.reduce((a, l) => a + l.quantidade, 0),
    linhas,
    kit: kitDaTenda(linhas.flatMap((l) => l.pecas.map((p) => p.codigo))),
  }));

  const estruturas: ProjetoQtd[] = projetos.filter((p) => !p.kit).map((p) => ({ codigo: p.codigo, nome: p.nome, quantidade: p.quantidade }));

  /* ---------- Peças (total por peça, na ordem da OS: setor, depois código) ---------- */
  const todas: PecaTotal[] = os.setores.flatMap((s) => s.linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, setor: s.setor, unidade: l.unidade, total: l.total })));
  const pecas = todas.filter((p) => p.setor !== "MARCENARIA");
  const marcenaria = todas.filter((p) => p.setor === "MARCENARIA");
  const totalPecas = todas.reduce((a, p) => a + p.total, 0);

  /* ---------- Tendas por tamanho (projeto) e local ---------- */
  const tamanhos = new Map<string, number>();
  for (const p of projetos) if (p.kit) tamanhos.set(p.kit.tamanho, (tamanhos.get(p.kit.tamanho) ?? 0) + 1);
  const tendas: BlocoTenda[] = projetos
    .filter((p) => p.kit)
    .map((p) => {
      const kit = p.kit!;
      const colunas: BlocoTenda["colunas"] = PAPEIS_TENDA.filter(({ papel }) => kit.pecas[papel]).map(({ papel, rotulo }) => ({ codigo: kit.pecas[papel]!, rotulo }));
      for (const l of p.linhas) for (const pc of l.pecas) if (!colunas.some((c) => c.codigo === pc.codigo)) colunas.push({ codigo: pc.codigo, rotulo: pc.nome });
      const porLocal = new Map<string, { quantidade: number; valores: number[] }>();
      for (const l of p.linhas) {
        const local = localDe(l.destino);
        const acc = porLocal.get(local) ?? { quantidade: 0, valores: colunas.map(() => 0) };
        acc.quantidade += l.quantidade;
        for (const pc of l.pecas) acc.valores[colunas.findIndex((c) => c.codigo === pc.codigo)] += pc.total;
        porLocal.set(local, acc);
      }
      const titulo = `TENDAS ${kit.tamanho}${(tamanhos.get(kit.tamanho) ?? 0) > 1 ? ` · ${p.nome}` : ""}`;
      return { codigo: p.codigo, titulo, colunas, linhas: [...porLocal.entries()].map(([local, v]) => ({ local, ...v })) };
    });

  /* ---------- Outros materiais: fora do catálogo e peças pedidas soltas ---------- */
  const outros: OsEstrutura["outros"] = [
    ...os.semSetor.map((x) => ({ descricao: x.descricao, quantidade: x.quantidade, local: x.destino?.trim() || null, tipo: "avulso" as const })),
    ...os.setores.flatMap((s) => s.avulsos.map((x) => ({ descricao: x.descricao, quantidade: x.quantidade, local: x.destino?.trim() || null, tipo: "avulso" as const }))),
    ...(os.individuais ?? []).map((x) => ({ descricao: `${x.codigo} · ${x.nome}`, quantidade: x.quantidade, local: x.destino?.trim() || null, tipo: "peca" as const })),
  ];

  /* ---------- SOMATÓRIA: peça × projeto; Extras = o que não veio de projeto (peças soltas) ---------- */
  const somatoria: OsEstrutura["somatoria"] = {
    projetos: projetos.map((p) => ({ codigo: p.codigo, nome: p.nome, quantidade: p.quantidade })),
    linhas: todas.map((pc) => {
      const porProjeto = projetos.map((p) => p.linhas.reduce((a, l) => a + (l.pecas.find((x) => x.codigo === pc.codigo)?.total ?? 0), 0));
      const deProjetos = porProjeto.reduce((a, v) => a + v, 0);
      return { codigo: pc.codigo, nome: pc.nome, porProjeto, extras: Math.max(0, pc.total - deProjetos), total: pc.total };
    }),
  };

  /* ---------- Uma aba por projeto ---------- */
  const usados = new Set(ABAS_FIXAS.map((n) => n.toLocaleLowerCase("pt-BR")));
  const abas: AbaProjeto[] = projetos.map((p) => {
    const ordem: AbaProjeto["pecas"] = [];
    for (const l of p.linhas) for (const pc of l.pecas) if (!ordem.some((x) => x.codigo === pc.codigo)) ordem.push({ codigo: pc.codigo, nome: pc.nome, unidade: pc.unidade, porUnidade: null, total: 0 });
    for (const x of ordem) {
      const porLinha = p.linhas.map((l) => l.pecas.find((pc) => pc.codigo === x.codigo)?.porUnidade ?? 0);
      x.porUnidade = porLinha.every((v) => v === porLinha[0]) ? porLinha[0] : null;
      x.total = p.linhas.reduce((a, l) => a + (l.pecas.find((pc) => pc.codigo === x.codigo)?.total ?? 0), 0);
    }
    const locais = new Map<string, number>();
    for (const l of p.linhas) locais.set(localDe(l.destino), (locais.get(localDe(l.destino)) ?? 0) + l.quantidade);
    return {
      nomeAba: nomeAba(p.nome, p.quantidade, usados),
      codigo: p.codigo,
      nome: p.nome,
      quantidade: p.quantidade,
      locais: [...locais.entries()].map(([local, quantidade]) => ({ local, quantidade })),
      varia: ordem.some((x) => x.porUnidade === null),
      pecas: ordem,
    };
  });

  return { semProjetos, estruturas, pecas, marcenaria, totalPecas, tendas, outros, somatoria, abas };
}
