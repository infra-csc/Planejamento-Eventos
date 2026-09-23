import { test } from "@playwright/test";
import { criarEvento, entrar, unico, USUARIOS } from "./apoio";

/**
 * BUG DO APP (encontrado pelo E2E em 23/09/2026): criar ou editar um evento deixando
 * "Alterações até" em branco — o campo é opcional e o formulário sempre o envia como "" — falha com
 * "Não foi possível concluir a operação" (log: RangeError "Invalid time value").
 *
 * Causa: em src/lib/schemas.ts, `janelaAlteracoesAte: z.union([dataISO, z.literal("")])` tenta
 * primeiro `dataISO`; no Zod 4 o `.refine` roda mesmo depois de o `.regex` falhar, e
 * `new Date("T00:00:00Z").toISOString()` lança em vez de devolver issue. O mesmo vale para qualquer
 * texto fora do formato em `dataInicio`. Correção sugerida: `.refine(..., { abort/when })`, checar
 * `Number.isNaN(date.getTime())` antes do `toISOString`, ou pôr `z.literal("")` antes na união.
 *
 * Os outros fluxos preenchem "Alterações até" para não depender disto. Corrigido: o teste abaixo garante que continua funcionando.
 */
test("logística cria evento sem preencher 'Alterações até' (campo opcional)", async ({ page }) => {
  await entrar(page, USUARIOS.marina);
  await criarEvento(page, `E2E Sem janela ${unico()}`, { alteracoesAte: "" });
});
