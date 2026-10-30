import type { AjusteBom, BomSnapshotLinha, OsConteudo, OsLinha, OsProjeto, OsSetor, Setor } from "@/server/db/schema";
import { SETORES } from "@/domain/constantes";
import { descricaoDaRegra } from "@/domain/regras-kit";
import { NOME_CANTONEIRA_UNIVERSAL, PECAS_UNIFICADAS } from "@/domain/tendas";

/**
 * RN-01: OS de um setor = Σ (BOM × quantidade do projeto no evento) + peças avulsas do setor.
 * Cálculo puro sobre as linhas ativas da ata (EventoItem).
 */

export type LinhaAta = {
  id: string;
  tipo: "PROJETO" | "PECA" | "AVULSO";
  quantidade: number;
  destino: string | null;
  areaNome: string | null;
  projeto?: { codigo: string; nome: string; versao: number; bom: BomSnapshotLinha[] } | null;
  peca?: { id: string; codigo: string; nome: string; setor: Setor; unidade: string } | null;
  descricaoLivre?: string | null;
  /** Linha criada por regra da logística (ex.: "grade-prisma"): a composição diz a regra em vez de "Peça solta · Logística". */
  regra?: string | null;
};

/**
 * O prisma comum são 2 grades 2×1, que a regra do prisma já soma na grade: nas leituras da OS (tela, Excel, folha)
 * ele não sai como item próprio. O prisma aéreo e os outros continuam.
 */
export const CODIGO_PRISMA_COMUM = "PRISMA";
export const semPrismaComum = <T extends { codigo: string }>(linhas: readonly T[]): T[] => linhas.filter((l) => l.codigo !== CODIGO_PRISMA_COMUM);

/** Nome atual de uma peça no catálogo (pelo id quando houver, senão pelo código); undefined = mantém o gravado. */
export type NomeAtual = (pecaId: string | undefined, codigo: string) => string | undefined;

/**
 * A OS com os nomes de hoje do catálogo: peça renomeada na Biblioteca (ex.: "Parafuso com porca…" → "Q30 -
 * PARAFUSOS") aparece com o nome novo também nas versões já gravadas e nas listas copiadas para o evento.
 */
export function renomearPecasOs(os: OsConteudo, nome: NomeAtual): OsConteudo {
  return {
    ...os,
    setores: os.setores.map((s) => ({ ...s, linhas: s.linhas.map((l) => ({ ...l, nome: nome(l.pecaId, l.codigo) ?? l.nome })) })),
    projetos: os.projetos?.map((p) => ({ ...p, pecas: p.pecas.map((x) => ({ ...x, nome: nome(undefined, x.codigo) ?? x.nome })) })),
    individuais: os.individuais?.map((x) => ({ ...x, nome: nome(undefined, x.codigo) ?? x.nome })),
  };
}

/**
 * Peças que viraram uma só (a cantoneira de tenda 3×3 entrou na universal, 26/10): nas OS gravadas antes, as linhas
 * da antiga passam para a atual e somam com ela.
 */
export function unificarPecasOs(os: OsConteudo): OsConteudo {
  const unificadas = new Set([...Object.keys(PECAS_UNIFICADAS), ...Object.values(PECAS_UNIFICADAS)]);
  const atual = (codigo: string) => PECAS_UNIFICADAS[codigo] ?? codigo;
  const nomeDe = (codigo: string, nome: string) => (unificadas.has(codigo) ? NOME_CANTONEIRA_UNIVERSAL : nome);
  const antiga = (codigo: string) => codigo in PECAS_UNIFICADAS;
  if (!os.setores.some((s) => s.linhas.some((l) => antiga(l.codigo))) && !os.projetos?.some((p) => p.pecas.some((x) => antiga(x.codigo))) && !os.individuais?.some((x) => antiga(x.codigo))) return os;
  const juntar = <T extends { codigo: string; nome: string }>(lista: readonly T[], somar: (a: T, b: T) => void): T[] => {
    const saida: T[] = [];
    for (const l of lista) {
      const codigo = atual(l.codigo);
      const ja = saida.find((x) => x.codigo === codigo);
      if (ja) somar(ja, l);
      else saida.push({ ...l, codigo, nome: nomeDe(l.codigo, l.nome) });
    }
    return saida;
  };
  return {
    ...os,
    setores: os.setores.map((s) => ({
      ...s,
      linhas: juntar(s.linhas, (a, b) => {
        a.total += b.total;
        a.origens = [...a.origens, ...b.origens];
      }),
    })),
    projetos: os.projetos?.map((p) => ({
      ...p,
      pecas: juntar(p.pecas, (a, b) => {
        a.porUnidade += b.porUnidade;
        a.total += b.total;
      }),
    })),
    individuais: os.individuais?.map((x) => ({ ...x, codigo: atual(x.codigo), nome: nomeDe(x.codigo, x.nome) })),
  };
}

