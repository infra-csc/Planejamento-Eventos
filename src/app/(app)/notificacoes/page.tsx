import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { listarNotificacoes, marcarLida, marcarTodasLidas } from "@/server/services/notificacoes";
import { SubmitButton } from "@/components/ui/button";
import { EmptyState, Marcador, PageHeader } from "@/components/ui/layout";
import { tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { destinoInterno } from "@/lib/destino";
import { BotaoNotificacao } from "./botao-notificacao";

export const metadata: Metadata = { title: "Notificações" };

async function marcarTodasAction() {
  "use server";
  const u = await requireUsuario();
  await marcarTodasLidas(u);
  revalidatePath("/", "layout");
}

async function abrirAction(formData: FormData) {
  "use server";
  const u = await requireUsuario();
  await marcarLida(u, String(formData.get("id")));
  revalidatePath("/", "layout");
  const link = String(formData.get("link") ?? "");
  // Só links internos: a notificação é gerada pelo sistema, mas não seguimos URLs externas.
  redirect(destinoInterno(link, "/notificacoes"));
}

export default async function NotificacoesPage() {
  const usuario = await requireUsuario();
  const lista = await listarNotificacoes(usuario);
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notificações"
        description={naoLidas ? `${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"}. Só o que pede sua atenção: envios, respostas, prazos e mudanças de fase.` : "Tudo lido. Só o que pede sua atenção aparece aqui."}
        actions={
          naoLidas > 0 && (
            <form action={marcarTodasAction}>
              <SubmitButton variant="secondary" size="md">
                Marcar todas como lidas
              </SubmitButton>
            </form>
          )
        }
      />
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        {lista.length === 0 ? (
          <EmptyState title="Nenhuma notificação" description="Quando algo precisar da sua ação, aparece aqui." />
        ) : (
          lista.map((n) => {
            const prazo = /PRAZO|SLA/.test(n.tipo);
            const conteudo = (
              <>
                <Marcador tom={n.lidaEm ? undefined : prazo ? "danger" : "accent"} className={cn(n.lidaEm && "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-corpo text-ink", !n.lidaEm && "font-medium")}>
                    {!n.lidaEm && <span className="sr-only">Não lida: </span>}
                    {n.titulo}
                  </span>
                  <span className="mt-0.5 block text-pequeno leading-[1.45] text-ink-3">{n.mensagem}</span>
                  <span className="mt-1 block font-mono text-rotulo text-meta">{tempoRelativo(n.criadoEm)}</span>
                </span>
                {n.link && <span className="shrink-0 self-center text-pequeno text-accent">Abrir ›</span>}
              </>
            );
            const classe = cn("flex w-full items-start gap-3.5 border-b border-line-row px-cartao py-3.5 text-left last:border-b-0", !n.lidaEm && "bg-selected");
            // A linha inteira abre o destino (e marca como lida); sem destino, é só leitura.
            return n.link ? (
              <form key={n.id} action={abrirAction} className="m-0">
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="link" value={n.link} />
                <BotaoNotificacao rotulo={`Abrir: ${n.titulo}`} className={cn(classe, "cursor-pointer border-0 border-b bg-transparent hover:bg-subtle", !n.lidaEm && "bg-selected")}>
                  {conteudo}
                </BotaoNotificacao>
              </form>
            ) : (
              <div key={n.id} className={classe}>
                {conteudo}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
