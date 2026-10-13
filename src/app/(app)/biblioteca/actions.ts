"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { exigir } from "@/server/auth/autorizacao";
import { listarPecas } from "@/server/services/catalogo";
import { executar, type ActionResult } from "@/lib/action";
import type { PecaOpcao } from "@/components/projetos/projeto-form";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";
import { desabilitarBibliotecaEmLote } from "@/server/services/biblioteca-lote";

/**
 * Catálogo de peças para o modal "Editar projeto" da Biblioteca. Vem só quando o modal abre,
 * em vez de ir inteiro na página para cada projeto selecionado. Mesma permissão do botão Editar.
 */
export async function pecasParaProjetoAction(): Promise<ActionResult<PecaOpcao[]>> {
  const usuario = await requireUsuario();
  return executar(async () => {
    exigir(usuario, "projeto.gerenciar");
    const pecas = await listarPecas(usuario);
    return pecas.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, setor: p.setor, familia: p.familia, unidade: p.unidade, permiteEmProjeto: p.permiteEmProjeto }));
  });
}

export async function desabilitarBibliotecaEmLoteAction(formData: FormData): Promise<ActionResult<{ alterados: number; jaInativos: number }>> {
  const usuario = await requireUsuario();
  const resultado = await executar(() => desabilitarBibliotecaEmLote(usuario, formData.get("tipo"), formData.getAll("ids")));
  if (!resultado.ok) return resultado;
  revalidatePath("/biblioteca");
  revalidatePath("/projetos", "layout");
  revalidatePath("/catalogo", "layout");
  invalidarDados(TAGS_DADOS.projetos, TAGS_DADOS.catalogo);
  const n = resultado.dados?.alterados ?? 0;
  return {
    ...resultado,
    mensagem: n ? `${n} ${n === 1 ? "item desabilitado" : "itens desabilitados"}.` : "Os itens selecionados já estavam desabilitados.",
  };
}
