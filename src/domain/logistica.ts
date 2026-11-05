import type { AtendePor, EstruturaEvento, TipoCobertura, TipoItem } from "@/server/db/schema";
import type { GrupoMaterial } from "@/domain/grupos-material";
import type { TipoVeiculo, TrechoIda, TrechoVolta } from "@/domain/carga-descarga";

/**
 * Logística de materiais (briefing NorteLog v2, Fase 0): regras fixas no código e aplicadas no servidor.
 * Sem banco aqui: as telas, os serviços e os testes usam as mesmas funções.
 */

export const TIPO_ITEM_LABEL: Record<TipoItem, string> = { RETORNAVEL: "Retornável", CONSUMIVEL: "Consumível" };
export const ESTRUTURA_LABEL: Record<EstruturaEvento, string> = { PROPRIA: "Própria", TERCEIRIZADA: "Terceirizada", A_DEFINIR: "A definir" };
export const ATENDE_POR_LABEL: Record<AtendePor, string> = {
  GALPAO_NORTE: "Galpão Norte",
  FORNECEDOR_EXTERNO: "Fornecedor externo",
  LOCACAO_VIA_GALPAO: "Locação via galpão",
  COMPRA_CONSUMO: "Compra/consumo",
};
export const COBERTURA_LABEL: Record<TipoCobertura, string> = { LOCACAO: "Locação", COMPRA: "Compra" };
/** O que o solicitante lê em cada item. */
export const SELO_ATENDE: Record<AtendePor, string> = {
  GALPAO_NORTE: "Vai do nosso galpão",
  FORNECEDOR_EXTERNO: "Fornecedor externo",
  LOCACAO_VIA_GALPAO: "Vai do nosso galpão (locado)",
  COMPRA_CONSUMO: "Compra ou consumo",
};
export const PROPRIETARIO_NORTE = "Norte";

/** Grupos de material que seguem o campo "Estrutura" do evento. */
const GRUPOS_DA_ESTRUTURA: readonly GrupoMaterial[] = ["ESTRUTURA", "TENDAS"];
/** Dentro de um projeto, as peças que o fornecedor de estrutura leva; a marcenaria do mesmo projeto segue com a gente. */
const SETORES_DA_ESTRUTURA: readonly string[] = ["ESTRUTURA", "TENDA"];
export const setorDaEstrutura = (setor: string) => SETORES_DA_ESTRUTURA.includes(setor);

export type AtendimentoLinha = { atendePor: AtendePor; aDefinir: boolean; herdado: boolean };

/**
 * De onde sai a linha. Decidido na linha, vale o da linha; senão herda: estrutura e tendas seguem o campo "Estrutura" do
 * evento e o resto vai do galpão. Por isso mudar a Estrutura muda só as linhas que ninguém editou.
 */
export function atendimentoDaLinha(linha: { atendePor: AtendePor | null; grupo: GrupoMaterial }, estrutura: EstruturaEvento): AtendimentoLinha {
  if (linha.atendePor) return { atendePor: linha.atendePor, aDefinir: false, herdado: false };
  if (!GRUPOS_DA_ESTRUTURA.includes(linha.grupo)) return { atendePor: "GALPAO_NORTE", aDefinir: false, herdado: true };
  if (estrutura === "TERCEIRIZADA") return { atendePor: "FORNECEDOR_EXTERNO", aDefinir: false, herdado: true };
  return { atendePor: "GALPAO_NORTE", aDefinir: estrutura === "A_DEFINIR", herdado: true };
}

/**
 * A peça entra no que sai do galpão? Linha que herdou a estrutura terceirizada (ou a definir) afeta só box truss e tendas:
 * as outras peças do mesmo projeto saem do galpão. Linha decidida à mão vale inteira.
 */
export function atendimentoDaPeca(a: AtendimentoLinha, setorPeca: string): AtendimentoLinha {
  if (!a.herdado || setorDaEstrutura(setorPeca)) return a;
  return { atendePor: "GALPAO_NORTE", aDefinir: false, herdado: true };
}

/* ------------------------------------------------------------------ */
/* Datas previstas                                                      */
/* ------------------------------------------------------------------ */

const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaDe = (dataHora: string | null | undefined) => (dataHora && /^\d{4}-\d{2}-\d{2}/.test(dataHora) ? dataHora.slice(0, 10) : null);

export type OrigemData = "veiculo" | "editada" | "calculada";
export type DatasPrevistas = { saida: string; retorno: string; origemSaida: OrigemData; origemRetorno: OrigemData };

/**
 * Saída e retorno do evento: com veículo cadastrado, valem o início da carga da ida e a descarga da volta; senão a data
 * editada no evento; senão data do evento menos X dias e fim mais Y dias (Administração).
 */
