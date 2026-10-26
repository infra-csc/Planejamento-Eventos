import type { GrupoMaterial } from "@/domain/grupos-material";

/**
 * Folha de separação na ordem da "Sequência de materiais — lista de carregamento" da logística (26/10):
 * percurso, tendas 3×3 e 5×5 (com a cantoneira universal), box Q30, box Q15, estaio, ativação, arena, outros
 * materiais e marcenaria por assunto. Cada linha da lista acha a peça pelo código do catálogo; a marcenaria, que
 * tem muitos códigos, também pelo nome. Peça que a lista não cita entra no fim do bloco do grupo dela (marcenaria
 * sem lugar vai para "Itens específicos da prova"), em ordem alfabética.
 *
 * Regras da lista que não vêm da ata: cinta catraca = 4 por stand; corda = quantidade de malotes. Cavalete reto e
 * grade 2×1 já saem com o total (as regras da ata somam na mesma peça).
 */

export type PecaDaFolha = { pecaId: string; codigo: string; nome: string; unidade: string; total: number; setor: string; grupo: GrupoMaterial };
export type LinhaFolha = { chave: string; nome: string; unidade: string; total: number; nota?: string };
export type SecaoFolha = { id: string; titulo: string; /** Título do bloco maior (Marcenaria), quando a seção é parte dele. */ bloco?: string; linhas: LinhaFolha[] };

type Entrada = { codigos?: readonly string[]; nome?: RegExp };
type Secao = { id: string; titulo: string; bloco?: string; entradas: readonly Entrada[] };

const c = (...codigos: string[]): Entrada => ({ codigos });
const n = (nome: RegExp, ...codigos: string[]): Entrada => ({ nome, codigos });

