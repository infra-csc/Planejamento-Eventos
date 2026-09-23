import type { ActionResult } from "@/lib/action";
import { kitDaTenda } from "@/domain/tendas";
import type { Referencia } from "./tipos";

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
export const extraDoKit = (r: Referencia, papel: "fechamento" | "calha") => {
  const codigo = kitDe(r)?.pecas[papel];
  return (codigo && [...(r.bom ?? []), ...(r.extras ?? [])].find((b) => b.codigo === codigo)?.pecaId) || null;
};
