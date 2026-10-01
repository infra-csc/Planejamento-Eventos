import type { ActionResult } from "@/lib/action";
import { kitDaTenda } from "@/domain/tendas";
import type { ItemNovo, Referencia } from "./tipos";

let seq = 0;
export const novaChave = () => `n${Date.now()}-${seq++}`;
/** Cartões de resultado exibidos por vez: poucos o bastante para a lista de itens (passo 3) ficar perto. */
export const POR_PAGINA = 12;
/** Confirmação só do lado do cliente (trocar de evento): o ConfirmDialog espera uma action. */
export const confirmarLocal = async (): Promise<ActionResult> => ({ ok: true });
/** Evita ".." quando o motivo já termina em pontuação. */
export const comPontoFinal = (t: string) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
/** Leva até um campo (rolagem suave) e põe o foco nele. */
export const irPara = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "center" });
  window.setTimeout(() => el.focus({ preventScroll: true }), reduzir ? 0 : 350);
};

/** Projeto de tenda: o kit (tamanho e peças) reconhecido pelo padrão do projeto; `null` se não for tenda. */
export const kitDe = (r: Referencia) => (r.bom?.length ? kitDaTenda(r.bom.map((b) => b.codigo)) : null);

/**
 * Itens do mesmo projeto adicionados à solicitação ficam juntos, num cartão só (ex.: tenda 5×5 em
 * 3 locais = 1 item "Tenda 5×5 m × 10" com os locais dentro). Cada local continua uma linha, porque
 * as peças ajustadas (fechamentos, calhas) podem mudar de um local para outro. Ordem da 1ª aparição.
 */
export function agruparItensNovos(itens: readonly ItemNovo[]): Array<{ chave: string; itens: ItemNovo[] }> {
  const grupos = new Map<string, ItemNovo[]>();
  for (const i of itens) {
    const k = i.operacao === "ADICIONAR" && i.projetoId ? `projeto:${i.projetoId}` : i.chave;
    grupos.set(k, [...(grupos.get(k) ?? []), i]);
  }
  return [...grupos.entries()].map(([chave, lista]) => ({ chave, itens: lista }));
}

/** O cocho para água sempre vai com 2 cavaletes de ferro: a linha do cavalete acompanha o cocho sozinha. */
export const CHAVE_CAVALETE_COCHO = "auto-cavalete-cocho";
export function sincronizarCavaletesCocho(itens: ItemNovo[], pecas: readonly Referencia[]): ItemNovo[] {
  const cocho = pecas.find((p) => p.codigo === "COCHO");
  const cav = pecas.find((p) => p.codigo === "CAV-COCHO");
  if (!cocho || !cav) return itens;
  const cochos = itens.filter((i) => i.operacao === "ADICIONAR" && i.pecaId === cocho.id).reduce((a, i) => a + i.quantidade, 0);
  // Com cocho na lista, toda linha de cavalete vira uma só, de 2 por cocho (inclusive a que voltou de um rascunho salvo).
  const cavaletes = itens.filter((i) => i.operacao === "ADICIONAR" && i.pecaId === cav.id);
  const atual = cavaletes[0];
  if (cochos === 0) return atual?.chave === CHAVE_CAVALETE_COCHO ? itens.filter((i) => i !== atual) : itens;
  if (cavaletes.length === 1 && atual.quantidade === cochos * 2 && atual.meta.startsWith("vem junto")) return itens;
  const linha: ItemNovo = {
    chave: atual?.chave ?? CHAVE_CAVALETE_COCHO,
    operacao: "ADICIONAR",
    projetoId: null,
    pecaId: cav.id,
    eventoItemId: null,
    descricaoLivre: null,
    quantidade: cochos * 2,
    quantidadeAtual: null,
    destino: "",
    justificativa: "",
    descricoes: [],
    locais: [],
    semDescricao: true,
    ajustes: {},
    rotulo: `${cav.codigo} · ${cav.nome}`,
    meta: "vem junto com o cocho (2 por cocho)",
  };
  if (!atual) return [...itens, linha];
  return itens.flatMap((i) => (i === atual ? [linha] : cavaletes.includes(i) ? [] : [i]));
}
