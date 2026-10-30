"use server";

import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth/session";
import { exigir } from "@/server/auth/autorizacao";
import { listarPecas } from "@/server/services/catalogo";
import { executar, tratarErro, type ActionResult } from "@/lib/action";
import type { PecaOpcao } from "@/components/projetos/projeto-form";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";
import { desabilitarBibliotecaEmLote, disponibilizarBibliotecaEmLote, LoteBloqueadoError, organizarProjetosEmLote, reativarBibliotecaEmLote, type OrganizacaoProjetos, type ProjetoBloqueio } from "@/server/services/biblioteca-lote";
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

/** Lote recusado porque alguns itens prendem os outros: a tela lista os projetos com link (parte C N12). */
export type ResultadoLoteBloqueado = { ok: false; erro: string; projetos: ProjetoBloqueio[] };

/** Erro de lote com a lista de projetos, ou o tratamento padrão. */
async function executarLote<T>(fn: () => Promise<T>): Promise<ActionResult<T> | ResultadoLoteBloqueado> {
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    if (e instanceof LoteBloqueadoError) return { ok: false, erro: e.message, projetos: e.projetos };
    return tratarErro(e);
  }
}

const revalidarLote = () => {
  revalidatePath("/biblioteca");
  revalidatePath("/projetos", "layout");
  revalidatePath("/catalogo", "layout");
  invalidarDados(TAGS_DADOS.projetos, TAGS_DADOS.catalogo);
};

/** "Inativar selecionados" (era "Desabilitar"; auditoria 28/10, nº 76). */
export async function desabilitarBibliotecaEmLoteAction(formData: FormData): Promise<ActionResult<{ alterados: number; jaInativos: number }> | ResultadoLoteBloqueado> {
  const usuario = await requireUsuario();
  const resultado = await executarLote(() => desabilitarBibliotecaEmLote(usuario, formData.get("tipo"), formData.getAll("ids")));
  if (!resultado.ok) return resultado;
  revalidarLote();
  const n = resultado.dados?.alterados ?? 0;
  return {
    ...resultado,
    mensagem: n ? `${n} ${n === 1 ? "item inativado" : "itens inativados"}.` : "Os itens selecionados já estavam inativos.",
  };
}

/** "Reativar selecionados", no filtro "Só inativos" (auditoria 30/10, parte C N27). */
export async function reativarBibliotecaEmLoteAction(formData: FormData): Promise<ActionResult<{ alterados: number; jaAtivos: number }> | ResultadoLoteBloqueado> {
  const usuario = await requireUsuario();
  const resultado = await executarLote(() => reativarBibliotecaEmLote(usuario, formData.get("tipo"), formData.getAll("ids")));
  if (!resultado.ok) return resultado;
  revalidarLote();
  const n = resultado.dados?.alterados ?? 0;
  return {
    ...resultado,
    mensagem: n ? `${n} ${n === 1 ? "item reativado" : "itens reativados"}.` : "Os itens selecionados já estavam ativos.",
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

/** Exclui um grupo da biblioteca; os projetos e as peças dele passam para Padrão. */
export async function excluirGrupoProjetoAction(grupoId: string): Promise<ActionResult<{ nome: string; projetos: number; pecas: number }>> {
  const usuario = await requireUsuario();
  if (typeof grupoId !== "string" || !grupoId) return { ok: false, erro: "Não foi possível concluir. Atualize a página e tente de novo." };
  const r = await executar(() => excluirGrupoProjeto(usuario, grupoId));
  if (!r.ok) return r;
  revalidatePath("/biblioteca");
  revalidatePath("/projetos", "layout");
  revalidatePath("/catalogo", "layout");
  invalidarDados(TAGS_DADOS.projetos, TAGS_DADOS.catalogo);
  return r;
}

/** Mostrar ou tirar das solicitações os itens marcados. disponivel: "1" mostra, "0" tira. */
export async function disponibilizarBibliotecaEmLoteAction(formData: FormData): Promise<ActionResult<{ alterados: number; semMudanca: number }>> {
  const usuario = await requireUsuario();
  const disponivel = formData.get("disponivel") === "1";
  const resultado = await executar(() => disponibilizarBibliotecaEmLote(usuario, formData.get("tipo"), formData.getAll("ids"), disponivel));
  if (!resultado.ok) return resultado;
  revalidatePath("/biblioteca");
  revalidatePath("/projetos", "layout");
  revalidatePath("/catalogo", "layout");
  revalidatePath("/solicitacoes/nova");
  invalidarDados(TAGS_DADOS.projetos, TAGS_DADOS.catalogo);
  const n = resultado.dados?.alterados ?? 0;
  const texto = disponivel ? (n === 1 ? "item agora aparece nas solicitações" : "itens agora aparecem nas solicitações") : n === 1 ? "item saiu das solicitações" : "itens saíram das solicitações";
  return { ...resultado, mensagem: n ? `${n} ${texto}.` : "Os itens selecionados já estavam assim." };
}
