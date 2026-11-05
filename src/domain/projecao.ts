import type { TipoCobertura, TipoItem } from "@/server/db/schema";

/**
 * Projeção de estoque (briefing NorteLog v2, Fase 1): por semana e por peça, o saldo previsto em cada almoxarifado e onde
 * falta. Tudo calculado aqui, sem banco: a tela, o Excel e os testes usam esta função.
 *
 * O saldo de um dia = o saldo contado + o que voltou - o que saiu depois da contagem. O que saiu antes da contagem já
 * não estava lá quando contaram: só a volta conta. A semana mostra o menor saldo dos dias, não o do fim da semana.
 */

export const CAMADAS = ["ESTIMADA", "CONFIRMADA", "COMPROMETIDA", "FISICA"] as const;
export type Camada = (typeof CAMADAS)[number];
export const CAMADA_LABEL: Record<Camada, string> = { ESTIMADA: "Estimada", CONFIRMADA: "Confirmada", COMPROMETIDA: "Comprometida", FISICA: "Física" };
/** Comprometida e física dependem da OE e do carregamento (Fase 3): aparecem na tela, ainda sem dado. */
export const CAMADAS_COM_DADO: readonly Camada[] = ["ESTIMADA", "CONFIRMADA"];

export const CENARIOS = {
  decisao: { rotulo: "Decisão de locação", camadas: ["CONFIRMADA", "COMPROMETIDA", "FISICA"] as Camada[] },
  antecipada: { rotulo: "Visão antecipada", camadas: [...CAMADAS] as Camada[] },
} as const;
export type Cenario = keyof typeof CENARIOS;

export const SEMANAS_PADRAO = 12;

export type Demanda = {
  eventoId: string;
  eventoCodigo: string;
  eventoNome: string;
  tourId: string | null;
  tourNome: string | null;
  pecaId: string;
  almoxarifadoId: string;
  quantidade: number;
  camada: Camada;
  saida: string;
  retorno: string;
  /** Sem tipo definido, conta como retornável (e a peça aparece no saneamento). */
  tipoItem: TipoItem | null;
  /** Estrutura do evento "a definir": entra só com o filtro marcado. */
  aDefinir: boolean;
  /** Área e projeto de onde veio. */
  origem: string;
};

export type Cobertura = {
  id: string;
  tipo: TipoCobertura;
  pecaId: string;
  almoxarifadoId: string;
  quantidade: number;
  dataEntrada: string;
  dataDevolucao: string | null;
  rotulo: string;
};

export type SaldoBase = { pecaId: string; almoxarifadoId: string; quantidade: number; contadoEm: string | null };
export type PecaProjecao = { id: string; estoqueMinimo: number | null };
export type AlmoxarifadoLiberado = { id: string; contadoEm: string };

export type Semana = { inicio: string; fim: string };
export type TomCelula = "ok" | "atencao" | "falta";
export type Celula = Semana & { minimo: number; dia: string; tom: TomCelula };
export type LinhaProjecao = { pecaId: string; celulas: Celula[]; naoConferida: boolean };
export type Falta = Semana & { pecaId: string; faltam: number; dia: string };
export type AvisoTour = { tourId: string; tourNome: string; pecaId: string; pedido: number; maior: number };
export type ResultadoProjecao = { semanas: Semana[]; linhas: LinhaProjecao[]; faltas: Falta[]; avisos: AvisoTour[] };

export type OpcoesProjecao = {
  inicio: string;
  semanas?: number;
  camadas: readonly Camada[];
  incluirADefinir: boolean;
  /** Null = consolidado dos almoxarifados liberados. */
  almoxarifadoId: string | null;
};

const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Semanas de segunda a domingo, a partir da semana da data dada. */
export function semanasDoPeriodo(inicio: string, n = SEMANAS_PADRAO): Semana[] {
  const dia = new Date(`${inicio}T00:00:00Z`).getUTCDay();
  const segunda = somaDias(inicio, -((dia + 6) % 7));
  return Array.from({ length: n }, (_, i) => ({ inicio: somaDias(segunda, i * 7), fim: somaDias(segunda, i * 7 + 6) }));
}

