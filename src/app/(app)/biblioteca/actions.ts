"use server";

import { requireUsuario } from "@/server/auth/session";
import { exigir } from "@/server/auth/autorizacao";
import { listarPecas } from "@/server/services/catalogo";
import { executar, type ActionResult } from "@/lib/action";
import type { PecaOpcao } from "@/components/projetos/projeto-form";

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
