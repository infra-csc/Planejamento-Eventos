import type { OsConteudo, OsLinha, Setor } from "@/server/db/schema";
import { semPrismaComum, unificarPecasOs } from "@/domain/os";

/**
 * Carregamento do caminhão: o que de fato foi, quando não é o que foi pedido. A OS não muda (continua sendo o pedido):
 * a diferença fica registrada à parte, com observação opcional, e entra na folha de estrutura e na folha de separação da versão atual.
 * Chave: o código da peça; item fora do catálogo, `fora:descrição|local`.
 */
export type AjusteCarregamento = {
  chave: string;
  pecaId: string | null;
  codigo: string | null;
  nome: string;
  setor: Setor | null;
  unidade: string;
  carregado: number;
  /** Quanto a OS pedia quando o ajuste foi feito: se a OS mudar depois, a tela avisa. */
  pedidoNaHora: number;
  /** Observação opcional de quem alterou. */
  motivo: string;
  porNome: string;
  em: string;
};
export type Carregamento = Record<string, AjusteCarregamento>;

export type LinhaCarregamento = {
  chave: string;
  pecaId: string | null;
  codigo: string | null;
  nome: string;
  setor: Setor | null;
  unidade: string;
  pedido: number;
  carregado: number;
  ajuste: AjusteCarregamento | null;
};

export const chaveFora = (descricao: string, destino: string | null | undefined) => `fora:${descricao}|${destino?.trim() ?? ""}`;

/** Peças e itens fora do catálogo da OS, com o carregado de cada um; o que só existe no carregamento vem no fim. */
export function linhasCarregamento(bruta: OsConteudo, ajustes: Carregamento): LinhaCarregamento[] {
  const os = unificarPecasOs(bruta);
  const linhas: LinhaCarregamento[] = [];
  const junto = (base: Omit<LinhaCarregamento, "carregado" | "ajuste">) => {
    const ajuste = ajustes[base.chave] ?? null;
    linhas.push({ ...base, carregado: ajuste ? ajuste.carregado : base.pedido, ajuste });
  };
  for (const s of os.setores) for (const l of semPrismaComum(s.linhas)) junto({ chave: l.codigo, pecaId: l.pecaId, codigo: l.codigo, nome: l.nome, setor: s.setor, unidade: l.unidade, pedido: l.total });
  const fora = new Map<string, { descricao: string; destino: string | null; quantidade: number }>();
  for (const x of os.semSetor) {
    const k = chaveFora(x.descricao, x.destino);
    const f = fora.get(k) ?? { descricao: x.descricao, destino: x.destino?.trim() || null, quantidade: 0 };
    f.quantidade += x.quantidade;
    fora.set(k, f);
  }
  for (const [chave, f] of fora) junto({ chave, pecaId: null, codigo: null, nome: f.destino ? `${f.descricao} · ${f.destino}` : f.descricao, setor: null, unidade: "un", pedido: f.quantidade });
  const conhecidas = new Set(linhas.map((l) => l.chave));
  for (const a of Object.values(ajustes)) {
    if (!conhecidas.has(a.chave)) linhas.push({ chave: a.chave, pecaId: a.pecaId, codigo: a.codigo, nome: a.nome, setor: a.setor, unidade: a.unidade, pedido: 0, carregado: a.carregado, ajuste: a });
  }
  return linhas;
}

/** Só o que ficou diferente do pedido. */
export const mudancasCarregamento = (linhas: readonly LinhaCarregamento[]) => linhas.filter((l) => l.ajuste && l.carregado !== l.pedido);

/** "Cone grande 350 → 300": o texto curto de uma mudança (aviso e histórico). */
export const textoMudanca = (m: { nome: string; pedido: number; carregado: number }) => `${m.nome} ${m.pedido.toLocaleString("pt-BR")} → ${m.carregado.toLocaleString("pt-BR")}`;

/**
 * A OS com o que foi carregado, para as folhas. Os totais por peça ficam com o carregado. Para o detalhe bater com o total,
 * o que saiu é tirado primeiro das peças soltas e depois dos projetos, do último para o primeiro; o que entrou a mais vira
 * peça solta. As quantidades por local (tendas) podem não ser as reais: o total é que vale.
 */
export function aplicarCarregamento(bruta: OsConteudo, ajustes: Carregamento): OsConteudo {
  const linhasAjustadas = mudancasCarregamento(linhasCarregamento(bruta, ajustes));
  if (linhasAjustadas.length === 0) return bruta;
  const base = unificarPecasOs(bruta);
  const os: OsConteudo = {
    ...base,
    setores: base.setores.map((s) => ({ ...s, linhas: s.linhas.map((l) => ({ ...l })) })),
    semSetor: base.semSetor.map((x) => ({ ...x })),
    projetos: base.projetos?.map((p) => ({ ...p, pecas: p.pecas.map((x) => ({ ...x })) })),
    individuais: (base.individuais ?? []).map((x) => ({ ...x })),
  };
  for (const m of linhasAjustadas) {
    if (!m.codigo) {
      let falta = m.carregado;
      for (const x of os.semSetor) {
        if (chaveFora(x.descricao, x.destino) !== m.chave) continue;
        x.quantidade = Math.min(x.quantidade, falta);
        falta -= x.quantidade;
      }
      const ultima = [...os.semSetor].reverse().find((x) => chaveFora(x.descricao, x.destino) === m.chave);
      if (ultima) ultima.quantidade += falta;
      continue;
    }
    const delta = m.carregado - m.pedido;
    let linha: OsLinha | undefined;
    for (const s of os.setores) linha ??= s.linhas.find((l) => l.codigo === m.codigo);
    if (linha) linha.total = m.carregado;
    else if (m.setor && m.pecaId) {
      let setor = os.setores.find((s) => s.setor === m.setor);
      if (!setor) {
        setor = { setor: m.setor, linhas: [], avulsos: [] };
        os.setores.push(setor);
      }
      setor.linhas.push({ pecaId: m.pecaId, codigo: m.codigo, nome: m.nome, unidade: m.unidade, total: m.carregado, origens: [] });
    }
    if (delta > 0) {
      if (m.setor) os.individuais!.push({ codigo: m.codigo, nome: m.nome, setor: m.setor, unidade: m.unidade, quantidade: delta, destino: null, area: null });
      continue;
    }
    let tirar = -delta;
    for (const x of [...os.individuais!].reverse()) {
      if (x.codigo !== m.codigo || tirar === 0) continue;
      const t = Math.min(x.quantidade, tirar);
      x.quantidade -= t;
      tirar -= t;
    }
    for (const p of [...(os.projetos ?? [])].reverse()) {
      for (const x of p.pecas) {
        if (x.codigo !== m.codigo || tirar === 0) continue;
        const t = Math.min(x.total, tirar);
        x.total -= t;
        tirar -= t;
      }
    }
  }
  return {
    ...os,
    setores: os.setores.map((s) => ({ ...s, linhas: s.linhas.filter((l) => l.total > 0) })).filter((s) => s.linhas.length > 0 || s.avulsos.length > 0),
    semSetor: os.semSetor.filter((x) => x.quantidade > 0),
    individuais: os.individuais!.filter((x) => x.quantidade > 0),
  };
}