const SECOES: readonly Secao[] = [
  { id: "percurso", titulo: "Materiais de percurso", entradas: [c("CAV-TRANSITO"), c("COCHO"), c("CAV-COCHO"), c("CONE-G"), c("CONE-P"), c("RAMPA-MAD")] },
  { id: "tendas-3x3", titulo: "Tendas 3×3", entradas: [c("TND3-LONA"), c("TND3-FECH"), c("TND3-TRAV"), c("TND3-PE"), c("TND3-MASTRO"), c("TND3-CABO")] },
  { id: "tendas-5x5", titulo: "Tendas 5×5", entradas: [c("TND5-LONA"), c("TND5-FECH"), c("TND5-TRAV"), c("TND5-PE"), c("TND5-MASTRO"), c("TND5-CABO"), c("TND5-CALHA"), c("TND5-CANT", "TND3-CANT")] },
  {
    id: "q30",
    titulo: "Estrutura (box Q30)",
    entradas: [
      ...["400", "500", "600", "700", "1000", "1300", "2000", "2500", "3000", "3500", "4000", "5000", "6000"].map((m) => c(`BOX-${m}`)),
      c("ANG-15"),
      c("ANG-45"),
      c("CUBO"),
      c("PARAF"),
      c("SAPATA"),
      c("GRAPPLE"),
      c("PRAT-2X1"),
      c("PRAT-1X1"),
      c("PE-100"),
      c("PE-DUPLO-100"),
      c("PE-060"),
      c("PE-058"),
      c("PE-054"),
      c("GC-1X1"),
      c("GC-2X1"),
    ],
  },
  {
    id: "q15",
    titulo: "Estrutura (box Q15)",
    entradas: [...["400", "500", "600", "700", "900", "1000", "2000", "3000", "4000", "5000"].map((m) => c(`Q15-${m}`)), c("Q15-CUBO"), c("Q15-PARAF"), c("Q15-SAPATA")],
  },
  { id: "estaio", titulo: "Estaio", entradas: [c("TINA-1000"), c("PALLET-FE"), c("CINTA-CATRACA"), c("MALOTE"), c("ESTACA"), c("CORDA")] },
  { id: "ativacao", titulo: "Ativação", entradas: [c("OMBRELONE"), c("PUFF"), c("TINA-300")] },
  {
    id: "arena",
    titulo: "Arena",
    entradas: [c("CARRINHO-PLAT"), c("ESCADA-ALU"), c("ESCADA-MAD"), c("GERADOR"), c("GRADE-2X1"), c("PE-GRADE-2X1"), c("CAV-RETO"), c("LIXEIRA-ARAM"), c("PALETEIRA"), c("QUADRO-METAL"), c("TINA-500")],
  },
  { id: "outros", titulo: "Outros materiais", entradas: [c("LONA-6X6"), c("LONA-9X6"), c("LONA-11X6"), c("LONA-15X6")] },
  {
    id: "mrc-estandes",
    bloco: "Marcenaria",
    titulo: "Estandes",
    entradas: [
      n(/^u? ?coluna frontal/, "COL-FRONTAL"),
      n(/tampa.*coluna/, "TAMPA-COL"),
      n(/coluna traseira/, "COL-TRAS"),
      n(/coluna central/),
      n(/testeira (de )?(stand )?9/, "TESTEIRA-9M"),
      n(/saia (de )?stand( 9)?/, "SAIA-STAND"),
      n(/testeira (de )?(stand )?11/),
      n(/saia (de )?stand 11/),
      n(/elezinho|anjo da guarda/, "ANJO-TESTEIRA"),
    ],
  },
  {
    id: "mrc-palco",
    bloco: "Marcenaria",
    titulo: "Palco",
    entradas: [
      n(/saia (de )?palco.*(frontal|4 ?m\b)/, "SAIA-PALCO-4M"),
      n(/saia (de )?palco.*(lateral|4,16)/, "SAIA-PALCO-416"),
      n(/fechamento.*(dj|bancada)/),
      n(/complemento.*rampa/),
      n(/acabamento lateral/, "ACAB-RAMPA"),
      n(/escada (nova|de palco)|escada palco/, "ESCADA-1M"),
      n(/podio/),
    ],
  },
  {
    id: "mrc-tendas",
    bloco: "Marcenaria",
    titulo: "Tendas e acessibilidade",
    entradas: [n(/rampa.*(acessibilidade|0,50)/, "RAMPA-ACESS"), n(/aterramento/), n(/testeira.*(tenda|madeira)/, "TND5-TESTEIRA")],
  },
  {
    id: "mrc-mesas",
    bloco: "Marcenaria",
    titulo: "Mesas e balcões",
    entradas: [n(/balcao/, "BALCAO-120"), n(/case com 5 pecas/), n(/pranchao/, "PRANCHAO-210", "PRANCHÃO-220"), n(/mesa/, "MESA-1X1")],
  },
  { id: "mrc-pisos", bloco: "Marcenaria", titulo: "Pisos e placas", entradas: [n(/^\d* ?pisos? (de madeira )?2 ?(m )?x ?1/), n(/trimandala|tapadeira/)] },
  { id: "mrc-prova", bloco: "Marcenaria", titulo: "Itens específicos da prova", entradas: [] },
  { id: "mrc-geral", bloco: "Marcenaria", titulo: "Geral", entradas: [n(/sarrafo/, "MACO-SARRAFO"), n(/calco/), n(/case.*marcenaria/, "CASE-MARC", "MRC-CASEMARCENARIA")] },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const ehStand = (nome: string) => /^(stand|estande)\b/.test(semAcento(nome));

/** Onde fica a peça que a lista não cita: o fim do bloco do grupo dela. */
function secaoDoResto(p: PecaDaFolha): string {
  if (p.setor === "MARCENARIA" && p.grupo === "ESTRUTURA") return "mrc-prova";
  if (p.codigo.startsWith("Q15-")) return "q15";
  if (p.codigo.startsWith("LONA-")) return "outros";
  if (["MALOTE", "ESTACA", "CORDA", "GANCHO-MALOTE"].includes(p.codigo)) return "estaio";
  const porGrupo: Record<GrupoMaterial, string> = { PERCURSO: "percurso", TENDAS: p.codigo.startsWith("TND3") ? "tendas-3x3" : "tendas-5x5", ESTRUTURA: p.setor === "MARCENARIA" ? "mrc-prova" : "q30", ATIVACAO: "ativacao", ARENA: "arena", OUTROS: "outros" };
  return porGrupo[p.grupo];
}

/**
 * As peças da OS (já somadas por peça) nas seções da folha. `stands`: quantos stands o evento leva (para a cinta
 * catraca); null quando a OS não tem a visão por projeto.
 */
export function montarFolhaSeparacao(pecas: readonly PecaDaFolha[], opcoes: { stands: number | null }): SecaoFolha[] {
  const usadas = new Set<string>();
  const linhas = new Map<string, LinhaFolha[]>(SECOES.map((s) => [s.id, []]));
  const linha = (p: PecaDaFolha): LinhaFolha => ({ chave: p.pecaId, nome: p.nome, unidade: p.unidade, total: p.total });
  const porNome = (a: LinhaFolha, b: LinhaFolha) => a.nome.localeCompare(b.nome, "pt-BR");

  // 1ª passada: só pelo código (o código vale mais que o nome de outra entrada).
  for (const s of SECOES)
    s.entradas.forEach((e, i) => {
      const achadas = pecas.filter((p) => !usadas.has(p.pecaId) && e.codigos?.includes(p.codigo));
      achadas.forEach((p) => usadas.add(p.pecaId));
      if (achadas.length) linhas.get(s.id)!.push(...achadas.map((p) => ({ ...linha(p), chave: `${i}|${p.pecaId}` })));
    });
  // 2ª passada: marcenaria pelo nome.
  for (const s of SECOES)
    s.entradas.forEach((e, i) => {
      if (!e.nome) return;
      const achadas = pecas.filter((p) => !usadas.has(p.pecaId) && p.setor === "MARCENARIA" && e.nome!.test(semAcento(p.nome)));
      achadas.forEach((p) => usadas.add(p.pecaId));
      linhas.get(s.id)!.push(...achadas.map((p) => ({ ...linha(p), chave: `${i}|${p.pecaId}` })));
    });
  // Ordem da lista: pela entrada, e dentro dela pelo nome.
  for (const [id, ls] of linhas) linhas.set(id, ls.sort((a, b) => Number(a.chave.split("|")[0]) - Number(b.chave.split("|")[0]) || porNome(a, b)));
  // O resto, no fim do bloco do grupo.
  const resto = new Map<string, LinhaFolha[]>();
  for (const p of pecas) if (!usadas.has(p.pecaId)) resto.set(secaoDoResto(p), [...(resto.get(secaoDoResto(p)) ?? []), { ...linha(p), chave: `r|${p.pecaId}` }]);
  for (const [id, ls] of resto) linhas.get(id)!.push(...ls.sort(porNome));

  // Regras da lista: cinta catraca (4 por stand) depois do pallet de ferro; corda = malotes.
  const estaio = linhas.get("estaio")!;
  if (opcoes.stands && !pecas.some((p) => p.codigo === "CINTA-CATRACA")) {
    const depois = estaio.findIndex((l) => /pallet/i.test(l.nome));
    estaio.splice(depois >= 0 ? depois + 1 : Math.min(2, estaio.length), 0, { chave: "cinta-catraca", nome: "Cinta catraca", unidade: "un", total: opcoes.stands * 4, nota: `4 por stand (${opcoes.stands} stand${opcoes.stands > 1 ? "s" : ""})` });
  }
  const malotes = pecas.find((p) => p.codigo === "MALOTE")?.total ?? 0;
  if (malotes > 0) {
    const corda = estaio.find((l) => pecas.find((p) => p.codigo === "CORDA" && l.chave.endsWith(`|${p.pecaId}`)));
    if (corda) Object.assign(corda, { total: malotes, nota: "= malotes" });
    else {
      const i = estaio.findIndex((l) => l.chave.endsWith(`|${pecas.find((p) => p.codigo === "ESTACA")?.pecaId ?? "-"}`));
      const j = i >= 0 ? i : estaio.findIndex((l) => l.chave.endsWith(`|${pecas.find((p) => p.codigo === "MALOTE")!.pecaId}`));
      estaio.splice(j + 1, 0, { chave: "corda", nome: "Corda", unidade: "un", total: malotes, nota: "= malotes" });
    }
  }

  return SECOES.map((s) => ({ id: s.id, titulo: s.titulo, bloco: s.bloco, linhas: linhas.get(s.id)! })).filter((s) => s.linhas.length > 0);
}

/** Quantos stands a OS leva (projetos "Stand…"/"Estande…"), para a cinta catraca; null sem a visão por projeto. */
export function standsDaOs(projetos: ReadonlyArray<{ nome: string; quantidade: number }> | undefined): number | null {
  if (!projetos) return null;
  return projetos.filter((p) => ehStand(p.nome)).reduce((a, p) => a + p.quantidade, 0);
}
