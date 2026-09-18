"use server";

import { revalidatePath } from "next/cache";
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

export async function marcarNotificacaoLidaAction(id: string) {
  const usuario = await requireUsuario();
  if (typeof id !== "string") return;
  await marcarLida(usuario, id);
  revalidatePath("/", "layout");
}

export async function marcarTodasNotificacoesLidasAction() {
  const usuario = await requireUsuario();
  await marcarTodasLidas(usuario);
  revalidatePath("/", "layout");
}
