import type { ActionResult } from "@/lib/action";
import { kitDaTenda } from "@/domain/tendas";
import type { ItemNovo, Referencia } from "./tipos";
import { ACOMPANHANTES } from "@/domain/regras-kit";

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

/**
 * Peças que sempre vão junto (cocho → 2 cavaletes de ferro; bancada e mesa de medalha → 2 cavaletes de
 * madeira; grade 2×1 → 2 pés): uma linha automática por acompanhante, derivada da lista. Ela é marcada
 * na observação ("Vem junto…"), que vai para o pedido: assim o rascunho salvo volta e não duplica.
 * Linha da mesma peça pedida à parte continua separada (a ata desconta).
 */
export const MARCA_ACOMPANHANTE = "Vem junto";
export const ehAcompanhante = (i: ItemNovo) => i.justificativa.startsWith(MARCA_ACOMPANHANTE);
export function sincronizarAcompanhantes(itens: ItemNovo[], pecas: readonly Referencia[]): ItemNovo[] {
  let lista = itens;
  for (const a of ACOMPANHANTES) {
    const ac = pecas.find((p) => p.codigo === a.acompanhante);
    if (!ac) continue;
    const ids = new Set(a.bases.map((b) => pecas.find((p) => p.codigo === b)?.id).filter(Boolean));
    const base = lista.filter((i) => i.operacao === "ADICIONAR" && i.pecaId && ids.has(i.pecaId)).reduce((s, i) => s + i.quantidade, 0);
    const autos = lista.filter((i) => i.pecaId === ac.id && ehAcompanhante(i));
    const qtd = base * a.fator;
    if (qtd === 0) {
      if (autos.length) lista = lista.filter((i) => !autos.includes(i));
      continue;
    }
    if (autos.length === 1 && autos[0].quantidade === qtd) continue;
    const linha: ItemNovo = {
      chave: autos[0]?.chave ?? `auto-${a.acompanhante}`,
      operacao: "ADICIONAR",
      projetoId: null,
      pecaId: ac.id,
      eventoItemId: null,
      descricaoLivre: null,
      quantidade: qtd,
      quantidadeAtual: null,
      destino: "",
      justificativa: `${MARCA_ACOMPANHANTE} (${a.texto})`,
      descricoes: [],
      locais: [],
      semDescricao: true,
      ajustes: {},
      rotulo: `${ac.codigo} · ${ac.nome}`,
      meta: `vem junto · ${a.texto}`,
    };
    lista = autos.length ? lista.flatMap((i) => (i === autos[0] ? [linha] : autos.includes(i) ? [] : [i])) : [...lista, linha];
  }
  return lista;
}
