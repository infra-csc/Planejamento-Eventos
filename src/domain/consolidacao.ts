import type { OsConteudo, Setor } from "@/server/db/schema";

/**
 * Consolidação por período (handoff §5.13).
 *
 * Para cada peça, soma a demanda de cada dia do período considerando os eventos que ocupam
 * a peça naquele dia (montagem → desmontagem) e guarda o pior dia (pico). Eventos sem ata
 * fechada entram também com a demanda projetada dos itens ainda em análise.
 */

export type EventoConsolidacao = {
  id: string;
  codigo: string;
  nome: string;
  dataMontagem: string; // YYYY-MM-DD
  dataDesmontagem: string;
  os: OsConteudo;
  /** pecaId → quantidade projetada (itens em análise de eventos sem ata fechada). */
  projetado?: Record<string, number>;
};

export type EventoNoPico = { codigo: string; nome: string; quantidade: number; projetado: boolean };

export type PecaConsolidada = {
  pecaId: string;
  codigo: string;
  nome: string;
  setor: Setor;
  unidade: string;
  estoque: number;
  pico: number;
  diaPico: string | null;
  eventosNoPico: EventoNoPico[];
  temProjecao: boolean;
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
  const confirmada = new Map<string, Map<string, number>>();
  for (const ev of eventos) {
    const m = new Map<string, number>();
    for (const s of ev.os.setores) for (const l of s.linhas) m.set(l.pecaId, (m.get(l.pecaId) ?? 0) + l.total);
    confirmada.set(ev.id, m);
  }

  const resultado: PecaConsolidada[] = [];
  for (const p of pecas) {
    let pico = 0;
    let diaPico: string | null = null;
    let eventosNoPico: EventoNoPico[] = [];
    let totalPeriodo = 0;
    const contados = new Set<string>();
    for (const dia of dias) {
      let soma = 0;
      const lista: EventoNoPico[] = [];
      for (const ev of eventos) {
        if (ev.dataMontagem > dia || dia > ev.dataDesmontagem) continue;
        const q = confirmada.get(ev.id)?.get(p.id) ?? 0;
        const pq = ev.projetado?.[p.id] ?? 0;
        if (q > 0) lista.push({ codigo: ev.codigo, nome: ev.nome, quantidade: q, projetado: false });
        if (pq > 0) lista.push({ codigo: ev.codigo, nome: ev.nome, quantidade: pq, projetado: true });
        if (q + pq > 0) {
          soma += q + pq;
          if (!contados.has(ev.id)) {
            contados.add(ev.id);
            totalPeriodo += q + pq;
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
      temProjecao: eventosNoPico.some((e) => e.projetado),
      saldo: p.estoqueProprio - pico,
      totalPeriodo,
    });
  }
  return resultado.sort((a, b) => a.saldo - b.saldo || a.codigo.localeCompare(b.codigo, "pt-BR"));
}
