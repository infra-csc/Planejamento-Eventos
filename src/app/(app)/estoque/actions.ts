"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/session";
import { executar } from "@/lib/action";
import { ajustarQuantidadeEstoque, salvarItemEstoque } from "@/server/services/estoque";

const itemSchema = z.object({
  id: z.string().min(1).max(64).nullable().optional(),
  nome: z.string().max(160),
  categoria: z.string().max(60),
  quantidade: z.number().int().min(0).max(1_000_000),
  comprar: z.number().int().min(0).max(1_000_000).nullable(),
  observacao: z.string().max(1000).nullable(),
  pecaId: z.string().max(64).nullable(),
  ativo: z.boolean().optional(),
});

export async function salvarItemEstoqueAction(dados: z.infer<typeof itemSchema>) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const r = await salvarItemEstoque(usuario, itemSchema.parse(dados));
      revalidatePath("/estoque");
      return r;
    },
    dados.id ? "Item atualizado" : "Item incluído no estoque",
    { acao: "salvarItemEstoque", usuarioId: usuario.id },
  );
}

export async function ajustarQuantidadeEstoqueAction(id: string, quantidade: number) {
  const usuario = await requireUsuario();
  return executar(
    async () => {
      const r = await ajustarQuantidadeEstoque(usuario, z.string().min(1).max(64).parse(id), z.number().int().min(0).max(1_000_000).parse(quantidade));
      revalidatePath("/estoque");
      return r;
    },
    undefined,
    { acao: "ajustarQuantidadeEstoque", usuarioId: usuario.id },
  );
}
