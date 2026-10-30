"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { executar } from "@/lib/action";
import { ajustarQuantidadeEstoque, salvarItemEstoque } from "@/server/services/estoque";
import { abrirReforma, adicionarAnexoEstoque, concluirReforma, editarReforma, pedidosDoItem, registrarRetorno, removerAnexoEstoque } from "@/server/services/ativacao";

/** Tudo do módulo muda junto: estoque, retornos, reformas e a página do item. */
const revalidar = () => revalidatePath("/ativacao", "layout");

const id = z.string().min(1).max(64);
const inteiro = z.number().int().min(0).max(1_000_000);
const texto = (max: number) => z.string().max(max).nullable().optional();
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal(""));

const itemSchema = z.object({
  id: id.nullable().optional(),
  nome: z.string().max(160),
  categoria: z.string().max(60),
  quantidade: inteiro,
  comprar: inteiro.nullable(),
  observacao: z.string().max(1000).nullable(),
  pecaId: z.string().max(64).nullable(),
  ativo: z.boolean().optional(),
});

export async function salvarItemEstoqueAction(dados: z.infer<typeof itemSchema>) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const r = await salvarItemEstoque(usuario, itemSchema.parse(dados));
      revalidar();
      return r;
    },
    dados.id ? "Item atualizado" : "Item incluído no estoque",
    { acao: "salvarItemEstoque", usuarioId: usuario.id },
  );
}

/** `esperado`: o número que a tela mostrava; se o estoque mudou nesse meio-tempo, recusa em vez de gravar por cima. */
export async function ajustarQuantidadeEstoqueAction(itemId: string, quantidade: number, esperado?: number) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const r = await ajustarQuantidadeEstoque(usuario, id.parse(itemId), inteiro.parse(quantidade), esperado === undefined ? undefined : inteiro.parse(esperado));
      revalidar();
      return r;
    },
    undefined,
    { acao: "ajustarQuantidadeEstoque", usuarioId: usuario.id },
  );
}

const retornoSchema = z.object({
  eventoId: id,
  itens: z.array(z.object({ itemId: id, voltaram: inteiro, reforma: inteiro, perdidos: inteiro, observacao: texto(500) })).min(1).max(200),
});

export async function registrarRetornoAction(dados: z.infer<typeof retornoSchema>) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const d = retornoSchema.parse(dados);
      const r = await registrarRetorno(usuario, d.eventoId, d.itens);
      revalidar();
      return r;
    },
    "Retorno registrado",
    { acao: "registrarRetorno", usuarioId: usuario.id },
  );
}

const reformaSchema = z.object({ itemId: id, quantidade: z.number().int().min(1).max(1_000_000), motivo: texto(500), local: texto(120), previsao: data });

export async function abrirReformaAction(dados: z.infer<typeof reformaSchema>) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const d = reformaSchema.parse(dados);
      const r = await abrirReforma(usuario, { ...d, previsao: d.previsao || null });
      revalidar();
      return r;
    },
    "Enviado para reforma",
    { acao: "abrirReforma", usuarioId: usuario.id },
  );
}

const edicaoReformaSchema = z.object({ motivo: texto(500), local: texto(120), previsao: data });

export async function editarReformaAction(reformaId: string, dados: z.infer<typeof edicaoReformaSchema>) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const d = edicaoReformaSchema.parse(dados);
      const r = await editarReforma(usuario, id.parse(reformaId), { ...d, previsao: d.previsao || null });
      revalidar();
      return r;
    },
    "Reforma atualizada",
    { acao: "editarReforma", usuarioId: usuario.id },
  );
}

export async function concluirReformaAction(reformaId: string, consertados: number, baixados: number) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const r = await concluirReforma(usuario, id.parse(reformaId), inteiro.parse(consertados), inteiro.parse(baixados));
      revalidar();
      return r;
    },
    "Reforma concluída",
    { acao: "concluirReforma", usuarioId: usuario.id },
  );
}

export async function adicionarAnexoEstoqueAction(form: FormData) {
  const usuario = await requireUsuario();
  const itemId = String(form.get("itemId") ?? "");
  const reformaId = String(form.get("reformaId") ?? "") || null;
  const arquivo = form.get("arquivo");
  if (!itemId || !(arquivo instanceof File)) return { ok: false, erro: "Escolha uma foto ou um PDF." } as const;
  const r = await executar(() => adicionarAnexoEstoque(usuario, itemId, arquivo, reformaId));
  revalidar();
  return r;
}

export async function removerAnexoEstoqueAction(anexoId: string) {
  const usuario = await requireUsuario();
  if (typeof anexoId !== "string" || !anexoId) return { ok: false, erro: "Não foi possível concluir. Atualize a página e tente de novo." } as const;
  const r = await executar(() => removerAnexoEstoque(usuario, anexoId), "Arquivo removido");
  revalidar();
  return r;
}

/** Janela "Ver pedidos" do estoque: só leitura, carregada quando a pessoa abre. */
export async function pedidosDoItemAction(itemId: string) {
  const usuario = await requireUsuario();
  return executar(() => pedidosDoItem(usuario, id.parse(itemId)), undefined, { acao: "pedidosDoItem", usuarioId: usuario.id });
}
