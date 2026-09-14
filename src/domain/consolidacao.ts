import type { OsConteudo, Setor } from "@/server/db/schema";

/**
 * Consolidação por período (RV-02 / MEL-08).
 *
 * Para cada peça, calcula a demanda em cada dia do período (soma das OS dos eventos
 * que ocupam a peça naquele dia, entre montagem e desmontagem) e toma o pico.
 * Eventos que não se sobrepõem não competem pela mesma peça.
 */

export type EventoConsolidacao = {
  id: string;
  codigo: string;
  nome: string;
  dataMontagem: string; // YYYY-MM-DD
  dataDesmontagem: string;
  os: OsConteudo;
};

export type PecaConsolidada = {
  pecaId: string;
  codigo: string;
  nome: string;
  setor: Setor;
  unidade: string;
  estoque: number;
  pico: number;
  diaPico: string | null;
  eventosNoPico: Array<{ codigo: string; nome: string; quantidade: number }>;
  saldo: number;
  totalPeriodo: number;
};

function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let d = inicio;
  let guard = 0;
  while (d <= fim && guard < 400) {
    out.push(d);
    d = addDias(d, 1);
    guard++;
  }
  return out;
}

export function consolidar(
  eventos: EventoConsolidacao[],
  pecas: Array<{ id: string; codigo: string; nome: string; setor: Setor; unidade: string; estoqueProprio: number }>,
  periodo: { inicio: string; fim: string },
): PecaConsolidada[] {
  const dias = diasEntre(periodo.inicio, periodo.fim);
  const demandaPorEvento = new Map<string, Map<string, number>>(); // eventoId -> pecaId -> qtd
  for (const ev of eventos) {
    const m = new Map<string, number>();
    for (const s of ev.os.setores) for (const l of s.linhas) m.set(l.pecaId, (m.get(l.pecaId) ?? 0) + l.total);
    demandaPorEvento.set(ev.id, m);
  }

  const resultado: PecaConsolidada[] = [];
  for (const p of pecas) {
    let pico = 0;
    let diaPico: string | null = null;
    let eventosNoPico: PecaConsolidada["eventosNoPico"] = [];
    let totalPeriodo = 0;
    const contados = new Set<string>();
    for (const dia of dias) {
      let soma = 0;
      const lista: PecaConsolidada["eventosNoPico"] = [];
      for (const ev of eventos) {
        if (ev.dataMontagem <= dia && dia <= ev.dataDesmontagem) {
          const q = demandaPorEvento.get(ev.id)?.get(p.id) ?? 0;
          if (q > 0) {
            soma += q;
            lista.push({ codigo: ev.codigo, nome: ev.nome, quantidade: q });
            if (!contados.has(ev.id)) {
              contados.add(ev.id);
              totalPeriodo += q;
            }
          }
        }
      }
      if (soma > pico) {
        pico = soma;
        diaPico = dia;
        eventosNoPico = lista;
      }
    }
    if (pico === 0) continue;
    resultado.push({
      pecaId: p.id,
      codigo: p.codigo,
      nome: p.nome,
      setor: p.setor,
      unidade: p.unidade,
      estoque: p.estoqueProprio,
      pico,
      diaPico,
      eventosNoPico,
      saldo: p.estoqueProprio - pico,
      totalPeriodo,
    });
  }
  return resultado.sort((a, b) => a.saldo - b.saldo || a.codigo.localeCompare(b.codigo, "pt-BR"));
}
