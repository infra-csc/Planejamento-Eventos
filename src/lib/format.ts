const TZ = "America/Sao_Paulo";

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatarDataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(date);
}

export function formatarDataCurta(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).format(date).replace(".", "");
}

export function formatarPeriodo(inicio: string, fim: string): string {
  if (inicio === fim) return formatarData(inicio);
  return `${formatarData(inicio)} – ${formatarData(fim)}`;
}

export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDiasISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Texto relativo curto para prazos: "em 3 h", "há 2 dias", "agora". */
export function tempoRelativo(d: Date | string, agora = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = date.getTime() - agora.getTime();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  const h = Math.round(abs / 3_600_000);
  const dias = Math.round(abs / 86_400_000);
  let txt: string;
  if (min < 1) txt = "agora";
  else if (min < 60) txt = `${min} min`;
  else if (h < 48) txt = `${h} h`;
  else txt = `${dias} dias`;
  if (txt === "agora") return txt;
  return diff > 0 ? `em ${txt}` : `há ${txt}`;
}

export function numero(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${numero(n)} ${n === 1 ? singular : pluralForm}`;
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Converte "datetime-local" (interpretado em America/Sao_Paulo) para Date UTC. */
export function parseDateTimeLocal(valor: string): Date | null {
  if (!valor) return null;
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // Descobre o offset do fuso na data informada.
  const guess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(guess);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-3";
  const mm = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = mm?.[1] === "-" ? -1 : 1;
  const oh = mm ? +mm[2] : 0;
  const om = mm?.[3] ? +mm[3] : 0;
  const offsetMin = sign * (oh * 60 + om);
  return new Date(guess.getTime() - offsetMin * 60_000);
}

/** Formata Date para valor de input datetime-local no fuso de São Paulo. */
export function toDateTimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
