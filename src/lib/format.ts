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
  // Data inexistente (30/02, 31/04) viraria outro dia em silêncio.
  if (guess.getUTCMonth() !== +mo - 1 || guess.getUTCDate() !== +d || +h > 23 || +mi > 59) return null;
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

/* ------------------------------------------------------------------ */
/* Formatos curtos do redesenho (sempre no fuso de São Paulo)          */
/* ------------------------------------------------------------------ */

function partesSP(d: Date) {
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
  return { ano: g("year"), mes: g("month"), dia: g("day"), hora: g("hour") === "24" ? "00" : g("hour"), minuto: g("minute") };
}

const paraData = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

/** "YYYY-MM-DD" do instante no fuso de São Paulo. */
export function isoSP(d: Date | string): string {
  const p = partesSP(paraData(d));
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** "dd/mm" a partir de "YYYY-MM-DD". */
export function diaMesISO(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "dd/mm" de um instante. */
export function diaMes(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const p = partesSP(paraData(d));
  return `${p.dia}/${p.mes}`;
}

/** "HH:MM" de um instante. */
export function hora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const p = partesSP(paraData(d));
  return `${p.hora}:${p.minuto}`;
}

/** "dd/mm HH:MM" de um instante. */
export function diaMesHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return `${diaMes(d)} ${hora(d)}`;
}

/** "dd/mm–dd/mm" (ou só "dd/mm" quando início = fim). */
export function periodoCurto(inicio: string, fim: string): string {
  return inicio === fim ? diaMesISO(inicio) : `${diaMesISO(inicio)}–${diaMesISO(fim)}`;
}

/** "segunda-feira, 14 de setembro de 2026". */
export function dataExtenso(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** "seg", "ter", … */
export function diaSemanaCurto(d: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" }).format(paraData(d)).replace(".", "");
}

/** Último acesso: "hoje 08:12", "ontem 18:40", "há 6 dias", "há 2 meses", "nunca acessou". */
export function ultimoAcesso(d: Date | null | undefined, agora = new Date()): string {
  if (!d) return "nunca acessou";
  const hoje = isoSP(agora);
  const dia = isoSP(d);
  if (dia === hoje) return `hoje ${hora(d)}`;
  if (dia === addDiasISO(hoje, -1)) return `ontem ${hora(d)}`;
  const dias = Math.round((new Date(hoje + "T12:00:00Z").getTime() - new Date(dia + "T12:00:00Z").getTime()) / 86_400_000);
  if (dias < 60) return `há ${dias} dias`;
  return `há ${Math.round(dias / 30)} meses`;
}
