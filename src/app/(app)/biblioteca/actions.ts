"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { exigir } from "@/server/auth/autorizacao";
import { listarPecas } from "@/server/services/catalogo";
import { executar, type ActionResult } from "@/lib/action";
import type { PecaOpcao } from "@/components/projetos/projeto-form";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";
import { desabilitarBibliotecaEmLote, organizarProjetosEmLote, type OrganizacaoProjetos } from "@/server/services/biblioteca-lote";
import { excluirGrupoProjeto } from "@/server/services/projetos";

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

/** grupoModo: manter | padrao | nome; categoriaModo: manter | limpar | definir. */
export async function organizarProjetosEmLoteAction(formData: FormData): Promise<ActionResult<{ alterados: number; semMudanca: number }>> {
  const usuario = await requireUsuario();
  const texto = (campo: string) => {
    const v = formData.get(campo);
    return typeof v === "string" ? v : "";
  };
  const organizacao: OrganizacaoProjetos = {};
  const grupoModo = texto("grupoModo");
  const categoriaModo = texto("categoriaModo");
  if (grupoModo === "nome" && !texto("grupoNome").trim()) return { ok: false, erro: "Informe o nome do grupo.", campos: { grupoNome: "Informe o nome do grupo." } };
  if (categoriaModo === "definir" && !texto("categoria").trim()) return { ok: false, erro: "Informe a categoria ou escolha Remover categoria.", campos: { categoria: "Informe a categoria." } };
  if (grupoModo === "padrao") organizacao.grupo = null;
  else if (grupoModo === "nome") organizacao.grupo = texto("grupoNome");
  if (categoriaModo === "limpar") organizacao.categoria = "";
  else if (categoriaModo === "definir") organizacao.categoria = texto("categoria");
  const resultado = await executar(() => organizarProjetosEmLote(usuario, formData.getAll("ids"), organizacao), undefined, { acao: "organizarProjetosEmLote", usuarioId: usuario.id });
  if (!resultado.ok) return resultado;
  revalidatePath("/biblioteca");
  revalidatePath("/projetos", "layout");
  invalidarDados(TAGS_DADOS.projetos);
  const n = resultado.dados?.alterados ?? 0;
  return {
    ...resultado,
    mensagem: n ? `${n} ${n === 1 ? "projeto atualizado" : "projetos atualizados"}.` : "Os projetos selecionados já estavam assim.",
  };
}

/** Exclui um grupo de prova; os projetos e as peças dele passam para Padrão. */
export async function excluirGrupoProjetoAction(grupoId: string): Promise<ActionResult<{ nome: string; projetos: number; pecas: number }>> {
  const usuario = await requireUsuario();
  if (typeof grupoId !== "string" || !grupoId) return { ok: false, erro: "Dados inválidos." };
  const r = await executar(() => excluirGrupoProjeto(usuario, grupoId));
  if (!r.ok) return r;
  revalidatePath("/biblioteca");
  revalidatePath("/projetos", "layout");
  revalidatePath("/catalogo", "layout");
  invalidarDados(TAGS_DADOS.projetos, TAGS_DADOS.catalogo);
  return r;
}
