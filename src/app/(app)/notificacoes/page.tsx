import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { listarNotificacoes, marcarLida, marcarTodasLidas } from "@/server/services/notificacoes";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/cn";

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
  redirect(link.startsWith("/") && !link.startsWith("//") ? link : "/notificacoes");
}

export default async function NotificacoesPage() {
  const usuario = await requireUsuario();
  const lista = await listarNotificacoes(usuario);
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  return (
    <div className="max-w-[780px]">
      <PageHeader
        title="Notificações"
        description={naoLidas ? `${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"}. Só o que pede sua atenção: envios, respostas, prazos e mudanças de fase.` : "Tudo lido. Só o que pede sua atenção aparece aqui."}
        actions={
          naoLidas > 0 && (
            <form action={marcarTodasAction}>
              <Button type="submit" variant="secondary" size="md">
                Marcar todas como lidas
              </Button>
            </form>
          )
        }
      />
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        {lista.length === 0 ? (
          <div className="px-[18px] py-14 text-center">
            <p className="m-0 text-[14px] font-medium">Nenhuma notificação</p>
            <p className="mt-1 text-[13px] text-muted">Quando algo precisar da sua ação, aparece aqui.</p>
          </div>
        ) : (
          lista.map((n) => {
            const prazo = /PRAZO|SLA/.test(n.tipo);
            return (
              <div key={n.id} className={cn("flex items-start gap-3.5 border-b border-line-row px-[18px] py-3.5 last:border-b-0", !n.lidaEm && "bg-selected")}>
                <span aria-hidden className="mt-1.5 block size-[7px] shrink-0 rounded-full" style={{ background: n.lidaEm ? "transparent" : prazo ? "#a8400f" : "#8e2740" }} />
                <div className="min-w-0 flex-1">
                  <p className={cn("m-0 text-[13.5px] text-ink", !n.lidaEm && "font-medium")}>
                    {!n.lidaEm && <span className="sr-only">Não lida: </span>}
                    {n.titulo}
                  </p>
                  <p className="mb-0 mt-0.5 text-[12.5px] leading-[1.45] text-ink-3">{n.mensagem}</p>
                  <p className="mb-0 mt-1 font-mono text-[11.5px] text-meta">{tempoRelativo(n.criadoEm)}</p>
                </div>
                {n.link && (
                  <form action={abrirAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="link" value={n.link} />
                    <Button type="submit" variant="secondary" size="sm">
                      Abrir
                    </Button>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
