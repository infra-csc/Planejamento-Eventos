import type { TipoCalendario } from "@/server/services/calendario";

/**
 * Cor e rótulo de cada tipo do calendário, pelos tons semânticos do design system (o vinho fica só
 * para "hoje"): evento = faixa neutra; reunião de OS = info; prazo de resposta = erro; fim da
 * janela = atenção; montagem = sucesso; carga = escuro (neutro de peso).
 */
export const TIPO: Record<TipoCalendario, { rotulo: string; ponto: string; fundo: string; texto: string }> = {
  evento: { rotulo: "Evento", ponto: "bg-ink-3", fundo: "bg-control", texto: "text-ink" },
  reuniao: { rotulo: "Reunião de OS", ponto: "bg-info", fundo: "bg-info-bg", texto: "text-info" },
  prazo: { rotulo: "Prazo de resposta", ponto: "bg-danger", fundo: "bg-danger-bg", texto: "text-danger" },
  janela: { rotulo: "Fim da janela de alterações", ponto: "bg-warning", fundo: "bg-warning-bg", texto: "text-warning" },
  montagem: { rotulo: "Montagem", ponto: "bg-success", fundo: "bg-success-bg", texto: "text-success" },
  carga: { rotulo: "Carga do caminhão", ponto: "bg-dark", fundo: "bg-neutral-bg", texto: "text-ink" },
};
export const ORDEM_TIPOS = Object.keys(TIPO) as TipoCalendario[];

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export const pad = (n: number) => String(n).padStart(2, "0");

/** Tira o prefixo do tipo do título ("Montagem · Nome" → "Nome") onde o tipo já aparece por cor ou rótulo. */
export const semPrefixo = (titulo: string) => titulo.replace(/^(Reunião de OS|Prazo de resposta|Fim da janela de alterações|Montagem|Carga do caminhão) · /, "");

/** "qui, 24/09" a partir de "YYYY-MM-DD". */
export function rotuloDia(d: string) {
  const dt = new Date(`${d}T12:00:00Z`);
  return `${DIAS[(dt.getUTCDay() + 6) % 7]}, ${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}`;
}

/** "24/09" a partir de "YYYY-MM-DD". */
export const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Soma dias a "YYYY-MM-DD". */
export function somarDias(d: string, n: number) {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
