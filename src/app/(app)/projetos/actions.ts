"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { alterarAtivoProjeto, alterarDisponivelProjeto, anexarArquivo, criarProjeto, editarProjeto, removerAnexo } from "@/server/services/projetos";
import { projetoSchema } from "@/lib/schemas";
import { executar, tratarErro, type ActionResult } from "@/lib/action";
import { destinoInterno } from "@/lib/destino";
import { invalidarDados, TAGS_DADOS } from "@/server/cache-dados";

/**
 * Cria ou salva o projeto e devolve para onde ir com a mensagem: a tela mostra o toast e navega. Antes a action
 * redirecionava e ninguém dizia que tinha salvado; no modal da Biblioteca o modal só fechava (parte C N19).
 */
export async function salvarProjetoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult<{ destino: string }>> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "") || null;
  // "Criar grupo…" com o nome vazio salvava no grupo Padrão sem aviso (auditoria 30/10, parte C N18).
  if (formData.get("grupoNovo") === "1" && !String(formData.get("grupoEvento") ?? "").trim()) return { ok: false, erro: "Informe o nome do grupo.", campos: { grupoNome: "Informe o nome do grupo." } };
  let destino: string;
  let mensagem: string;
  try {
    const itensRaw = JSON.parse(String(formData.get("itens") ?? "[]")) as unknown;
    const dados = projetoSchema.parse({
      nome: formData.get("nome"),
      grupoEvento: formData.has("grupoEvento") ? formData.get("grupoEvento") : undefined,
      categoria: formData.get("categoria"),
      descricao: formData.get("descricao"),
      observacaoVersao: formData.get("observacaoVersao"),
      disponivelEmSolicitacoes: formData.get("disponivel") === "on",
      itens: itensRaw,
    });
    if (id) {
      const r = await editarProjeto(usuario, id, dados);
      destino = `/projetos/${id}`;
      const n = r.atualizacao?.eventos.length ?? 0;
      mensagem = r.bomMudou ? `Projeto salvo como v${r.versao}${n ? ` · ${n} ${n === 1 ? "evento atualizado" : "eventos atualizados"}` : ""}` : "Projeto salvo";
    } else {
      const p = await criarProjeto(usuario, dados);
      destino = `/projetos/${p.id}`;
      mensagem = `Projeto ${p.codigo} criado`;
    }
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/projetos");
  revalidatePath("/biblioteca");
  // Projetos e BOM da versão atual em cache (listas e opções dos formulários): expiram já.
  invalidarDados(TAGS_DADOS.projetos);
  // Formulário dentro de um modal (Biblioteca) pede para voltar ao mesmo lugar.
  const voltarPara = String(formData.get("voltarPara") ?? "");
  // Só caminho interno: "//site" também começa com "/" e levaria para fora do app.
  return { ok: true, mensagem, dados: { destino: destinoInterno(voltarPara, destino) } };
}

export async function alterarAtivoProjetoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  const r = await executar(() => alterarAtivoProjeto(usuario, id, ativo), ativo ? "Projeto reativado" : "Projeto inativado");
  revalidatePath("/projetos");
  revalidatePath("/biblioteca");
  revalidatePath(`/projetos/${id}`);
  invalidarDados(TAGS_DADOS.projetos);
  return r;
}

export async function alterarDisponivelProjetoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const usuario = await requireUsuario();
  const id = String(formData.get("id") ?? "");
  const disponivel = String(formData.get("disponivel")) === "true";
  const r = await executar(() => alterarDisponivelProjeto(usuario, id, disponivel), disponivel ? "Projeto disponível nas solicitações" : "Projeto fora das listas das solicitações");
  revalidatePath("/projetos");
  revalidatePath("/biblioteca");
  revalidatePath(`/projetos/${id}`);
  invalidarDados(TAGS_DADOS.projetos);
  return r;
}

/**
 * Um arquivo por chamada, como na peça e na Ativação: a tela (AnexosPeca) envia vários de uma vez, um a um, com as
 * fotos já reduzidas no navegador. Antes era "Escolher arquivo + Enviar" para cada um (auditoria 30/10, parte C N15).
 */
export async function adicionarAnexoProjetoAction(form: FormData) {
  const usuario = await requireUsuario();
  const projetoId = String(form.get("projetoId") ?? "");
  const arquivo = form.get("arquivo");
  if (!projetoId || !(arquivo instanceof File)) return { ok: false, erro: "Escolha uma foto ou um PDF." } as const;
  const r = await executar(() => anexarArquivo(usuario, projetoId, arquivo));
  revalidatePath(`/projetos/${projetoId}`);
  revalidatePath("/biblioteca");
  // A capa do projeto (primeira imagem) entra nas listas em cache.
  invalidarDados(TAGS_DADOS.projetos);
  return r;
}

/** Validação dentro do `executar`: chamada sem o id respondia 500 "erro registrado" (auditoria 30/10, parte C N28). */
export async function removerAnexoProjetoAction(anexoId: string) {
  const usuario = await requireUsuario();
  const r = await executar(() => removerAnexo(usuario, z.string().min(1).max(64).parse(anexoId)), "Anexo removido");
  if (r.ok && r.dados) revalidatePath(`/projetos/${r.dados}`);
  revalidatePath("/projetos");
  revalidatePath("/biblioteca");
  invalidarDados(TAGS_DADOS.projetos);
  return r;
}
