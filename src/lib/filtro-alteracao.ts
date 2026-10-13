import { addDiasISO, formatarData, hojeISO, parseDateTimeLocal } from "./format";

/** Períodos do filtro "Alterado" da Biblioteca. "periodo" usa as datas de/até (dias em São Paulo). */
export const OPCOES_ALTERACAO = [
  { value: "hoje", label: "Alterados hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "mais90", label: "Sem alteração há mais de 90 dias" },
  { value: "mais365", label: "Sem alteração há mais de 1 ano" },
  { value: "periodo", label: "Período personalizado…" },
] as const;

export type ChaveAlteracao = (typeof OPCOES_ALTERACAO)[number]["value"];

export type FiltroAlteracao = {
  chave: ChaveAlteracao;
  /** Inclusivo. */
  inicio: Date | null;
  /** Exclusivo. */
  fim: Date | null;
  /** Complemento legível: "alterados nos últimos 7 dias". */
  descricao: string;
  /** Recortes "recentes" listam do mais novo para o mais antigo. */
  recentesPrimeiro: boolean;
};

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Meia-noite do dia em São Paulo; null se a data não existe. */
export function inicioDoDia(iso: string): Date | null {
  return DIA_ISO.test(iso) ? parseDateTimeLocal(`${iso}T00:00`) : null;
}

export function lerFiltroAlteracao(sp: { alterado?: string; alteradoDe?: string; alteradoAte?: string }, hoje = hojeISO()): FiltroAlteracao | null {
  const chave = OPCOES_ALTERACAO.find((o) => o.value === sp.alterado)?.value;
  if (!chave) return null;
  const desde = (dias: number) => inicioDoDia(addDiasISO(hoje, -(dias - 1)));
  switch (chave) {
    case "hoje":
      return { chave, inicio: inicioDoDia(hoje), fim: null, descricao: "alterados hoje", recentesPrimeiro: true };
    case "7d":
    case "30d":
    case "90d": {
      const dias = Number(chave.slice(0, -1));
      return { chave, inicio: desde(dias), fim: null, descricao: `alterados nos últimos ${dias} dias`, recentesPrimeiro: true };
    }
    case "mais90":
      return { chave, inicio: null, fim: desde(90), descricao: "sem alteração há mais de 90 dias", recentesPrimeiro: false };
    case "mais365":
      return { chave, inicio: null, fim: desde(365), descricao: "sem alteração há mais de 1 ano", recentesPrimeiro: false };
    case "periodo": {
      let de = sp.alteradoDe && inicioDoDia(sp.alteradoDe) ? sp.alteradoDe : null;
      let ate = sp.alteradoAte && inicioDoDia(sp.alteradoAte) ? sp.alteradoAte : null;
      if (!de && !ate) return null;
      if (de && ate && de > ate) [de, ate] = [ate, de];
      const descricao = de && ate ? (de === ate ? `alterados em ${formatarData(de)}` : `alterados de ${formatarData(de)} a ${formatarData(ate)}`) : de ? `alterados desde ${formatarData(de)}` : `alterados até ${formatarData(ate)}`;
      return { chave, inicio: de ? inicioDoDia(de) : null, fim: ate ? inicioDoDia(addDiasISO(ate, 1)) : null, descricao, recentesPrimeiro: true };
    }
  }
}

export function dentroDoFiltroAlteracao(data: Date | string, f: FiltroAlteracao | null): boolean {
  if (!f) return true;
  const t = new Date(data).getTime();
  return (!f.inicio || t >= f.inicio.getTime()) && (!f.fim || t < f.fim.getTime());
}
