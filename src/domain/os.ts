import type { BomSnapshotLinha, OsConteudo, OsLinha, OsSetor, Setor } from "@/server/db/schema";
import { SETORES } from "@/server/db/schema";

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
};

export const SETOR_LABEL: Record<Setor, string> = {
  ESTRUTURA: "Estrutura (box truss)",
  TENDA: "Tendas",
  MARCENARIA: "Marcenaria",
};

export function descricaoLinha(l: LinhaAta): string {
  if (l.tipo === "PROJETO" && l.projeto) return `${l.projeto.nome} (v${l.projeto.versao})`;
  if (l.tipo === "PECA" && l.peca) return `${l.peca.codigo} · ${l.peca.nome}`;
  return l.descricaoLivre ?? "Item avulso";
}

export function calcularOS(linhas: LinhaAta[]): OsConteudo {
  const porSetor = new Map<Setor, Map<string, OsLinha>>();
  const avulsosPorSetor = new Map<Setor, OsSetor["avulsos"]>();
  const semSetor: OsConteudo["semSetor"] = [];
  for (const s of SETORES) {
    porSetor.set(s, new Map());
    avulsosPorSetor.set(s, []);
  }

  const acumular = (setor: Setor, peca: { id: string; codigo: string; nome: string; unidade: string }, qtd: number, origem: string) => {
    const mapa = porSetor.get(setor)!;
    let linha = mapa.get(peca.id);
    if (!linha) {
      linha = { pecaId: peca.id, codigo: peca.codigo, nome: peca.nome, unidade: peca.unidade, total: 0, origens: [] };
      mapa.set(peca.id, linha);
    }
    linha.total += qtd;
    const existente = linha.origens.find((o) => o.descricao === origem);
    if (existente) existente.quantidade += qtd;
    else linha.origens.push({ descricao: origem, quantidade: qtd });
  };

  for (const l of linhas) {
    if (l.quantidade <= 0) continue;
    if (l.tipo === "PROJETO" && l.projeto) {
      const origem = `${l.projeto.nome} × ${l.quantidade}`;
      for (const b of l.projeto.bom) {
        acumular(b.setor, { id: b.pecaId, codigo: b.codigo, nome: b.nome, unidade: b.unidade }, b.quantidade * l.quantidade, origem);
      }
    } else if (l.tipo === "PECA" && l.peca) {
      const origem = l.destino ? `Avulso · ${l.destino}` : "Avulso";
      acumular(l.peca.setor, l.peca, l.quantidade, origem);
    } else {
      semSetor.push({ descricao: l.descricaoLivre ?? "Item avulso", quantidade: l.quantidade, destino: l.destino, area: l.areaNome });
    }
  }

  const setores: OsSetor[] = SETORES.map((setor) => ({
    setor,
    linhas: [...porSetor.get(setor)!.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
    avulsos: avulsosPorSetor.get(setor)!,
  })).filter((s) => s.linhas.length > 0 || s.avulsos.length > 0);

  return { setores, semSetor };
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