type Bloco = { pecaId: string; almoxarifadoId: string; quantidade: number; saida: string; retorno: string | null };

const retornavel = (d: Pick<Demanda, "tipoItem">) => d.tipoItem !== "CONSUMIVEL";

/** Os eventos viram blocos de saída e volta. No tour, retornável usa o maior valor entre os eventos e consumível usa a soma. */
function montarBlocos(demandas: readonly Demanda[]): { blocos: Bloco[]; avisos: AvisoTour[] } {
  const blocos: Bloco[] = [];
  const avisos: AvisoTour[] = [];
  const grupos = new Map<string, Demanda[]>();
  for (const d of demandas) {
    // Sem tour, cada evento é o próprio bloco.
    const k = `${d.tourId ?? `e:${d.eventoId}`}|${d.almoxarifadoId}|${d.pecaId}`;
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  for (const ds of grupos.values()) {
    const d0 = ds[0];
    const porEvento = new Map<string, { quantidade: number; saida: string; retorno: string }>();
    for (const d of ds) {
      const e = porEvento.get(d.eventoId) ?? { quantidade: 0, saida: d.saida, retorno: d.retorno };
      e.quantidade += d.quantidade;
      porEvento.set(d.eventoId, e);
    }
    const eventos = [...porEvento.values()];
    const saida = eventos.map((e) => e.saida).sort()[0];
    const retorno = eventos.map((e) => e.retorno).sort().at(-1)!;
    if (!retornavel(d0)) {
      blocos.push({ pecaId: d0.pecaId, almoxarifadoId: d0.almoxarifadoId, quantidade: eventos.reduce((a, e) => a + e.quantidade, 0), saida, retorno: null });
      continue;
    }
    const maior = Math.max(...eventos.map((e) => e.quantidade));
    blocos.push({ pecaId: d0.pecaId, almoxarifadoId: d0.almoxarifadoId, quantidade: maior, saida, retorno });
    if (d0.tourId && eventos.length > 1) {
      // Dois eventos do tour ao mesmo tempo pedem a soma: o "maior" não basta, e a logística precisa olhar.
      const pedido = Math.max(...eventos.map((e) => eventos.filter((o) => o.saida < e.retorno && e.saida < o.retorno).reduce((a, o) => a + o.quantidade, 0)));
      if (pedido > maior) avisos.push({ tourId: d0.tourId, tourNome: d0.tourNome ?? "", pecaId: d0.pecaId, pedido, maior });
    }
  }
  return { blocos, avisos };
}

/** O que sai do galpão por peça, já com a regra do tour: a base da estimativa de veículos. */
export const blocosDoEvento = (demandas: readonly Demanda[]) => montarBlocos(demandas).blocos;

type Lancamento = { data: string; delta: number };

/** Saldo de cada dia da grade, numa peça e num almoxarifado. */
function saldosDiarios(base: number, corte: string, lancamentos: readonly Lancamento[], dias: readonly string[]): number[] {
  const porData = new Map<string, number>();
  let saldo = base;
  for (const l of lancamentos) {
    if (l.data <= corte) continue;
    if (l.data < dias[0]) saldo += l.delta;
    else porData.set(l.data, (porData.get(l.data) ?? 0) + l.delta);
  }
  return dias.map((d) => (saldo += porData.get(d) ?? 0));
}

export function projetar(entrada: {
  pecas: readonly PecaProjecao[];
  saldos: readonly SaldoBase[];
  almoxarifados: readonly AlmoxarifadoLiberado[];
  demandas: readonly Demanda[];
  coberturas: readonly Cobertura[];
  opcoes: OpcoesProjecao;
}): ResultadoProjecao {
  const { pecas, saldos, almoxarifados, coberturas, opcoes } = entrada;
  const semanas = semanasDoPeriodo(opcoes.inicio, opcoes.semanas ?? SEMANAS_PADRAO);
  const dias = semanas.flatMap((s) => Array.from({ length: 7 }, (_, i) => somaDias(s.inicio, i)));
  const liberados = almoxarifados.filter((a) => !opcoes.almoxarifadoId || a.id === opcoes.almoxarifadoId);
  const idsLiberados = new Set(liberados.map((a) => a.id));
  const demandas = entrada.demandas.filter((d) => idsLiberados.has(d.almoxarifadoId) && opcoes.camadas.includes(d.camada) && (opcoes.incluirADefinir || !d.aDefinir) && d.quantidade > 0);
  const { blocos, avisos } = montarBlocos(demandas);
  const minimo = new Map(pecas.map((p) => [p.id, p.estoqueMinimo]));

  // Peças que têm o que mostrar: pedido no período ou previsão de locação e compra.
  const pecaIds = new Set<string>([...blocos.map((b) => b.pecaId), ...coberturas.filter((c) => idsLiberados.has(c.almoxarifadoId)).map((c) => c.pecaId)]);
  const linhas: LinhaProjecao[] = [];
  const faltas: Falta[] = [];

  for (const pecaId of pecaIds) {
    let naoConferida = false;
    const total = new Array<number>(dias.length).fill(0);
    for (const a of liberados) {
      const s = saldos.find((x) => x.pecaId === pecaId && x.almoxarifadoId === a.id);
      if (!s?.contadoEm) naoConferida = true;
      // Peça que a contagem não citou: saldo zero na data da última contagem do almoxarifado.
      const corte = s?.contadoEm ?? a.contadoEm;
      const lanc: Lancamento[] = [];
      for (const b of blocos) {
        if (b.pecaId !== pecaId || b.almoxarifadoId !== a.id) continue;
        lanc.push({ data: b.saida, delta: -b.quantidade });
        if (b.retorno) lanc.push({ data: b.retorno, delta: b.quantidade });
      }
      for (const c of coberturas) {
        if (c.pecaId !== pecaId || c.almoxarifadoId !== a.id) continue;
        lanc.push({ data: c.dataEntrada, delta: c.quantidade });
        if (c.dataDevolucao) lanc.push({ data: c.dataDevolucao, delta: -c.quantidade });
      }
      saldosDiarios(s?.quantidade ?? 0, corte, lanc, dias).forEach((v, i) => (total[i] += v));
    }
    const celulas = semanas.map((sem, si): Celula => {
      let m = Number.POSITIVE_INFINITY;
      let dia = sem.inicio;
      for (let i = si * 7; i < si * 7 + 7; i++) {
        if (total[i] < m) {
          m = total[i];
          dia = dias[i];
        }
      }
      const min = minimo.get(pecaId);
      const tom: TomCelula = m < 0 ? "falta" : min != null && m < min ? "atencao" : "ok";
      if (m < 0) faltas.push({ ...sem, pecaId, faltam: -m, dia });
      return { ...sem, minimo: m, dia, tom };
    });
    linhas.push({ pecaId, celulas, naoConferida });
  }
  faltas.sort((a, b) => a.inicio.localeCompare(b.inicio) || b.faltam - a.faltam);
  return { semanas, linhas, faltas, avisos };
}

/**
 * Os eventos que explicam um dia ou uma semana: quem está com a peça fora naquele período. Consumível conta da saída em diante,
 * porque não volta. Toda falta passa por aqui: nenhuma célula vermelha fica sem causa.
 */
export function eventosDoPeriodo<D extends Pick<Demanda, "pecaId" | "saida" | "retorno" | "tipoItem">>(demandas: readonly D[], pecaId: string, inicio: string, fim: string): D[] {
  return demandas.filter((d) => d.pecaId === pecaId && d.saida <= fim && (!retornavel(d) || d.retorno > inicio));
}