export function datasPrevistas(
  ev: { dataInicio: string; dataFim: string; saidaPrevista?: string | null; retornoPrevisto?: string | null },
  dias: { antes: number; depois: number },
  veiculos: ReadonlyArray<{ ida: Pick<TrechoIda, "ativo" | "inicioCarga">; volta: Pick<TrechoVolta, "ativo" | "descargaGalpao"> }> = [],
): DatasPrevistas {
  const idas = veiculos.flatMap((v) => (v.ida.ativo ? [diaDe(v.ida.inicioCarga)] : [])).filter((x): x is string => Boolean(x));
  const voltas = veiculos.flatMap((v) => (v.volta.ativo ? [diaDe(v.volta.descargaGalpao)] : [])).filter((x): x is string => Boolean(x));
  const saidaVeiculo = idas.length ? idas.sort()[0] : null;
  const retornoVeiculo = voltas.length ? voltas.sort().at(-1)! : null;
  return {
    saida: saidaVeiculo ?? ev.saidaPrevista ?? somaDias(ev.dataInicio, -dias.antes),
    retorno: retornoVeiculo ?? ev.retornoPrevisto ?? somaDias(ev.dataFim, dias.depois),
    origemSaida: saidaVeiculo ? "veiculo" : ev.saidaPrevista ? "editada" : "calculada",
    origemRetorno: retornoVeiculo ? "veiculo" : ev.retornoPrevisto ? "editada" : "calculada",
  };
}

/* ------------------------------------------------------------------ */
/* Cubagem                                                              */
/* ------------------------------------------------------------------ */

export type PerfilParaCubagem = { tipo: TipoVeiculo; nome: string; comprimentoM: number; larguraM: number; alturaM: number; redutorPct: number };

export const volumePerfil = (p: Pick<PerfilParaCubagem, "comprimentoM" | "larguraM" | "alturaM">) => p.comprimentoM * p.larguraM * p.alturaM;
export const volumeUtil = (p: PerfilParaCubagem) => volumePerfil(p) * (1 - p.redutorPct / 100);

export type EstimativaVeiculos = { volumeTotal: number; pecasSemVolume: number; porPerfil: Array<{ tipo: TipoVeiculo; perfil: string; veiculos: number }> };

/** Estimativa simples: volume das peças ÷ volume útil do perfil (com o redutor), arredondado para cima. */
export function estimarVeiculos(itens: ReadonlyArray<{ pecaId: string; quantidade: number; volumeM3: number | null }>, perfis: readonly PerfilParaCubagem[]): EstimativaVeiculos {
  const semVolume = new Set<string>();
  let volumeTotal = 0;
  for (const i of itens) {
    if (i.volumeM3 == null || i.volumeM3 <= 0) semVolume.add(i.pecaId);
    else volumeTotal += i.quantidade * i.volumeM3;
  }
  return {
    volumeTotal,
    pecasSemVolume: semVolume.size,
    porPerfil: perfis.map((p) => ({ tipo: p.tipo, perfil: p.nome, veiculos: volumeTotal > 0 && volumeUtil(p) > 0 ? Math.ceil(volumeTotal / volumeUtil(p) - 1e-9) : 0 })),
  };
}

/* ------------------------------------------------------------------ */
/* Saneamento das datas                                                 */
/* ------------------------------------------------------------------ */

export type InconsistenciaEvento = "EVENTO_ANTES_DA_REUNIAO" | "REUNIAO_PASSOU" | "RETORNO_ANTES_DA_SAIDA";
export const INCONSISTENCIA_LABEL: Record<InconsistenciaEvento, string> = {
  EVENTO_ANTES_DA_REUNIAO: "Data do evento antes da reunião de OS",
  REUNIAO_PASSOU: "Reunião de OS já passou e não começou",
  RETORNO_ANTES_DA_SAIDA: "Retorno previsto antes da saída prevista",
};

/** O que precisa de correção manual antes de a Projeção confiar nas datas. `diaReuniao` no fuso de Brasília. */
export function inconsistenciasDoEvento(ev: { dataInicio: string; diaReuniao: string; status: string; saida: string; retorno: string }, hoje: string): InconsistenciaEvento[] {
  const out: InconsistenciaEvento[] = [];
  if (ev.dataInicio < ev.diaReuniao) out.push("EVENTO_ANTES_DA_REUNIAO");
  if (ev.status === "PREPARACAO" && ev.diaReuniao < hoje) out.push("REUNIAO_PASSOU");
  if (ev.retorno < ev.saida) out.push("RETORNO_ANTES_DA_SAIDA");
  return out;
}