/** A OS como é lida (tela, Excel, folha): sem o prisma comum nos totais e nas peças soltas; peças unificadas somadas. */
export function osParaLeitura(bruta: OsConteudo): OsConteudo {
  const os = unificarPecasOs(bruta);
  return {
    ...os,
    setores: os.setores.map((s) => ({ ...s, linhas: semPrismaComum(s.linhas) })).filter((s) => s.linhas.length > 0 || s.avulsos.length > 0),
    individuais: os.individuais ? semPrismaComum(os.individuais) : os.individuais,
  };
}

export const SETOR_LABEL: Record<Setor, string> = {
  ESTRUTURA: "Estrutura (box truss)",
  TENDA: "Tendas",
  MARCENARIA: "Marcenaria",
  ARENA: "Arena e percurso",
};

export function descricaoLinha(l: LinhaAta): string {
  if (l.tipo === "PROJETO" && l.projeto) return `${l.projeto.nome} (v${l.projeto.versao})`;
  if (l.tipo === "PECA" && l.peca) return `${l.peca.codigo} · ${l.peca.nome}`;
  return l.descricaoLivre ?? "Item fora do catálogo";
}

export function calcularOS(linhas: LinhaAta[]): OsConteudo {
  const porSetor = new Map<Setor, Map<string, OsLinha>>();
  const avulsosPorSetor = new Map<Setor, OsSetor["avulsos"]>();
  const semSetor: OsConteudo["semSetor"] = [];
  for (const s of SETORES) {
    porSetor.set(s, new Map());
    avulsosPorSetor.set(s, []);
  }

  // Projetos somados por origem ("Quadro de fotos · GV"): linhas iguais juntam peças E projetos. Antes a soma
  // juntava pelo texto com o "× N" da primeira linha: 4 quadros de 1 viravam "Quadro × 1 → 8" (auditoria 30/10, B-01).
  const projetosNaOrigem = new Map<string, number>();
  const acumular = (setor: Setor, peca: { id: string; codigo: string; nome: string; unidade: string }, qtd: number, origem: string, projetos?: number) => {
    const mapa = porSetor.get(setor)!;
    let linha = mapa.get(peca.id);
    if (!linha) {
      linha = { pecaId: peca.id, codigo: peca.codigo, nome: peca.nome, unidade: peca.unidade, total: 0, origens: [] };
      mapa.set(peca.id, linha);
    }
    linha.total += qtd;
    const chave = `${peca.id}|${origem}`;
    const n = projetos === undefined ? undefined : (projetosNaOrigem.get(chave) ?? 0) + projetos;
    if (n !== undefined) projetosNaOrigem.set(chave, n);
    const descricao = n === undefined ? origem : `${origem} × ${n}`;
    const existente = linha.origens.find((o) => o.descricao === origem || o.descricao.startsWith(`${origem} × `));
    if (existente) {
      existente.quantidade += qtd;
      existente.descricao = descricao;
    } else linha.origens.push({ descricao, quantidade: qtd });
  };

  const projetosOs: OsProjeto[] = [];
  const individuais: NonNullable<OsConteudo["individuais"]> = [];
  for (const l of linhas) {
    if (l.quantidade <= 0) continue;
    if (l.tipo === "PROJETO" && l.projeto) {
      // Com o local ("Tenda 5×5 m · GV × 3"): sem ele, a composição juntava locais diferentes pela quantidade.
      const origem = `${l.projeto.nome}${l.destino?.trim() ? ` · ${l.destino.trim()}` : ""}`;
      for (const b of l.projeto.bom) {
        acumular(b.setor, { id: b.pecaId, codigo: b.codigo, nome: b.nome, unidade: b.unidade }, b.quantidade * l.quantidade, origem, l.quantidade);
      }
      projetosOs.push({
        codigo: l.projeto.codigo,
        nome: l.projeto.nome,
        versao: l.projeto.versao,
        quantidade: l.quantidade,
        destino: l.destino,
        area: l.areaNome,
        pecas: [...l.projeto.bom]
          .sort((a, b) => SETORES.indexOf(a.setor) - SETORES.indexOf(b.setor) || a.codigo.localeCompare(b.codigo, "pt-BR"))
          .map((b) => ({ codigo: b.codigo, nome: b.nome, setor: b.setor, unidade: b.unidade, porUnidade: b.quantidade, total: b.quantidade * l.quantidade })),
      });
    } else if (l.tipo === "PECA" && l.peca) {
      // "Peça solta · Produção · GV": quem pediu (as regras da logística vêm sem área) e onde vai.
      const regra = l.regra ? descricaoDaRegra(l.regra) : null;
      const origem = regra ? `Regra: ${regra}` : ["Peça solta", l.areaNome ?? "Logística", l.destino?.trim() || null].filter(Boolean).join(" · ");
      acumular(l.peca.setor, l.peca, l.quantidade, origem);
      individuais.push({ codigo: l.peca.codigo, nome: l.peca.nome, setor: l.peca.setor, unidade: l.peca.unidade, quantidade: l.quantidade, destino: l.destino, area: l.areaNome });
    } else {
      semSetor.push({ descricao: l.descricaoLivre ?? "Item fora do catálogo", quantidade: l.quantidade, destino: l.destino, area: l.areaNome });
    }
  }

  const setores: OsSetor[] = SETORES.map((setor) => ({
    setor,
    linhas: [...porSetor.get(setor)!.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
    avulsos: avulsosPorSetor.get(setor)!,
  })).filter((s) => s.linhas.length > 0 || s.avulsos.length > 0);

  return { setores, semSetor, projetos: projetosOs, individuais };
}

export type DiffLinha = { codigo: string; nome: string; setor: Setor; antes: number; depois: number };

/** Compara duas versões de OS: o que mudou por peça (MEL-07). */
export function diffOS(antes: OsConteudo, depois: OsConteudo): DiffLinha[] {
  const idx = (os: OsConteudo) => {
    const m = new Map<string, { codigo: string; nome: string; setor: Setor; total: number }>();
    for (const s of os.setores) for (const l of s.linhas) m.set(l.pecaId, { codigo: l.codigo, nome: l.nome, setor: s.setor, total: l.total });
    return m;
  };
  const a = idx(antes);
  const b = idx(depois);
  const chaves = new Set([...a.keys(), ...b.keys()]);
  const out: DiffLinha[] = [];
  for (const k of chaves) {
    const la = a.get(k);
    const lb = b.get(k);
    const antesQ = la?.total ?? 0;
    const depoisQ = lb?.total ?? 0;
    if (antesQ !== depoisQ) {
      const ref = (lb ?? la)!;
      out.push({ codigo: ref.codigo, nome: ref.nome, setor: ref.setor, antes: antesQ, depois: depoisQ });
    }
  }
  return out.sort((x, y) => x.codigo.localeCompare(y.codigo, "pt-BR"));
}

/** Resumo de uma versão igual à anterior (gravado no banco: a tela troca por "igual à vN"). */
export const RESUMO_SEM_MUDANCA = "sem mudança nas quantidades";

/**
 * Resumo curto de uma diferença de OS: "BOX-600 +4 · CUBO −2 · e mais 3 peças". O fim era "· +3", lido como mais uma
 * quantidade (auditoria 30/10, B-17).
 */
function resumirDiff(diff: DiffLinha[]): string {
  if (diff.length === 0) return RESUMO_SEM_MUDANCA;
  const partes = diff.slice(0, 3).map((d) => `${d.codigo} ${d.depois - d.antes > 0 ? "+" : "−"}${Math.abs(d.depois - d.antes)}`);
  const resto = diff.length - 3;
  return partes.join(" · ") + (resto > 0 ? ` · e mais ${resto} ${resto === 1 ? "peça" : "peças"}` : "");
}

/** Texto da lista de versões: o que mudou em relação à anterior, ou o tamanho da primeira. */
export function resumoVersaoOs(anterior: OsConteudo | null, atual: OsConteudo): string {
  if (!anterior) {
    const n = atual.setores.reduce((a, s) => a + s.linhas.length, 0);
    return `${n} ${n === 1 ? "tipo de peça" : "tipos de peça"}`;
  }
  return resumirDiff(diffOS(anterior, atual));
}

/**
 * Lista padrão do projeto com os ajustes da solicitação aplicados (delta por peça, nunca abaixo de zero).
 * Peça fora do padrão só entra quando o ajuste é uma peça extra validada pelo serviço (traz setor e
 * unidade: fechamento e calha de tenda); qualquer outra é ignorada.
 */
export function aplicarAjustesBom(bom: BomSnapshotLinha[], ajustes: AjusteBom[] | null | undefined): BomSnapshotLinha[] {
  if (!ajustes || ajustes.length === 0) return bom;
  const delta = new Map(ajustes.map((a) => [a.pecaId, a.quantidade]));
  const ajustada = bom.map((l) => ({ ...l, quantidade: Math.max(0, l.quantidade + (delta.get(l.pecaId) ?? 0)) })).filter((l) => l.quantidade > 0);
  const extras = ajustes
    .filter((a) => a.setor && a.quantidade > 0 && !bom.some((l) => l.pecaId === a.pecaId))
    .map((a) => ({ pecaId: a.pecaId, codigo: a.codigo, nome: a.nome, setor: a.setor!, unidade: a.unidade ?? "un", quantidade: a.quantidade }));
  return extras.length ? [...ajustada, ...extras] : ajustada;
}

/** "+2 Praticável 2×1 · −1 Cubo" — para mostrar o que o solicitante mudou no projeto. */
export function resumirAjustes(ajustes: AjusteBom[] | null | undefined): string | null {
  if (!ajustes || ajustes.length === 0) return null;
  return ajustes
    .filter((a) => a.quantidade !== 0)
    .map((a) => `${a.quantidade > 0 ? "+" : "−"}${Math.abs(a.quantidade)} ${a.nome}`)
    .join(" · ");
}

type PecaSolta = NonNullable<OsConteudo["individuais"]>[number];
export type PecaSoltaAgrupada = Omit<PecaSolta, "destino" | "area"> & { locais: Array<{ destino: string | null; area: string | null; quantidade: number }> };

/**
 * Peças soltas somadas por código (o mesmo cavalete pedido por duas áreas vira uma linha com o total),
 * com cada local e área ao lado. Em ordem alfabética do nome.
 */
export function individuaisAgrupadas(xs: readonly PecaSolta[]): PecaSoltaAgrupada[] {
  const m = new Map<string, PecaSoltaAgrupada>();
  for (const x of xs) {
    const g = m.get(x.codigo) ?? { codigo: x.codigo, nome: x.nome, setor: x.setor, unidade: x.unidade, quantidade: 0, locais: [] };
    g.quantidade += x.quantidade;
    const local = g.locais.find((l) => l.destino === x.destino && l.area === x.area);
    if (local) local.quantidade += x.quantidade;
    else g.locais.push({ destino: x.destino, area: x.area, quantidade: x.quantidade });
    m.set(x.codigo, g);
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Dispersão · Produção" (um local) ou "Dispersão · Produção: 8; STAND · Ativação: 2" (vários). */
export function textoLocais(locais: PecaSoltaAgrupada["locais"]): string {
  const rotulo = (l: PecaSoltaAgrupada["locais"][number]) => [l.destino, l.area].filter(Boolean).join(" · ");
  if (locais.length === 1) return rotulo(locais[0]) || "—";
  return locais.map((l) => `${rotulo(l) || "sem local"}: ${l.quantidade}`).join("; ");
}

export function totalPecas(os: OsConteudo): number {
  return os.setores.reduce((acc, s) => acc + s.linhas.reduce((a, l) => a + l.total, 0), 0);
}

/** Igualdade semântica entre duas OS (JSONB não preserva a ordem das chaves, então não dá para comparar strings). */
export function osIguais(a: OsConteudo, b: OsConteudo): boolean {
  if (diffOS(a, b).length > 0) return false;
  const chave = (os: OsConteudo) =>
    [...os.setores.flatMap((s) => s.avulsos), ...os.semSetor]
      .map((x) => `${x.descricao}|${x.quantidade}|${x.destino ?? ""}|${x.area ?? ""}`)
      .sort()
      .join("\n");
  return chave(a) === chave(b);
}
