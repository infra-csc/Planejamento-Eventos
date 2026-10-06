/**
 * Separação dos materiais como na "Lista de materiais" da ata de reunião (planilhas de OS de 2026):
 * Estrutura (box truss, estandes, palcos, pórticos), Tendas, Ativação, Percurso e Arena. Item fora do
 * catálogo fica em "Outros" até a logística vincular. Usada na conferência, na ata e na OS.
 */
export const GRUPOS_MATERIAL = ["ESTRUTURA", "TENDAS", "ATIVACAO", "PERCURSO", "ARENA", "OUTROS"] as const;
export type GrupoMaterial = (typeof GRUPOS_MATERIAL)[number];

export const GRUPO_LABEL: Record<GrupoMaterial, string> = {
  ESTRUTURA: "Estrutura",
  TENDAS: "Tendas",
  ATIVACAO: "Ativação",
  PERCURSO: "Percurso",
  ARENA: "Arena",
  OUTROS: "Fora do catálogo",
};

/** Onde a planilha põe a peça, quando a família sozinha não diz (ex.: pallet de ferro fica no Percurso). */
const POR_CODIGO: Record<string, GrupoMaterial> = {
  // Contrapeso de stand e palco show: vai com a estrutura.
  "PALLET-FE": "ESTRUTURA",
  "TINA-1000": "ESTRUTURA",
  "PALLET-PL": "PERCURSO",
  "TINA-500": "ARENA",
  "CAV-RETO": "ATIVACAO",
  "MESA-1X1": "ARENA",
  "LONA-9X6": "ESTRUTURA",
  "TND5-TESTEIRA": "TENDAS",
  "SACO-RAFIA": "ARENA",
};

export function grupoDaPeca(p: { codigo: string; setor: string; familia?: string | null }): GrupoMaterial {
  const fixo = POR_CODIGO[p.codigo];
  if (fixo) return fixo;
  // Lonas de teto (estandes e palco show) vão com a estrutura.
  if (p.codigo.startsWith("LONA-")) return "ESTRUTURA";
  const familia = (p.familia ?? "").toLocaleLowerCase("pt-BR");
  if (p.setor === "TENDA" || familia.startsWith("tenda")) return "TENDAS";
  if (p.setor === "ESTRUTURA") return "ESTRUTURA";
  if (familia.includes("percurso")) return "PERCURSO";
  if (familia.includes("ativa") || familia.includes("mobili")) return "ATIVACAO";
  if (p.setor === "ARENA") return "ARENA";
  // Marcenaria de estande, palco e cenário vai junto com a estrutura que ela completa.
  return "ESTRUTURA";
}

export function grupoDoProjeto(p: { categoria?: string | null; nome?: string | null }): GrupoMaterial {
  // Grades de merchandising ficam na Arena da lista da ata, mesmo cadastradas como percurso.
  if (/grade de merchandising/i.test(p.nome ?? "")) return "ARENA";
  // Trimandala é box truss: vai com as estruturas, mesmo cadastrada como ativação.
  if (/trimandala/i.test(p.nome ?? "")) return "ESTRUTURA";
  const c = (p.categoria ?? "").toLocaleLowerCase("pt-BR");
  if (c.startsWith("tenda")) return "TENDAS";
  if (c.startsWith("ativa")) return "ATIVACAO";
  if (c.startsWith("percurso")) return "PERCURSO";
  if (c.startsWith("arena")) return "ARENA";
  return "ESTRUTURA";
}

/** Grupo de uma linha da ata: projeto pela categoria, peça pela família/setor, avulso em "Outros". */
export function grupoDaLinha(l: { tipo: string; projeto?: { categoria?: string | null; nome?: string | null } | null; peca?: { codigo: string; setor: string; familia?: string | null } | null }): GrupoMaterial {
  if (l.tipo === "PROJETO" && l.projeto) return grupoDoProjeto(l.projeto);
  if (l.tipo === "PECA" && l.peca) return grupoDaPeca(l.peca);
  return "OUTROS";
}

export const ordemGrupo = (g: GrupoMaterial) => GRUPOS_MATERIAL.indexOf(g);

/** Código da peça → grupo (lido do catálogo); peça que sumiu do catálogo cai pelo setor. */
export type MapaGrupos = Readonly<Record<string, GrupoMaterial>>;
export const grupoDoCodigo = (mapa: MapaGrupos, codigo: string, setor: string): GrupoMaterial => mapa[codigo] ?? grupoDaPeca({ codigo, setor });

/** Os totais da OS (gravados por setor) separados por grupo de material, na ordem da lista da ata. */
export function totaisPorGrupo<L extends { codigo: string }>(setores: ReadonlyArray<{ setor: string; linhas: readonly L[] }>, mapa: MapaGrupos): Array<{ grupo: GrupoMaterial; linhas: L[] }> {
  const m = new Map<GrupoMaterial, L[]>();
  for (const s of setores)
    for (const l of s.linhas) {
      const g = grupoDoCodigo(mapa, l.codigo, s.setor);
      m.set(g, [...(m.get(g) ?? []), l]);
    }
  return GRUPOS_MATERIAL.filter((g) => m.has(g)).map((g) => ({ grupo: g, linhas: m.get(g)! }));
}
