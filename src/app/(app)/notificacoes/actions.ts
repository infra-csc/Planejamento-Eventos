"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { listarNotificacoes, marcarLida, marcarTodasLidas } from "@/server/services/notificacoes";
import { destinoInterno } from "@/lib/destino";

export type NotificacaoResumo = { id: string; titulo: string; mensagem: string; link: string | null; lida: boolean; criadoEm: string; prazo: boolean };

/** As mais recentes, para o painel do sino (sem sair da página). */
export async function notificacoesRecentesAction(): Promise<NotificacaoResumo[]> {
  const usuario = await requireUsuario();
  const lista = await listarNotificacoes(usuario, 20);
  return lista.map((n) => ({
    id: n.id,
    titulo: n.titulo,
    mensagem: n.mensagem,
    // Só caminhos internos: a notificação vem do sistema, mas o link nunca sai do app.
    link: n.link ? destinoInterno(n.link, "/notificacoes") : null,
    lida: Boolean(n.lidaEm),
    criadoEm: n.criadoEm.toISOString(),
    prazo: /PRAZO|SLA/.test(n.tipo),
  }));
}

/*
 * Qualquer revalidação numa action devolve a tela atual renderizada de novo desde o layout raiz (o
 * contador do sino e os do menu vêm juntos) e limpa o cache de navegação do cliente: o cliente não
 * precisa de router.refresh() depois. Revalidar "/" com "layout" também derrubava o cache de dados
 * de todas as páginas.
 */

/**
 * Marca a notificação como lida. Com `destino`, já navega para lá na mesma resposta (a página de
 * destino vem renderizada com o contador atualizado), em vez de renderizar a tela atual e depois a nova.
 */
export async function marcarNotificacaoLidaAction(id: string, destino?: string | null) {
  const usuario = await requireUsuario();
  if (typeof id !== "string") return;
  await marcarLida(usuario, id);
  revalidatePath("/notificacoes");
  // Só caminho interno (mesma regra do link na lista do sino).
  if (typeof destino === "string" && destino) redirect(destinoInterno(destino, "/notificacoes"));
}

export async function marcarTodasNotificacoesLidasAction() {
  const usuario = await requireUsuario();
  await marcarTodasLidas(usuario);
  revalidatePath("/notificacoes");
}
